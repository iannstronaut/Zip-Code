// Configuration management for ZIP CODE
// Active provider is now stored in the `providers` table; the pointer to it
// lives in `app_config.activeProviderId`. Legacy single-row config is migrated
// on first read.

import type { Config, ProviderRecord } from './types.js';
import {
  getActiveProvider,
  getAllConfig,
  getConfigValue,
  listProviders,
  setActiveProvider,
  setConfigValue,
  upsertProvider,
} from './store.js';

export type ProviderType = 'openai' | 'custom';

export interface ProviderConfig {
  id?: string;
  type: ProviderType;
  name: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface AppConfig extends Config {
  provider: ProviderConfig;
  providerId?: string;
}

const DEFAULTS = {
  maxTokens: 4096,
  temperature: 0.7,
};

// Migrate legacy single-provider config (stored under `provider.*` keys) into
// the `providers` table. Idempotent.
function migrateLegacyProviderIfNeeded(): ProviderRecord | null {
  // If there's already at least one provider row, nothing to migrate.
  const existing = listProviders();
  if (existing.length > 0) return existing[0];

  const stored = getAllConfig();
  const apiKey = stored['provider.apiKey'];
  const model = stored['provider.model'];
  if (!apiKey && !model) return null;

  const type = (stored['provider.type'] || 'openai') as ProviderType;
  const name =
    stored['provider.name'] ||
    (type === 'custom' ? 'Custom Provider (OpenAI SDK)' : 'OpenAI');
  const baseURL = stored['provider.baseURL'] || undefined;

  const rec = upsertProvider({
    name,
    type,
    apiKey: apiKey || '',
    baseURL: type === 'custom' ? baseURL : undefined,
    model: model || (type === 'custom' ? 'gpt-3.5-turbo' : 'gpt-4-turbo-preview'),
  });
  setActiveProvider(rec.id);
  return rec;
}

function bootstrapFromEnvIfNeeded(): ProviderRecord | null {
  const existing = listProviders();
  if (existing.length > 0) return existing[0];

  const type =
    (process.env.ZIPCODE_PROVIDER as ProviderType | undefined) || 'openai';
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.ZIPCODE_API_KEY || '';
  if (!apiKey) return null;

  const rec = upsertProvider({
    name: type === 'custom' ? 'Custom Provider (OpenAI SDK)' : 'OpenAI',
    type,
    apiKey,
    baseURL: type === 'custom' ? process.env.ZIPCODE_BASE_URL : undefined,
    model:
      process.env.ZIPCODE_MODEL ||
      (type === 'custom' ? 'gpt-3.5-turbo' : 'gpt-4-turbo-preview'),
  });
  setActiveProvider(rec.id);
  return rec;
}

function recordToConfig(rec: ProviderRecord): ProviderConfig {
  return {
    id: rec.id,
    type: rec.type as ProviderType,
    name: rec.name,
    apiKey: rec.apiKey,
    baseURL: rec.baseURL,
    model: rec.model,
  };
}

function emptyProvider(): ProviderConfig {
  return {
    type: 'openai',
    name: 'OpenAI',
    apiKey: '',
    model: 'gpt-4-turbo-preview',
  };
}

export function loadConfigSync(): AppConfig {
  // 1) migrate / bootstrap if necessary
  migrateLegacyProviderIfNeeded();
  bootstrapFromEnvIfNeeded();

  // 2) determine active provider
  let active = getActiveProvider();
  if (!active) {
    const all = listProviders();
    if (all.length > 0) {
      setActiveProvider(all[0].id);
      active = all[0];
    }
  }

  const provider = active ? recordToConfig(active) : emptyProvider();

  const stored = getAllConfig();
  const maxTokens = Number(
    stored['app.maxTokens'] || process.env.ZIPCODE_MAX_TOKENS || DEFAULTS.maxTokens
  );
  const temperature = Number(
    stored['app.temperature'] ||
      process.env.ZIPCODE_TEMPERATURE ||
      DEFAULTS.temperature
  );

  return {
    apiKey: provider.apiKey,
    model: provider.model,
    maxTokens,
    temperature,
    provider,
    providerId: provider.id,
  };
}

export async function loadConfig(): Promise<AppConfig> {
  return loadConfigSync();
}

// Save provider AND/OR app-level numeric settings.
// If `cfg.provider` is given, it's persisted as a provider row and made active.
export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  if (cfg.provider) {
    const rec = upsertProvider({
      id: cfg.provider.id,
      name: cfg.provider.name,
      type: cfg.provider.type,
      apiKey: cfg.provider.apiKey,
      baseURL:
        cfg.provider.type === 'custom' ? cfg.provider.baseURL : undefined,
      model: cfg.provider.model,
    });
    setActiveProvider(rec.id);
  }
  if (typeof cfg.maxTokens === 'number') {
    setConfigValue('app.maxTokens', String(cfg.maxTokens));
  }
  if (typeof cfg.temperature === 'number') {
    setConfigValue('app.temperature', String(cfg.temperature));
  }
  return loadConfigSync();
}

export function setActiveProviderId(id: string): AppConfig {
  setActiveProvider(id);
  return loadConfigSync();
}

export function setConfigField(key: string, value: string): void {
  setConfigValue(key, value);
}

export function getConfigField(key: string): string | null {
  return getConfigValue(key);
}

export const SYSTEM_PROMPT = `You are ZIP CODE, an expert AI coding assistant running in a modern Terminal UI.

IDENTITY:
- You run inside an Ink-powered TUI on the user's machine.
- You specialize in TypeScript, Node/Bun ecosystems, and software engineering.
- You are efficient, precise, and helpful.
- You think and act autonomously using the ReAct pattern with tool calling.

CAPABILITIES:
You have access to the following tools (called via OpenAI-compatible tool calling):
1. read_file(path)            - Read file contents
2. write_file(path, content)  - Write to a file (creates or overwrites)
3. list_dir(path?)            - List a directory
4. execute_bash(command)      - Run a shell command
5. grep(pattern, path?)       - Search file contents using a regex
6. glob(pattern, path?)       - Find files matching a glob pattern
7. ask_user(question)         - Ask the user for input/confirmation

BEHAVIOR:
- Briefly explain your plan, then call tools.
- Chain multiple tool calls when needed; you may call tools in parallel.
- Ask for confirmation before destructive operations (delete, overwrite, dangerous shell commands).
- Provide clear, concise responses with markdown formatting.
- After tools return, summarize the result for the user.

SAFETY:
- Never execute commands that could harm the system.
- Validate paths and ask before deleting or overwriting important files.
- Be cautious with shell commands; prefer dry-run or list-style commands first.

If no API key is configured, you can only echo guidance — tools won't be invoked by an LLM.`;

export function getProviderInfo(config: AppConfig): string {
  const { provider } = config;

  if (!provider.apiKey) {
    return 'No API key configured — Press Ctrl+S to open Settings';
  }

  if (provider.type === 'custom') {
    return `Provider: ${provider.name}  •  ${provider.baseURL || '?'}  •  ${provider.model}`;
  }

  return `Provider: ${provider.name}  •  ${provider.model}`;
}
