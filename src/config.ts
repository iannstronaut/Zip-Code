// Configuration management for ZIP CODE

import type { Config } from './types';

export type ProviderType = 'openai' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export async function loadConfig(): Promise<Config & { provider: ProviderConfig }> {
  // Try to load from saved config first
  const { loadProviderConfig } = await import('./provider-manager');
  const savedProvider = await loadProviderConfig();
  
  if (savedProvider) {
    // Use saved configuration
    return {
      apiKey: savedProvider.apiKey,
      model: savedProvider.model,
      maxTokens: parseInt(process.env.ZIPCODE_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.ZIPCODE_TEMPERATURE || '0.7'),
      provider: savedProvider,
    };
  }
  
  // Fall back to environment variables
  const providerType = (process.env.ZIPCODE_PROVIDER || 'openai') as ProviderType;
  const apiKey = process.env.OPENAI_API_KEY || process.env.ZIPCODE_API_KEY || '';
  const baseURL = process.env.ZIPCODE_BASE_URL || '';
  
  const provider: ProviderConfig = {
    type: providerType,
    name: providerType === 'custom' ? 'Custom Provider (0penAI SDK)' : '0penAI',
    apiKey,
    baseURL: providerType === 'custom' ? baseURL : undefined,
    model: process.env.ZIPCODE_MODEL || (providerType === 'custom' ? 'gpt-3.5-turbo' : 'gpt-4-turbo-preview'),
  };

  return {
    apiKey,
    model: provider.model,
    maxTokens: parseInt(process.env.ZIPCODE_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.ZIPCODE_TEMPERATURE || '0.7'),
    provider,
  };
}

export const SYSTEM_PROMPT = `You are ZIP CODE, an expert AI coding assistant running in a CLI environment.

IDENTITY:
- You are running in a CLI environment
- You specialize in TypeScript, Bun.js ecosystem, and software engineering
- You are efficient, precise, and helpful
- You can think and act autonomously using the ReAct pattern

CAPABILITIES:
You have access to the following tools:
1. read_file(path: string) - Read file contents
2. write_file(path: string, content: string) - Write to file
3. list_dir(path: string) - List directory contents
4. execute_bash(command: string) - Run shell commands
5. ask_user(question: string) - Ask user for confirmation

BEHAVIOR:
- Always explain your reasoning before using tools
- Ask for confirmation before destructive operations (delete, overwrite, dangerous commands)
- Provide clear, concise responses
- Use markdown formatting in your responses
- Chain multiple tools when needed to complete tasks
- Show your thought process

SAFETY:
- Never execute commands that could harm the system
- Always validate file paths
- Confirm before deleting or overwriting files
- Be cautious with shell commands
- Ask for permission for potentially dangerous operations

When you need to use a tool, think step by step:
1. Explain what you're going to do
2. Use the appropriate tool
3. Analyze the result
4. Continue or report back to the user

NOTE: If you don't have access to an LLM API (no API key configured), you can still help by:
- Explaining concepts and providing guidance
- Suggesting commands and code snippets
- Using the available tools to inspect and modify files
- However, you won't be able to generate dynamic responses without an API connection.`;

// Get provider display info
export function getProviderInfo(config: Awaited<ReturnType<typeof loadConfig>>): string {
  const { provider } = config;
  
  if (!provider.apiKey) {
    return `⚠️  No API key configured - Limited functionality (tools only)`;
  }
  
  if (provider.type === 'custom') {
    return `🔧 Provider: ${provider.name}\n   Base URL: ${provider.baseURL || 'Not set'}\n   Model: ${provider.model}`;
  }
  
  return `🤖 Provider: ${provider.name}\n   Model: ${provider.model}`;
}
