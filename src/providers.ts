// Provider helpers — fetch model lists, validate connections.

import type { ProviderConfig } from './config.js';

export interface ModelInfo {
  id: string;
  raw?: any;
}

export async function fetchModels(
  provider: Pick<ProviderConfig, 'type' | 'apiKey' | 'baseURL'>
): Promise<string[]> {
  if (!provider.apiKey) {
    throw new Error('API key required to fetch models.');
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: provider.apiKey,
    ...(provider.type === 'custom' && provider.baseURL
      ? { baseURL: provider.baseURL }
      : {}),
  });

  const res: any = await client.models.list();
  const ids: string[] = res.data.map((m: any) => m.id);

  if (provider.type === 'openai') {
    return ids
      .filter((id) => id.includes('gpt') || id.startsWith('o1') || id.startsWith('o3'))
      .sort();
  }
  return ids.sort();
}
