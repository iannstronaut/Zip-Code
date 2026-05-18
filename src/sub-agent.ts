// Sub-agent delegation system
// Allows the main agent to spawn specialized child agents with different
// models, profiles, and isolated contexts.

import type { ToolDefinition, ToolResult, ChatMessage } from './types.js';
import {
  AGENT_PROFILES,
  filterToolsForProfile,
  getProfile,
  listProfiles,
  type ProfileName,
} from './agent-profiles.js';
import { logger } from './logger.js';

export interface SubAgentTask {
  goal: string;
  context?: string;
  profile?: ProfileName;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: number;
}

export interface SubAgentResult {
  success: boolean;
  output: string;
  error?: string;
  profile?: string;
  model?: string;
  iterations?: number;
  durationMs?: number;
}

// Tool definitions for delegation
export const DELEGATION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'delegate_task',
      description:
        'Spawn a sub-agent to handle a focused subtask. The sub-agent runs in its own isolated context with its own model and tools. Returns only the final summary - intermediate tool results stay out of your context. Use this for: reasoning-heavy subtasks, parallel independent workstreams, or tasks that would flood your context. ' +
        'Available profiles: ' +
        listProfiles().join(', '),
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description:
              'What the sub-agent should accomplish. Be specific and self-contained — the sub-agent does not see your conversation history.',
          },
          context: {
            type: 'string',
            description:
              'Background info the sub-agent needs: file paths, error messages, project structure, constraints. The more specific, the better the result.',
          },
          profile: {
            type: 'string',
            description:
              'Sub-agent profile: ' + listProfiles().join(', ') + '. Defaults to "general".',
            enum: listProfiles(),
          },
          model: {
            type: 'string',
            description:
              'Override the model for this sub-agent (e.g. "gpt-4o-mini" for cost-sensitive subtasks). Defaults to parent agent\'s model.',
          },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_profiles',
      description:
        'List available sub-agent profiles with descriptions. Useful before deciding how to delegate.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// ──────────── implementations ────────────

/**
 * Run a sub-agent for a single task and return its final result.
 * The sub-agent has its own message history, system prompt, and tool set.
 */
export async function runSubAgent(task: SubAgentTask): Promise<SubAgentResult> {
  const startTime = Date.now();
  const profile = getProfile(task.profile);

  logger.info('Sub-agent spawning', {
    profile: profile.name,
    model: task.model,
    goal_preview: task.goal.slice(0, 100),
  });

  try {
    // Lazy-import to avoid circular deps
    const { TOOLS, executeTool } = await import('./tools');
    const { default: OpenAILib } = await import('openai');

    // Build the sub-agent's system prompt
    let systemPrompt = profile.systemPrompt;
    if (task.context) {
      systemPrompt += `\n\n--- TASK CONTEXT ---\n${task.context}`;
    }

    // Filter tools for this profile
    const availableTools = filterToolsForProfile(TOOLS, profile);

    // Resolve API config
    const apiKey = task.apiKey || process.env.OPENAI_API_KEY || process.env.ZIPCODE_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        output: '',
        error: 'No API key available for sub-agent',
        profile: profile.name,
      };
    }

    const clientConfig: any = { apiKey };
    if (task.baseUrl) clientConfig.baseURL = task.baseUrl;
    else if (process.env.ZIPCODE_BASE_URL) clientConfig.baseURL = process.env.ZIPCODE_BASE_URL;

    const client = new OpenAILib(clientConfig);

    const model = task.model || profile.model || process.env.ZIPCODE_MODEL || 'gpt-4o-mini';
    const temperature = profile.temperature ?? 0.7;
    const maxIterations = profile.maxIterations ?? 25;
    const maxTokens = task.maxTokens || 4096;

    // Sub-agent message history (isolated from parent)
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.goal },
    ];

    let iterations = 0;
    let finalOutput = '';

    while (iterations < maxIterations) {
      iterations++;

      const response = await client.chat.completions.create({
        model,
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        temperature,
        max_tokens: maxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Add assistant response to history
      messages.push(message);

      // If there are tool calls, execute them
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          if (tc.type !== 'function') continue;

          let args: any = {};
          try {
            args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            args = {};
          }

          const result = await executeTool(tc.function.name, args);
          const resultText = result.success
            ? result.output
            : `Error: ${result.error || 'unknown'}`;

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultText,
          });
        }

        // Continue loop to let agent process tool results
        continue;
      }

      // No more tool calls — agent is done
      finalOutput = message.content || '';
      break;
    }

    const duration = Date.now() - startTime;

    logger.info('Sub-agent completed', {
      profile: profile.name,
      iterations,
      duration_ms: duration,
      output_length: finalOutput.length,
    });

    return {
      success: true,
      output: finalOutput || '(sub-agent finished with no text response)',
      profile: profile.name,
      model,
      iterations,
      durationMs: duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Sub-agent failed', error, { profile: profile.name });
    return {
      success: false,
      output: '',
      error: `Sub-agent failed: ${error?.message || error}`,
      profile: profile.name,
      durationMs: duration,
    };
  }
}

/**
 * Tool handler for delegate_task.
 */
export async function delegateTask(args: {
  goal: string;
  context?: string;
  profile?: string;
  model?: string;
}): Promise<ToolResult> {
  if (!args.goal || typeof args.goal !== 'string') {
    return {
      success: false,
      output: '',
      error: 'delegate_task requires a "goal" string',
    };
  }

  const result = await runSubAgent({
    goal: args.goal,
    context: args.context,
    profile: args.profile as ProfileName,
    model: args.model,
  });

  if (!result.success) {
    return {
      success: false,
      output: '',
      error: result.error || 'Sub-agent failed',
    };
  }

  // Format result with metadata header so parent agent sees what ran
  const header = `[sub-agent: ${result.profile} | model: ${result.model} | ${result.iterations} iters | ${result.durationMs}ms]\n\n`;

  return {
    success: true,
    output: header + result.output,
  };
}

/**
 * Tool handler for list_profiles.
 */
export async function listProfilesTool(): Promise<ToolResult> {
  const lines = ['Available sub-agent profiles:\n'];
  for (const name of listProfiles()) {
    const profile = AGENT_PROFILES[name];
    lines.push(`• ${name}: ${profile.description}`);
    if (profile.allowedTools) {
      lines.push(`  Tools: ${profile.allowedTools.length} allowed`);
    }
    if (profile.temperature !== undefined) {
      lines.push(`  Temperature: ${profile.temperature}`);
    }
    lines.push('');
  }
  return {
    success: true,
    output: lines.join('\n'),
  };
}
