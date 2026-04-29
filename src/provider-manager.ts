// Provider management utilities

import enquirer from 'enquirer';
import { writeFile as fsWriteFile, readFile as fsReadFile, existsSync } from 'fs';
import { promisify } from 'util';
import { resolve } from 'path';
import type { ProviderConfig } from './config';
import { printSystem, printError, printSuccess, colors } from './ui';

const writeFileAsync = promisify(fsWriteFile);
const readFileAsync = promisify(fsReadFile);

const CONFIG_FILE = resolve(process.cwd(), '.zipcode-config.json');

interface SavedConfig {
  provider: ProviderConfig;
  lastUpdated: string;
}

// Save provider config to file
export async function saveProviderConfig(provider: ProviderConfig): Promise<void> {
  const config: SavedConfig = {
    provider,
    lastUpdated: new Date().toISOString(),
  };
  
  await writeFileAsync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// Load provider config from file
export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    
    const content = await readFileAsync(CONFIG_FILE, 'utf-8');
    const config: SavedConfig = JSON.parse(content);
    return config.provider;
  } catch (error) {
    return null;
  }
}

// Fetch available models from OpenAI
async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    const response = await client.models.list();
    
    // Filter for GPT models only
    const models = response.data
      .filter(model => model.id.includes('gpt'))
      .map(model => model.id)
      .sort();
    
    return models.length > 0 ? models : [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-4-32k',
    ];
  } catch (error) {
    // Return default models if API call fails
    return [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-4-32k',
    ];
  }
}

// Fetch available models from custom provider
async function fetchCustomModels(baseURL: string, apiKey: string): Promise<string[]> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ 
      apiKey,
      baseURL,
    });
    const response = await client.models.list();
    
    const models = response.data.map(model => model.id).sort();
    return models.length > 0 ? models : ['gpt-3.5-turbo'];
  } catch (error) {
    printError(`Failed to fetch models: ${error}`);
    return ['gpt-3.5-turbo'];
  }
}

// Interactive provider setup
export async function interactiveProviderSetup(): Promise<ProviderConfig | null> {
  try {
    console.log('\n' + colors.info('🔧 Provider Configuration\n'));
    
    // Step 1: Choose provider type
    const providerChoice: any = await enquirer.prompt({
      type: 'select',
      name: 'type',
      message: 'Select LLM Provider:',
      choices: [
        { name: 'openai', message: '🤖 OpenAI (GPT-4, GPT-3.5)' },
        { name: 'custom', message: '🔧 Custom Provider (OpenAI SDK Compatible)' },
      ],
    });
    
    const providerType = providerChoice.type;
    
    if (providerType === 'openai') {
      // OpenAI setup
      console.log('\n' + colors.dim('Setting up OpenAI provider...\n'));
      
      const apiKeyInput: any = await enquirer.prompt({
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenAI API Key:',
        validate: (input: string) => input.length > 0 || 'API key is required',
      });
      
      const apiKey = apiKeyInput.apiKey;
      
      // Fetch available models
      printSystem('Fetching available models...');
      const models = await fetchOpenAIModels(apiKey);
      
      const modelChoice: any = await enquirer.prompt({
        type: 'select',
        name: 'model',
        message: 'Select Model:',
        choices: models.map(model => ({
          name: model,
          message: model,
        })),
      });
      
      const provider: ProviderConfig = {
        type: 'openai',
        name: 'OpenAI',
        apiKey,
        model: modelChoice.model,
      };
      
      return provider;
      
    } else {
      // Custom provider setup
      console.log('\n' + colors.dim('Setting up Custom Provider...\n'));
      
      const customInputs: any = await enquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter Base URL (e.g., http://localhost:1234/v1):',
          validate: (input: string) => input.length > 0 || 'Base URL is required',
        },
        {
          type: 'input',
          name: 'apiKey',
          message: 'Enter API Key:',
          initial: 'not-needed',
        },
      ]);
      
      const { baseURL, apiKey } = customInputs;
      
      // Fetch available models
      printSystem('Fetching available models from custom provider...');
      const models = await fetchCustomModels(baseURL, apiKey);
      
      const modelChoice: any = await enquirer.prompt({
        type: 'select',
        name: 'model',
        message: 'Select Model:',
        choices: models.map(model => ({
          name: model,
          message: model,
        })),
      });
      
      const provider: ProviderConfig = {
        type: 'custom',
        name: 'Custom Provider (OpenAI SDK)',
        apiKey,
        baseURL,
        model: modelChoice.model,
      };
      
      return provider;
    }
    
  } catch (error: any) {
    if (error.message === 'cancelled' || error.message.includes('cancel')) {
      printSystem('Provider setup cancelled');
      return null;
    }
    printError(`Setup failed: ${error.message}`);
    return null;
  }
}

// Show current provider info
export function displayProviderInfo(provider: ProviderConfig): void {
  console.log('\n' + colors.info('📋 Current Provider Configuration:\n'));
  console.log(colors.dim('  Provider Type: ') + colors.assistant(provider.type));
  console.log(colors.dim('  Provider Name: ') + colors.assistant(provider.name));
  console.log(colors.dim('  Model: ') + colors.assistant(provider.model));
  
  if (provider.type === 'custom' && provider.baseURL) {
    console.log(colors.dim('  Base URL: ') + colors.assistant(provider.baseURL));
  }
  
  console.log(colors.dim('  API Key: ') + colors.dim('••••••••' + provider.apiKey.slice(-4)));
  console.log();
}

// Provider management menu
export async function providerManagementMenu(currentProvider: ProviderConfig | null): Promise<{
  action: 'change' | 'view' | 'cancel';
  provider?: ProviderConfig;
}> {
  try {
    if (currentProvider) {
      displayProviderInfo(currentProvider);
    } else {
      console.log('\n' + colors.error('⚠️  No provider configured\n'));
    }
    
    const menuChoice: any = await enquirer.prompt({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'change', message: '🔄 Change Provider' },
        { name: 'view', message: '👁️  View Current Config' },
        { name: 'cancel', message: '❌ Cancel' },
      ],
    });
    
    if (menuChoice.action === 'change') {
      const newProvider = await interactiveProviderSetup();
      if (newProvider) {
        return { action: 'change', provider: newProvider };
      }
    } else if (menuChoice.action === 'view') {
      if (currentProvider) {
        displayProviderInfo(currentProvider);
      }
      return { action: 'view' };
    }
    
    return { action: 'cancel' };
    
  } catch (error: any) {
    if (error.message === 'cancelled' || error.message.includes('cancel')) {
      return { action: 'cancel' };
    }
    printError(`Menu error: ${error.message}`);
    return { action: 'cancel' };
  }
}

