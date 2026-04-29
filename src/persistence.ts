// Conversation persistence utilities

import { writeFile as fsWriteFile, readFile as fsReadFile, existsSync } from 'fs';
import { promisify } from 'util';
import { resolve } from 'path';
import type { Message } from './types';

const writeFileAsync = promisify(fsWriteFile);
const readFileAsync = promisify(fsReadFile);

export interface ConversationData {
  timestamp: string;
  messages: Message[];
  metadata: {
    model: string;
    totalMessages: number;
    toolExecutions: number;
  };
}

// Get conversation file path
function getConversationPath(id?: string): string {
  const conversationId = id || new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(process.cwd(), `.zipcode-conversations`, `${conversationId}.json`);
}

// Save conversation to disk
export async function saveConversation(
  messages: Message[],
  metadata: ConversationData['metadata']
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const data: ConversationData = {
      timestamp: new Date().toISOString(),
      messages,
      metadata,
    };

    const path = getConversationPath();
    
    // Ensure directory exists
    const { mkdirSync } = await import('fs');
    const { dirname } = await import('path');
    const dir = dirname(path);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await writeFileAsync(path, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path };
  } catch (error) {
    return {
      success: false,
      error: `Failed to save conversation: ${error}`,
    };
  }
}

// Load conversation from disk
export async function loadConversation(
  id: string
): Promise<{ success: boolean; data?: ConversationData; error?: string }> {
  try {
    const path = getConversationPath(id);

    if (!existsSync(path)) {
      return {
        success: false,
        error: `Conversation not found: ${id}`,
      };
    }

    const content = await readFileAsync(path, 'utf-8');
    const data: ConversationData = JSON.parse(content);

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load conversation: ${error}`,
    };
  }
}

// List all saved conversations
export async function listConversations(): Promise<{
  success: boolean;
  conversations?: Array<{ id: string; timestamp: string; messageCount: number }>;
  error?: string;
}> {
  try {
    const { readdirSync } = await import('fs');
    const { resolve } = await import('path');

    const dir = resolve(process.cwd(), '.zipcode-conversations');

    if (!existsSync(dir)) {
      return { success: true, conversations: [] };
    }

    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

    const conversations = await Promise.all(
      files.map(async (file) => {
        const id = file.replace('.json', '');
        const path = resolve(dir, file);
        const content = await readFileAsync(path, 'utf-8');
        const data: ConversationData = JSON.parse(content);

        return {
          id,
          timestamp: data.timestamp,
          messageCount: data.messages.length,
        };
      })
    );

    return { success: true, conversations };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list conversations: ${error}`,
    };
  }
}

// Export conversation to markdown
export function exportToMarkdown(messages: Message[]): string {
  let markdown = '# ZIP CODE Conversation\n\n';
  markdown += `*Exported: ${new Date().toLocaleString()}*\n\n`;
  markdown += '---\n\n';

  for (const message of messages) {
    if (message.role === 'system') continue;

    if (message.role === 'user') {
      markdown += `## 👤 User\n\n${message.content}\n\n`;
    } else if (message.role === 'assistant') {
      markdown += `## 🤖 ZIP CODE\n\n${message.content}\n\n`;
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        markdown += '### Tools Used:\n\n';
        for (const tool of message.tool_calls) {
          markdown += `- **${tool.function.name}**\n`;
          markdown += `  \`\`\`json\n  ${tool.function.arguments}\n  \`\`\`\n\n`;
        }
      }
    } else if (message.role === 'tool') {
      markdown += `### 🔧 Tool Result: ${message.name}\n\n`;
      markdown += `\`\`\`\n${message.content}\n\`\`\`\n\n`;
    }

    markdown += '---\n\n';
  }

  return markdown;
}
