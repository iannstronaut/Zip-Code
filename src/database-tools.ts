// Database tools - read-first SQL execution against SQLite databases.
//
// Why SQLite? Zero-config (already shipped via better-sqlite3), no daemon to
// manage, and most projects you're going to inspect carry a local .db file.
// Postgres/MySQL can be added later by spawning psql/mysql in execute_bash.
//
// Safety rules:
//   - Read-only mode is the DEFAULT. Set { allowWrite: true } to opt in.
//   - Statements are validated against a denylist (DROP/DELETE/etc.) when
//     allowWrite is false.
//   - Result rows are capped at 500 by default to keep them out of the
//     context window.

import type { ToolDefinition, ToolResult } from './types.js';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';

export const DATABASE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'sql_query',
      description:
        'Execute a SQL query against a SQLite database file. Read-only by default (SELECT/PRAGMA only). Use allow_write=true to enable INSERT/UPDATE/CREATE etc. Results are returned as JSON rows.',
      parameters: {
        type: 'object',
        properties: {
          db_path: {
            type: 'string',
            description: 'Path to the SQLite .db file.',
          },
          query: {
            type: 'string',
            description: 'SQL query to run.',
          },
          params: {
            type: 'array',
            items: {},
            description:
              'Optional positional parameters bound to ? placeholders in the query.',
          },
          limit: {
            type: 'number',
            description:
              'Max rows to return (default 500). Applied client-side after the query.',
          },
          allow_write: {
            type: 'boolean',
            description:
              'Set true to allow non-SELECT statements. Defaults to false (read-only).',
          },
        },
        required: ['db_path', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sql_schema',
      description:
        'List tables, indexes, and columns in a SQLite database. Optionally filter to a single table.',
      parameters: {
        type: 'object',
        properties: {
          db_path: {
            type: 'string',
            description: 'Path to the SQLite .db file.',
          },
          table: {
            type: 'string',
            description: 'Optional table name to inspect. If omitted, lists all tables.',
          },
        },
        required: ['db_path'],
      },
    },
  },
];

const WRITE_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'REPLACE',
  'ATTACH',
  'DETACH',
  'VACUUM',
  'REINDEX',
];

function isReadOnly(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed) return true;
  // Allow SELECT, WITH (CTE that resolves to SELECT), PRAGMA, EXPLAIN
  if (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('PRAGMA') ||
    trimmed.startsWith('EXPLAIN')
  ) {
    // Sanity check: no write keyword as first word of any subsequent statement
    const statements = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      const firstWord = stmt.split(/\s+/)[0];
      if (WRITE_KEYWORDS.includes(firstWord)) return false;
    }
    return true;
  }
  return false;
}

async function openDb(dbPath: string): Promise<any> {
  const resolved = resolve(dbPath);
  if (!existsSync(resolved)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }
  // Lazy import - better-sqlite3 is already a project dep
  const sqliteModule: any = await import('better-sqlite3');
  const Database = sqliteModule.default || sqliteModule;
  return new Database(resolved, { readonly: false, fileMustExist: true });
}

export async function sqlQuery(
  dbPath: string,
  query: string,
  params: any[] = [],
  limit = 500,
  allowWrite = false
): Promise<ToolResult> {
  let db: any = null;
  try {
    if (!allowWrite && !isReadOnly(query)) {
      return {
        success: false,
        output: '',
        error:
          'Query rejected: write operations require allow_write=true. Read-only mode allows SELECT, WITH, PRAGMA, EXPLAIN only.',
      };
    }

    db = await openDb(dbPath);
    const stmt = db.prepare(query);

    // Detect if this stmt returns rows
    const isSelect = stmt.reader;

    if (isSelect) {
      const rows = stmt.all(...params);
      const truncated = rows.length > limit;
      const slice = rows.slice(0, limit);
      const lines = [
        `Returned ${rows.length} row(s)${truncated ? ` (showing first ${limit})` : ''}.`,
        '',
        JSON.stringify(slice, null, 2),
      ];
      return { success: true, output: lines.join('\n') };
    }

    const info = stmt.run(...params);
    return {
      success: true,
      output: `Statement executed. changes=${info.changes} lastInsertRowid=${info.lastInsertRowid}`,
    };
  } catch (e: any) {
    logger.error('sql_query failed', e, { dbPath, query: query.slice(0, 200) });
    return {
      success: false,
      output: '',
      error: `SQL error: ${e?.message || e}`,
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
  }
}

export async function sqlSchema(dbPath: string, table?: string): Promise<ToolResult> {
  let db: any = null;
  try {
    db = await openDb(dbPath);

    if (table) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      if (cols.length === 0) {
        return {
          success: false,
          output: '',
          error: `Table not found: ${table}`,
        };
      }
      const indexes = db.prepare(`PRAGMA index_list(${table})`).all();
      return {
        success: true,
        output: [
          `Table: ${table}`,
          '',
          'Columns:',
          JSON.stringify(cols, null, 2),
          '',
          'Indexes:',
          JSON.stringify(indexes, null, 2),
        ].join('\n'),
      };
    }

    const tables = db
      .prepare(
        `SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view', 'index') ORDER BY type, name`
      )
      .all();

    const tableList = tables.filter((t: any) => t.type === 'table');
    const viewList = tables.filter((t: any) => t.type === 'view');
    const indexList = tables.filter((t: any) => t.type === 'index');

    const lines = [
      `Database: ${dbPath}`,
      `Tables (${tableList.length}): ${tableList.map((t: any) => t.name).join(', ') || '(none)'}`,
      `Views (${viewList.length}): ${viewList.map((t: any) => t.name).join(', ') || '(none)'}`,
      `Indexes (${indexList.length}): ${indexList.map((t: any) => t.name).join(', ') || '(none)'}`,
      '',
      'Schema:',
      JSON.stringify(tables, null, 2),
    ];
    return { success: true, output: lines.join('\n') };
  } catch (e: any) {
    logger.error('sql_schema failed', e, { dbPath, table });
    return {
      success: false,
      output: '',
      error: `Schema inspection failed: ${e?.message || e}`,
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
  }
}
