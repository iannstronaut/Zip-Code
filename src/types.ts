// Type definitions for ZIP CODE

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Config {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ConversationHistory {
  messages: Message[];
  addMessage(message: Message): void;
  getMessages(): Message[];
  clear(): void;
}

// UI-level enriched message used by the TUI
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  // For assistant messages emitting tool calls
  toolCalls?: ToolCall[];
  // For tool messages — link back to the call
  toolCallId?: string;
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
  toolArgs?: any;
  // Streaming flag — true while content is still being streamed in
  streaming?: boolean;
}

export interface SessionRow {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
  messageCount: number;
}

export interface ProviderRecord {
  id: string;
  name: string;
  type: string; // 'openai' | 'custom'
  apiKey: string;
  baseURL?: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}
