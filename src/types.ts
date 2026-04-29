// Type definitions for ZIP CODE

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
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
