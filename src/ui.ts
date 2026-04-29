// UI utilities for ZIP CODE

import pc from 'picocolors';
import { marked } from 'marked';
import ora, { Ora } from 'ora';

// Simple markdown rendering for terminal (fallback)
function simpleMarkdownRender(text: string): string {
  let output = text;
  
  // Code blocks
  output = output.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return '\n' + pc.dim('┌─────────────────────────────────────') + '\n' +
           pc.cyan(code.trim()) + '\n' +
           pc.dim('└─────────────────────────────────────') + '\n';
  });
  
  // Inline code
  output = output.replace(/`([^`]+)`/g, (_, code) => pc.cyan(code));
  
  // Bold
  output = output.replace(/\*\*([^*]+)\*\*/g, (_, text) => pc.bold(text));
  
  // Headers
  output = output.replace(/^### (.+)$/gm, (_, text) => '\n' + pc.bold(pc.blue(text)));
  output = output.replace(/^## (.+)$/gm, (_, text) => '\n' + pc.bold(pc.green(text)));
  output = output.replace(/^# (.+)$/gm, (_, text) => '\n' + pc.bold(pc.yellow(text)));
  
  // Lists
  output = output.replace(/^- (.+)$/gm, (_, text) => pc.dim('  •') + ' ' + text);
  output = output.replace(/^\d+\. (.+)$/gm, (_, text) => pc.dim('  →') + ' ' + text);
  
  return output;
}

// Color scheme
export const colors = {
  user: pc.green,
  assistant: pc.cyan,
  system: pc.yellow,
  error: pc.red,
  success: pc.green,
  info: pc.blue,
  tool: pc.magenta,
  dim: pc.dim,
};

// Render markdown to terminal
export function renderMarkdown(text: string): string {
  try {
    // Use simple markdown renderer
    return simpleMarkdownRender(text);
  } catch (error) {
    return text;
  }
}

// Print user message
export function printUser(message: string): void {
  const border = '█ ███ ███ █ ███ █ █ █████ █████ ███ ███ ███████ █ █ █ █ █ █';
  
  // Purple color for user (top of gradient)
  const userColor = '\x1b[38;2;98;41;214m'; // #6229d6
  const messageColor = '\x1b[38;2;120;220;120m'; // Light green for message
  const reset = '\x1b[0m';
  
  console.log('\n' + userColor + border + reset);
  console.log(messageColor + message + reset);
  console.log(userColor + border + reset);
}

// Print assistant message
export function printAssistant(message: string): void {
  const border = '█ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █';
  
  // Cyan color for assistant (bottom of gradient)
  const assistantColor = '\x1b[38;2;46;178;184m'; // #2eb2b8
  const reset = '\x1b[0m';
  
  console.log('\n' + assistantColor + border + reset);
  const rendered = renderMarkdown(message);
  console.log(rendered);
  console.log(assistantColor + border + reset);
}

// Print system message
export function printSystem(message: string): void {
  console.log(colors.system('⚙ ' + message));
}

// Print error message
export function printError(message: string): void {
  console.log(colors.error('✗ Error: ' + message));
}

// Print success message
export function printSuccess(message: string): void {
  console.log(colors.success('✓ ' + message));
}

// Print tool execution
export function printTool(toolName: string, args: any): void {
  console.log(colors.tool(`\n[Tool: ${toolName}]`));
  console.log(colors.dim(JSON.stringify(args, null, 2)));
}

// Print tool result
export function printToolResult(result: { success: boolean; output: string; error?: string }): void {
  if (result.success) {
    console.log(colors.success('\n✓ Tool executed successfully'));
    if (result.output) {
      console.log(colors.dim(result.output));
    }
  } else {
    console.log(colors.error('\n✗ Tool execution failed'));
    if (result.error) {
      console.log(colors.error(result.error));
    }
  }
}

// Create spinner
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
  });
}

// Print welcome banner
export function printBanner(): void {
  console.clear();
  
  // ASCII art for ZIP CODE
  const asciiArt = [
    ' ┏━━━━┓━━┓━━━┓┃┃┃━━━┓━━━┓━━━┓━━━┓',
    ' ┗━━┓┃┃┫┣┛┏━┓┃┃┃┃┏━┓┃┏━┓┃┓┏┓┃┏━━┛',
    ' ┃┃┏┛┏┛┃┃┃┗━┛┃┃┃┃┃┃┗┛┃┃┃┃┃┃┃┃┗━━┓',
    ' ┃┏┛┏┛┃┃┃┃┏━━┛┃┃┃┃┃┏┓┃┃┃┃┃┃┃┃┏━━┛',
    ' ┏┛┃┗━┓┫┣┓┃┃┃┃┃┃┃┗━┛┃┗━┛┃┛┗┛┃┗━━┓',
    ' ┗━━━━┛━━┛┛┃┃┃┃┃┃━━━┛━━━┛━━━┛━━━┛',
  ];
  
  // Create gradient from #6229d6 (top-left) to #2eb2b8 (bottom-left)
  const startColor = { r: 98, g: 41, b: 214 };  // #6229d6
  const endColor = { r: 46, g: 178, b: 184 };   // #2eb2b8
  
  // Print ASCII art with gradient
  asciiArt.forEach((line, index) => {
    // Calculate color for this line (gradient from top to bottom)
    const ratio = index / (asciiArt.length - 1);
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);
    
    // Use ANSI 24-bit color (truecolor)
    console.log(`\x1b[38;2;${r};${g};${b}m${line}\x1b[0m`);
  });
  
  // Subtitle with gradient cyan
  console.log(colors.dim('\nAI Coding Assistant v1.3.0\n'));
  console.log(colors.dim("Type 'exit' to quit, 'help' for commands\n"));
}

// Print help
export function printHelp(): void {
  console.log(colors.info('\nAvailable commands:'));
  console.log(colors.dim('  exit, quit, q     - Exit ZIP CODE'));
  console.log(colors.dim('  help, h           - Show this help message'));
  console.log(colors.dim('  clear, cls        - Clear the screen'));
  console.log(colors.dim('  history           - Show conversation history'));
  console.log(colors.dim('  reset             - Clear conversation history'));
  console.log(colors.dim('  streaming on/off  - Toggle streaming mode'));
  console.log(colors.dim('  save              - Save current conversation'));
  console.log(colors.dim('  load <id>         - Load a saved conversation'));
  console.log(colors.dim('  list              - List all saved conversations'));
  console.log(colors.dim('  export            - Export conversation to markdown'));
  console.log(colors.dim('  provider          - Manage LLM provider (change/view)'));
  console.log(colors.dim('\nJust type your message to chat with ZIP CODE!\n'));
}

// Stream text output (simulated token-by-token)
export async function streamText(text: string, delayMs: number = 10): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.log();
}
