# ZIP CODE - AI TUI Agent

```
 ███████╗██╗██████╗      ██████╗ ██████╗ ██████╗ ███████╗
 ╚══███╔╝██║██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ███╔╝ ██║██████╔╝    ██║     ██║   ██║██║  ██║█████╗
  ███╔╝  ██║██╔═══╝     ██║     ██║   ██║██║  ██║██╔══╝
 ███████╗██║██║         ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝╚═╝          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**A modern, Ink-powered Terminal UI agent for coding assistance — with multi-agent architecture, MCP support, and a full extensibility layer.**

[![Version](https://img.shields.io/badge/version-2.7.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-147%20passing-brightgreen.svg)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

---

## Table of Contents

- [Highlights](#highlights)
- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Tools reference](#tools-reference)
- [Multi-agent architecture](#multi-agent-architecture)
- [Extensibility](#extensibility)
- [Production features](#production-features)
- [Slash commands](#slash-commands)
- [Storage layout](#storage-layout)
- [Project structure](#project-structure)
- [Contributing](#contributing)

---

## Highlights

ZIP CODE is a TUI-first AI coding agent with everything you need for serious work:

- 🎨 **Ink + React TUI** — persistent header, scrolling transcript, status bar, modal panels
- 🤖 **Multi-agent** — orchestrator delegates to specialized sub-agents (coder, reviewer, debugger, researcher, writer) each with their own model and tools
- 🔌 **MCP client** — connect to any Model Context Protocol server; tools auto-register
- 🪝 **Hooks/middleware** — pre/post tool hooks for audit, validation, confirmation, arg rewriting
- ⚡ **Custom slash commands** — drop a markdown file, get a new command
- 🗄️ **SQL tools** — query SQLite databases (read-only by default)
- 💰 **Budget guards** — hard caps on USD, tokens, tool calls per session
- 📝 **Prompt templates** — 8 built-ins (review/refactor/debug/...) + user-defined
- 📤 **Conversation export** — Markdown, HTML (dark mode), JSON
- 🧠 **Persistent memory** — stable facts survive across sessions
- 🛡️ **Security** — path sanitization, dangerous-command detection, rate limiting, URL safety
- 📊 **Observability** — structured JSON logs, opt-in telemetry, usage tracking
- 🔁 **Resilience** — exponential-backoff retries, circuit breaker, cancellable requests
- 🐳 **Docker** — multi-stage Dockerfile + compose
- ✅ **Tested** — 147 passing tests across 12 suites

---

## Install

```bash
git clone https://github.com/ianns-astronot/Zip-Code.git
cd Zip-Code
npm install
npm run build
npm link            # optional — exposes `zipcode` globally
```

### Run

```bash
npm run dev         # tsx, hot start
zipcode             # if linked globally
node dist/index.js  # direct
```

### Docker

```bash
docker build -t zipcode .
docker run -it -e OPENAI_API_KEY=your-key zipcode
# or
docker-compose up
```

---

## Quick start

1. Launch with `zipcode` (or `npm run dev`).
2. Press **Ctrl+S** → fill in provider, API key, model.
3. Press **f** in the Model field to fetch available models from your provider.
4. Press **Ctrl+S** again to save.
5. Start chatting. The agent will call tools as needed.

### Keybinds

| Key       | Action                |
| --------- | --------------------- |
| `Ctrl+S`  | Settings panel        |
| `Ctrl+L`  | Session browser       |
| `Ctrl+N`  | New session           |
| `Ctrl+T`  | Tools panel           |
| `Ctrl+P`  | Profiles panel        |
| `Ctrl+M`  | Memory panel          |
| `Ctrl+B`  | Budget panel          |
| `Ctrl+E`  | Export panel          |
| `Esc`     | Cancel in-flight call |
| `Ctrl+C`  | Quit                  |

---

## Configuration

Two paths, both work:

### 1. In-app (recommended)

Press **Ctrl+S**. Values are saved to SQLite at `~/.zipcode/zipcode.db`.

### 2. Environment variables (fallback)

| Variable              | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `ZIPCODE_PROVIDER`    | `openai` or `custom`                                  |
| `OPENAI_API_KEY`      | API key (also `ZIPCODE_API_KEY`)                      |
| `ZIPCODE_BASE_URL`    | Custom OpenAI-compatible endpoint (Ollama, vLLM, …)   |
| `ZIPCODE_MODEL`       | Model name                                            |
| `ZIPCODE_MAX_TOKENS`  | Max tokens per response                               |
| `ZIPCODE_TEMPERATURE` | Sampling temperature                                  |

### Budget caps (optional)

```bash
export ZIPCODE_BUDGET_USD=5.00          # stop after $5 spent
export ZIPCODE_BUDGET_TOKENS=200000     # stop after 200k tokens
export ZIPCODE_BUDGET_TOOLCALLS=200     # stop after 200 tool calls
```

Soft warnings fire at 75% and 90% of each limit.

### Logging

```bash
export ZIPCODE_LOG_LEVEL=DEBUG          # DEBUG | INFO | WARN | ERROR | FATAL
export ZIPCODE_LOG_CONSOLE=true         # mirror to stderr
# Logs at: ~/.zipcode/logs/zipcode-YYYY-MM-DD.log
```

### Telemetry (opt-in)

```bash
export ZIPCODE_TELEMETRY=true           # local-only, ~/.zipcode/telemetry/
```

---

## Tools reference

ZIP CODE ships **33 native tools** plus dynamic MCP tools loaded at runtime.

### Filesystem & shell

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `read_file`    | Read a file's contents (cached)                   |
| `write_file`   | Write a file (creates parent directories)         |
| `list_dir`     | List a directory                                  |
| `execute_bash` | Run a shell command (rate-limited, 30 s timeout)  |
| `grep`         | Recursively search file contents with regex       |
| `glob`         | Find files matching a glob (`src/**/*.ts`)        |
| `ask_user`     | Ask the user — confirmation prompts               |

### Git (8)

| Tool         | Description                              |
| ------------ | ---------------------------------------- |
| `git_status` | Working-tree status                      |
| `git_diff`   | Staged or unstaged changes               |
| `git_log`    | Commit history                           |
| `git_branch` | List, create, switch, delete branches    |
| `git_commit` | Create a commit                          |
| `git_push`   | Push to remote                           |
| `git_pull`   | Pull from remote                         |
| `git_add`    | Stage files                              |

### Web (3)

| Tool            | Description                                     |
| --------------- | ----------------------------------------------- |
| `web_search`    | Search the web (DuckDuckGo, rate-limited)       |
| `http_request`  | HTTP GET/POST/PUT/DELETE (URL-safety checked)   |
| `download_file` | Download a file from URL                        |

### File watcher (3)

| Tool           | Description                          |
| -------------- | ------------------------------------ |
| `watch_file`   | Watch files/dirs for changes         |
| `stop_watch`   | Stop watching a path                 |
| `list_watches` | List active watches                  |

### Code analysis (4)

| Tool                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `analyze_complexity`   | Cyclomatic complexity per function       |
| `find_todos`           | TODO / FIXME / HACK / NOTE comments      |
| `analyze_dependencies` | Inspect package.json dependencies        |
| `count_lines`          | Lines of code by file type               |

### Database (2 — new in v2.5)

| Tool          | Description                                      |
| ------------- | ------------------------------------------------ |
| `sql_query`   | Execute SQL on a SQLite DB (read-only default)   |
| `sql_schema`  | Inspect tables, columns, indexes                 |

### Multi-agent (2 — new in v2.4)

| Tool            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `delegate_task` | Spawn a sub-agent with its own model and profile     |
| `list_profiles` | List available sub-agent profiles                    |

### Memory (4 — new in v2.4)

| Tool            | Description                            |
| --------------- | -------------------------------------- |
| `memory_add`    | Save a durable fact                    |
| `memory_search` | Search memory by keyword               |
| `memory_list`   | List entries (filter by category)      |
| `memory_remove` | Remove an entry by ID                  |

The agent uses OpenAI tool-calling and may chain or parallelize calls within a single turn. All tool execution flows through the [hook system](#hooks--middleware) for audit and validation.

---

## Multi-agent architecture

ZIP CODE can spawn specialized sub-agents with different models, profiles, and tool sets.

### Profiles

| Profile        | Purpose                                  | Tools                              |
| -------------- | ---------------------------------------- | ---------------------------------- |
| `general`      | Default coding assistant                 | All                                |
| `orchestrator` | Decomposes & delegates tasks             | `delegate_task` + read-only        |
| `coder`        | Writes/edits code (low temperature)      | All except `delegate_task`         |
| `reviewer`     | Reviews code (read-only, no execution)   | `read_file`, `grep`, `git_diff`, … |
| `debugger`     | Investigates bugs methodically           | All except `delegate_task`         |
| `researcher`   | Web search + docs                        | `web_search`, `http_request`, …    |
| `writer`       | Writes documentation                     | `read_file`, `write_file`, …       |

Use `delegate_task` to hand a focused subtask to the right specialist while keeping your main context clean.

### Persistent memory

Stable facts (preferences, project conventions, environment quirks) live at `~/.zipcode/memory.json`. Categories: `user`, `project`, `tech`, `preference`, `fact`.

### Workspace context

Drop one of `.zipcoderc`, `ZIPCODE.md`, `AGENTS.md`, or `.cursorrules` in your project root. ZIP CODE auto-loads it into the system prompt.

```yaml
---
name: my-app
language: TypeScript
test: pnpm test
build: pnpm build
---

Use functional React components, prefer named exports.
```

---

## Extensibility

### MCP client

Connect to any [Model Context Protocol](https://modelcontextprotocol.io) server. Their tools auto-register as `mcp__<server>__<tool>`.

`~/.zipcode/mcp-servers.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    {
      "name": "github",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_…" }
    }
  ]
}
```

### Hooks / middleware

Intercept every tool call. Audit, validate, confirm, or rewrite args before execution.

```ts
import { hookManager, registerAuditHook, registerValidationHook } from './src/hooks';

// Audit every tool call to a log
registerAuditHook();

// Block git_push without an explicit confirmation arg
registerValidationHook('git_push', (args) =>
  args.confirmed ? null : 'Set args.confirmed=true to push'
);

// Custom hook with regex tool filter
hookManager.register({
  event: 'pre-tool',
  toolFilter: /^(execute_bash|write_file)$/,
  fn: ({ toolName, args }) => {
    if (args.path?.startsWith('/etc/')) {
      return { block: true, blockReason: 'System paths are off-limits' };
    }
  },
});
```

Errors thrown inside hooks are logged but never crash the agent.

### Custom slash commands

Drop a markdown file in `~/.zipcode/commands/` (user-global) or `./.zipcode/commands/` (project-local). Project takes precedence.

`./.zipcode/commands/lint.md`:

```markdown
---
description: Run lint and format on the staged files
---
Run `npm run lint:fix` then `npm run format` and report any remaining issues.
```

Invoke with `/lint`. Variable substitution: `{{arg1}}`, `{{name}}`, `{{args}}`.

### Prompt templates

8 built-ins, plus your own. User templates at `~/.zipcode/prompts/<name>.md`, project at `./.zipcode/prompts/<name>.md`.

Built-ins: `review`, `refactor`, `debug`, `tests`, `explain`, `docs`, `optimize`, `security`.

Variable syntax: `{{name|default}}` — falls back to default if not provided.

### Conversation export

Export a session to Markdown, HTML (self-contained, dark mode), or JSON for sharing or archival. Supports time-range filters and toggles for hiding system/tool messages.

---

## Production features

### Security

- **Path sanitization** — blocks directory traversal when a base dir is set
- **Dangerous command detection** — flags `rm -rf`, `dd`, `mkfs`, etc. for confirmation
- **Rate limiting** — bash 30/min, web 20/min (configurable)
- **URL safety** — blocks private IPs and non-HTTP protocols by default
- **Result caching** — file reads cached with TTL to reduce duplicate I/O
- **Secret redaction** — JSON logs auto-strip API keys and tokens

### Observability

- **Structured JSON logs** at `~/.zipcode/logs/zipcode-YYYY-MM-DD.log`
- **5 log levels** — DEBUG, INFO, WARN, ERROR, FATAL
- **Opt-in telemetry** — local-only, OFF by default, never phones home
- **Usage tracking** — token counts and cost estimates per session

### Resilience

- **Retry with exponential backoff** — auto-retries 429s, 5xx, network errors
- **Circuit breaker** — fails fast after repeated failures, auto-recovers
- **Cancellable requests** — Esc cancels the in-flight call cleanly

### Testing

- 147 tests across 12 suites — security, code analysis, watcher, hooks, budget guard, prompt templates, conversation export, …
- Run with `npm test`

---

## Slash commands

Type these in the input bar:

| Command                    | Action                                       |
| -------------------------- | -------------------------------------------- |
| `/help`                    | Show keybinds and commands                   |
| `/new`                     | Start a new session                          |
| `/sessions`                | Open the session browser                     |
| `/settings`                | Open the settings panel                      |
| `/clear`                   | Clear the visible transcript                 |
| `/quit`, `/exit`           | Quit                                         |
| `/tools`                   | Browse all native + MCP tools                |
| `/profiles`                | Browse the 7 agent profiles                  |
| `/templates`               | Browse prompt templates                      |
| `/template <name> [vars]`  | Render a template and send                   |
| `/memory`                  | Browse persistent memory                     |
| `/mcp`                     | Show connected MCP servers                   |
| `/budget`                  | Show budget usage                            |
| `/budget reset`            | Reset budget counters                        |
| `/export`                  | Export the current conversation              |
| `/<custom>`                | Any custom command from `.zipcode/commands/` |

---

## Storage layout

```
~/.zipcode/
├── zipcode.db                # SQLite — sessions, messages, app config
├── memory.json               # Persistent agent memory
├── mcp-servers.json          # MCP server config
├── commands/                 # User-global slash commands
├── prompts/                  # User-global prompt templates
├── logs/
│   └── zipcode-YYYY-MM-DD.log
└── telemetry/                # Local-only, opt-in
```

SQLite tables:

- `sessions` — id, title, timestamps, model, provider
- `messages` — id, session_id, role, content, tool metadata, created_at
- `app_config` — key/value store for in-app settings

Project-local (in your repo):

```
.zipcode/
├── commands/                 # Project slash commands
└── prompts/                  # Project prompt templates
```

---

## Project structure

```
src/
├── index.tsx                 # Ink bootstrap
├── agent.ts                  # ReAct loop + tool calling + event emitter
├── tools.ts                  # Tool orchestrator + JSON schemas
├── store.ts                  # SQLite (better-sqlite3) layer
├── config.ts                 # Config load/save (DB-backed + env fallback)
├── types.ts                  # Shared types
│
├── git-tools.ts              # Git tools (8)
├── web-tools.ts              # Web tools (3)
├── watcher-tools.ts          # File watcher (3)
├── code-analysis-tools.ts    # Code analysis (4)
├── database-tools.ts         # SQL tools (2) — v2.5
├── memory-tools.ts           # Memory tools (4) — v2.4
├── sub-agent.ts              # delegate_task + profiles — v2.4
├── agent-profiles.ts         # Profile definitions — v2.4
│
├── mcp-client.ts             # MCP client — v2.5
├── hooks.ts                  # Hook/middleware system — v2.5
├── slash-commands.ts         # Custom slash commands — v2.5
├── prompt-templates.ts       # Prompt template library — v2.5
├── conversation-export.ts    # MD/HTML/JSON export — v2.5
├── budget-guard.ts           # Budget caps — v2.5
│
├── security.ts               # Sanitize, rate limit, cache — v2.1+
├── logger.ts                 # Structured JSON logging — v2.3
├── telemetry.ts              # Opt-in local telemetry — v2.3
├── resilience.ts             # Retry + circuit breaker — v2.4
├── usage-tracker.ts          # Token/cost tracking — v2.4
├── workspace.ts              # Workspace context loader — v2.4
│
└── ui/
    ├── App.tsx               # Root component, modal & keybind logic
    ├── Header.tsx            # Top bar (provider/model/session/cwd)
    ├── MessageView.tsx       # Chat transcript with markdown
    ├── InputBar.tsx          # Text input
    ├── StatusBar.tsx         # Spinner / hints / errors
    ├── ToolCallView.tsx      # Tool call visualization
    ├── ConfigPanel.tsx       # Ctrl+S settings modal
    ├── SessionList.tsx       # Ctrl+L session browser
    ├── Banner.tsx            # Gradient ASCII banner
    ├── markdown.ts           # Inline markdown renderer
    └── theme.ts              # Color tokens

test/                         # 147 tests across 12 suites
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR process. Bug reports and feature requests welcome via GitHub Issues.

Security issues: see [SECURITY.md](SECURITY.md) for responsible disclosure.

Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Version history

See [CHANGELOG.md](CHANGELOG.md) for the full release log.

- **v2.7.0** — TUI polish & streaming visibility: StreamingIndicator with stall detection, blinking cursor, role icons, 30+ tool icons, refined StatusBar/InputBar/Banner
- **v2.6.0** — TUI feature discovery: 7 new in-app panels (tools, profiles, templates, budget, memory, MCP, export), enhanced header badges, expanded slash commands & keybinds
- **v2.5.0** — MCP client, hooks, custom slash commands, SQL tools, budget guards, prompt templates, conversation export
- **v2.4.0** — Multi-agent architecture (sub-agents, profiles, memory, workspace, resilience)
- **v2.3.0** — Production hardening (logging, telemetry, Docker, docs, tests)
- **v2.2.0** — Code analysis tools
- **v2.1.0** — Git, web, file watcher tools + security
- **v2.0.0** — Ink TUI rewrite

---

## License

MIT
