// Agent core - ReAct loop and LLM integration

import OpenAI from 'openai';
import type { Message, ToolCall } from './types';
import { TOOLS, executeTool } from './tools';
import { SYSTEM_PROMPT, loadConfig } from './config';
import { printAssistant, printTool, printToolResult, createSpinner, printError, printSystem } from './ui';
import { saveConversation, loadConversation, exportToMarkdown } from './persistence';

export class Agent {
  private openai: any;
  private messages: Message[] = [];
  private config: any;
  private toolExecutionCount: number = 0;

  private constructor(config: any, openaiClient: any) {
    this.config = config;
    this.openai = openaiClient;

    // Initialize with system prompt
    this.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });
  }

  // Static factory method
  static async create(): Promise<Agent> {
    const config = await loadConfig();
    let openaiClient = null;
    
    // Only initialize OpenAI if API key is provided
    if (config.apiKey) {
      const { default: OpenAILib } = await import('openai');
      const clientConfig: any = {
        apiKey: config.apiKey,
      };
      
      // Add baseURL for custom provider
      if (config.provider.type === 'custom' && config.provider.baseURL) {
        clientConfig.baseURL = config.provider.baseURL;
      }
      
      openaiClient = new OpenAILib(clientConfig);
    }
    
    return new Agent(config, openaiClient);
  }

  // Reinitialize with new config
  async reinitialize(newConfig: any): Promise<void> {
    this.config = newConfig;
    
    // Reinitialize OpenAI client
    if (this.config.apiKey) {
      const { default: OpenAILib } = await import('openai');
      const clientConfig: any = {
        apiKey: this.config.apiKey,
      };
      
      if (this.config.provider.type === 'custom' && this.config.provider.baseURL) {
        clientConfig.baseURL = this.config.provider.baseURL;
      }
      
      this.openai = new OpenAILib(clientConfig);
    } else {
      this.openai = null;
    }
    
    // Keep conversation history but update system prompt
    this.messages[0] = {
      role: 'system',
      content: SYSTEM_PROMPT,
    };
  }

  // Get current config
  getConfig(): any {
    return this.config;
  }

  // Add user message
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
    });
  }

  // Get conversation history
  getHistory(): Message[] {
    return this.messages;
  }

  // Clear conversation (keep system prompt)
  clearHistory(): void {
    this.messages = [this.messages[0]];
    this.toolExecutionCount = 0;
  }

  // Save conversation to disk
  async saveConversation(): Promise<{ success: boolean; path?: string; error?: string }> {
    return saveConversation(this.messages, {
      model: this.config.model,
      totalMessages: this.messages.length,
      toolExecutions: this.toolExecutionCount,
    });
  }

  // Load conversation from disk
  async loadConversation(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await loadConversation(id);
    
    if (result.success && result.data) {
      this.messages = result.data.messages;
      this.toolExecutionCount = result.data.metadata.toolExecutions;
      return { success: true };
    }
    
    return { success: false, error: result.error };
  }

  // Export conversation to markdown
  exportToMarkdown(): string {
    return exportToMarkdown(this.messages);
  }

  // Main agent loop - processes user input and executes ReAct loop
  async processMessage(userInput: string): Promise<void> {
    this.addUserMessage(userInput);
    this.toolExecutionCount = 0;

    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 10;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;

      try {
        const spinner = createSpinner('ZIP CODE is thinking...');
        spinner.start();

        // Call LLM
        const response = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: this.messages as any,
          tools: TOOLS as any,
          tool_choice: 'auto',
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: false,
        });

        spinner.stop();

        const assistantMessage = response.choices[0].message;

        // Check if there are tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          // Add assistant message with tool calls
          this.messages.push({
            role: 'assistant',
            content: assistantMessage.content || '',
            tool_calls: assistantMessage.tool_calls as any,
          });

          // Show reasoning if present
          if (assistantMessage.content) {
            printAssistant(assistantMessage.content);
          }

          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs: any;
            
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (error) {
              printError(`Failed to parse tool arguments: ${toolCall.function.arguments}`);
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: 'Error: Invalid tool arguments format',
              });
              continue;
            }

            printTool(toolName, toolArgs);

            const toolSpinner = createSpinner(`Executing ${toolName}...`);
            toolSpinner.start();

            this.toolExecutionCount++;
            const result = await executeTool(toolName, toolArgs);

            toolSpinner.stop();
            printToolResult(result);

            // Add tool result to messages
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: result.success ? result.output : `Error: ${result.error || 'Tool execution failed'}`,
            });
          }

          // Continue loop to let LLM process tool results
          continueLoop = true;
        } else {
          // No tool calls, just a regular response
          this.messages.push({
            role: 'assistant',
            content: assistantMessage.content || '',
          });

          if (assistantMessage.content) {
            printAssistant(assistantMessage.content);
          }

          // End loop
          continueLoop = false;
        }
      } catch (error: any) {
        if (error.code === 'insufficient_quota') {
          printError('API quota exceeded. Please check your OpenAI account.');
        } else if (error.code === 'invalid_api_key') {
          printError('Invalid API key. Please check your OPENAI_API_KEY environment variable.');
        } else if (error.message?.includes('timeout')) {
          printError('Request timed out. Please try again.');
        } else {
          printError(`API Error: ${error.message || 'Unknown error'}`);
        }
        continueLoop = false;
      }
    }

    if (iterationCount >= maxIterations) {
      printError('Maximum iterations reached. The agent may be stuck in a loop.');
      printSystem(`Total tool executions: ${this.toolExecutionCount}`);
    }
  }

  // Process message with streaming (for Milestone 4)
  async processMessageStreaming(userInput: string): Promise<void> {
    if (userInput) {
      this.addUserMessage(userInput);
    }
    this.toolExecutionCount = 0;

    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 10;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;

      try {
        const spinner = createSpinner('ZIP CODE is thinking...');
        spinner.start();

        const stream = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: this.messages as any,
          tools: TOOLS as any,
          tool_choice: 'auto',
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true,
        });

        spinner.stop();

        let fullContent = '';
        let toolCalls: any[] = [];

        console.log('\n\x1b[36mZIP CODE:\x1b[0m ');

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            process.stdout.write(delta.content);
            fullContent += delta.content;
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                }
                
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        }

        if (fullContent) {
          console.log('\n');
        }

        // Add assistant message
        if (toolCalls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: fullContent,
            tool_calls: toolCalls as any,
          });

          // Execute tools
          for (const toolCall of toolCalls) {
            if (toolCall.function && toolCall.function.name) {
              const toolName = toolCall.function.name;
              let toolArgs: any;
              
              try {
                toolArgs = JSON.parse(toolCall.function.arguments);
              } catch (error) {
                printError(`Failed to parse tool arguments`);
                continue;
              }

              printTool(toolName, toolArgs);

              this.toolExecutionCount++;
              const result = await executeTool(toolName, toolArgs);
              printToolResult(result);

              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: result.success ? result.output : `Error: ${result.error || 'Tool execution failed'}`,
              });
            }
          }

          // Continue loop
          continueLoop = true;
        } else {
          this.messages.push({
            role: 'assistant',
            content: fullContent,
          });
          continueLoop = false;
        }
      } catch (error: any) {
        if (error.code === 'insufficient_quota') {
          printError('API quota exceeded. Please check your OpenAI account.');
        } else if (error.code === 'invalid_api_key') {
          printError('Invalid API key. Please check your OPENAI_API_KEY environment variable.');
        } else {
          printError(`API Error: ${error.message || 'Unknown error'}`);
        }
        continueLoop = false;
      }
    }

    if (iterationCount >= maxIterations) {
      printError('Maximum iterations reached.');
    }
  }
}

