#!/usr/bin/env node

// ZIP CODE - AI CLI Agent
// Entry point and CLI interface

import enquirer from 'enquirer';
import { Agent } from './agent';
import { printBanner, printHelp, printUser, printSystem, printError, printSuccess } from './ui';
import { getProviderInfo, loadConfig } from './config';
import { providerManagementMenu, saveProviderConfig } from './provider-manager';

// Configuration
let useStreaming = true;

async function main() {
  // Print welcome banner
  printBanner();

  // Initialize agent
  const agent = await Agent.create();
  
  // Show provider info
  const providerInfo = getProviderInfo(agent.getConfig());
  console.log(providerInfo + '\n');

  // Main input loop
  while (true) {
    try {
      // Custom prompt with blinking cursor
      const border = '█ ███ ███ █ ███ █ █ █████ █████ ███ ███ ███████ █ █ █ █ █ █';
      const userColor = '\x1b[38;2;98;41;214m'; // #6229d6 purple
      const boldReset = '\x1b[0m';
      
      console.log('\n' + userColor + border + boldReset);
      
      const response: any = await enquirer.prompt({
        type: 'input',
        name: 'message',
        message: '\x1b[1m\x1b[5m>\x1b[0m', // Bold + Blinking >
        prefix: '',
      });

      const userInput = response.message.trim();
      
      console.log(userColor + border + boldReset);

      // Handle special commands
      if (!userInput) {
        continue;
      }

      if (userInput === 'exit' || userInput === 'quit' || userInput === 'q') {
        printSystem('Goodbye! 👋');
        process.exit(0);
      }

      if (userInput === 'help' || userInput === 'h') {
        printHelp();
        continue;
      }

      if (userInput === 'clear' || userInput === 'cls') {
        console.clear();
        printBanner();
        continue;
      }

      if (userInput === 'history') {
        const history = agent.getHistory();
        console.log('\nConversation History:');
        history.forEach((msg, idx) => {
          if (msg.role !== 'system') {
            console.log(`${idx}. [${msg.role}]: ${msg.content?.substring(0, 100)}...`);
          }
        });
        console.log();
        continue;
      }

      if (userInput === 'reset') {
        agent.clearHistory();
        printSystem('Conversation history cleared');
        continue;
      }

      if (userInput === 'streaming on') {
        useStreaming = true;
        printSystem('Streaming enabled');
        continue;
      }

      if (userInput === 'streaming off') {
        useStreaming = false;
        printSystem('Streaming disabled');
        continue;
      }

      if (userInput === 'save') {
        const result = await agent.saveConversation();
        if (result.success) {
          printSystem(`Conversation saved to: ${result.path}`);
        } else {
          printError(result.error || 'Failed to save conversation');
        }
        continue;
      }

      if (userInput.startsWith('load ')) {
        const id = userInput.substring(5).trim();
        const result = await agent.loadConversation(id);
        if (result.success) {
          printSystem(`Conversation loaded: ${id}`);
        } else {
          printError(result.error || 'Failed to load conversation');
        }
        continue;
      }

      if (userInput === 'export') {
        const markdown = agent.exportToMarkdown();
        const fs = await import('fs/promises');
        const filename = `zipcode-export-${Date.now()}.md`;
        await fs.writeFile(filename, markdown);
        printSystem(`Conversation exported to: ${filename}`);
        continue;
      }

      if (userInput === 'provider') {
        const result = await providerManagementMenu(agent.getConfig().provider);
        
        if (result.action === 'change' && result.provider) {
          // Save new provider config
          await saveProviderConfig(result.provider);
          
          // Reload config and reinitialize agent
          const newConfig = await loadConfig();
          await agent.reinitialize(newConfig);
          
          printSuccess('Provider changed successfully!');
          const newProviderInfo = getProviderInfo(agent.getConfig());
          console.log('\n' + newProviderInfo + '\n');
        }
        continue;
      }

      if (userInput === 'list') {
        const { listConversations } = await import('./persistence');
        const result = await listConversations();
        if (result.success && result.conversations) {
          if (result.conversations.length === 0) {
            printSystem('No saved conversations');
          } else {
            console.log('\nSaved Conversations:');
            result.conversations.forEach((conv) => {
              console.log(`  ${conv.id} - ${conv.timestamp} (${conv.messageCount} messages)`);
            });
            console.log();
          }
        } else {
          printError(result.error || 'Failed to list conversations');
        }
        continue;
      }

      // Process user message with agent
      if (useStreaming) {
        await agent.processMessageStreaming(userInput);
      } else {
        await agent.processMessage(userInput);
      }
    } catch (error: any) {
      if (error.message === 'cancelled' || error.message.includes('cancel')) {
        printSystem('\nGoodbye! 👋');
        process.exit(0);
      }
      printError(`Unexpected error: ${error.message}`);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  printSystem('\n\nGoodbye! 👋');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  printError(`Fatal error: ${error.message}`);
  process.exit(1);
});

// Run main
main().catch((error) => {
  printError(`Failed to start: ${error.message}`);
  process.exit(1);
});
