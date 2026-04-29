# ZIP CODE - AI CLI Agent

<div align="center">

```
 ┏━━━━┓━━┓━━━┓┃┃┃━━━┓━━━┓━━━┓━━━┓
 ┗━━┓┃┃┫┣┛┏━┓┃┃┃┃┏━┓┃┏━┓┃┓┏┓┃┏━━┛
 ┃┃┏┛┏┛┃┃┃┗━┛┃┃┃┃┃┃┗┛┃┃┃┃┃┃┃┃┗━━┓
 ┃┏┛┏┛┃┃┃┃┏━━┛┃┃┃┃┃┏┓┃┃┃┃┃┃┃┃┏━━┛
 ┏┛┃┗━┓┫┣┓┃┃┃┃┃┃┃┗━┛┃┗━┛┃┛┗┛┃┗━━┓
 ┗━━━━┛━━┛┛┃┃┃┃┃┃━━━┛━━━┛━━━┛━━━┛
```

**AI Coding Assistant for the Command Line**

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/yourusername/zipcode)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

</div>

---

## 🚀 Features

- 🤖 **Autonomous AI Agent** - ReAct pattern for intelligent reasoning and acting
- 🎨 **Beautiful Terminal UI** - Gradient ASCII art with custom chat borders
- 🔧 **Interactive Provider Management** - Switch between 0penAI and custom providers seamlessly
- 📁 **Powerful Tool System** - 5 built-in tools for file operations and shell commands
- 💬 **Real-time Streaming** - Token-by-token response streaming
- 📝 **Markdown Rendering** - Syntax highlighting for code blocks
- 💾 **Conversation Persistence** - Save, load, and export conversations
- 🎯 **Multiple Providers** - Support for 0penAI, custom APIs, or tools-only mode
- ⚡ **Fast & Lightweight** - Startup < 500ms, Memory < 100MB

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Quick Install

```bash
# Clone the repository
git clone https://github.com/yourusername/zipcode.git
cd zipcode

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## ⚙️ Configuration

### Option 1: 0penAI (Default)

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
export ZIPCODE_MODEL="gpt-4"  # optional
```

### Option 2: Custom Provider (0penAI SDK Compatible)

```bash
export ZIPCODE_PROVIDER=custom
export ZIPCODE_API_KEY="your-key"
export ZIPCODE_BASE_URL="http://localhost:1234/v1"
export ZIPCODE_MODEL="your-model"
```

### Option 3: Tools-Only Mode (No API Key)

```bash
# Just run without setting any API keys
# Perfect for file operations and shell commands
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ZIPCODE_PROVIDER` | Provider type: 'openai' or 'custom' | openai | No |
| `OPENAI_API_KEY` | 0penAI API key | - | For 0penAI |
| `ZIPCODE_API_KEY` | Custom provider API key | - | For custom |
| `ZIPCODE_BASE_URL` | Custom provider base URL | - | For custom |
| `ZIPCODE_MODEL` | Model name | gpt-4-turbo-preview | No |
| `ZIPCODE_MAX_TOKENS` | Max tokens per request | 4096 | No |
| `ZIPCODE_TEMPERATURE` | Temperature (0-1) | 0.7 | No |

## 🎮 Usage

### Start ZIP CODE

```bash
# If installed globally
zipcode

# Or run directly
npm start

# Development mode
npm run dev
```

### Interactive Provider Setup

```bash
# In ZIP CODE, type:
provider

# Then follow the interactive menu to:
# 1. Choose provider (0penAI or Custom)
# 2. Enter API key
# 3. Select model from auto-fetched list
# 4. Start chatting immediately!
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `exit`, `quit`, `q` | Exit ZIP CODE |
| `help`, `h` | Show help message |
| `clear`, `cls` | Clear the screen |
| `history` | Show conversation history |
| `reset` | Clear conversation history |
| `streaming on/off` | Toggle streaming mode |
| `save` | Save current conversation |
| `load <id>` | Load a saved conversation |
| `list` | List all saved conversations |
| `export` | Export conversation to markdown |
| `provider` | Interactive provider management |

## 🛠️ Built-in Tools

ZIP CODE comes with 5 powerful tools that the AI can use autonomously:

### 1. **read_file**
Read contents of any file
```
You: Read the package.json file
```

### 2. **write_file**
Create or modify files
```
You: Create a hello.ts file with a simple function
```

### 3. **list_dir**
List directory contents
```
You: Show me all TypeScript files in src/
```

### 4. **execute_bash**
Run shell commands
```
You: Run npm install
```

### 5. **ask_user**
Get user confirmation for sensitive operations
```
ZIP CODE: Should I delete this file? (y/n)
```

## 🎨 UI Features

### Gradient ASCII Art Banner
Beautiful purple-to-cyan gradient logo on startup

### Custom Chat Borders
- **User Input**: Purple border with blinking cursor
- **AI Response**: Cyan border with markdown formatting

### Syntax Highlighting
Code blocks are automatically highlighted in the terminal

### Real-time Streaming
See AI responses appear token-by-token

## 💾 Conversation Management

### Save Conversations
```bash
You: save
✓ Conversation saved: conv_1714420800000
```

### Load Previous Conversations
```bash
You: list
# Shows all saved conversations with metadata

You: load conv_1714420800000
✓ Conversation loaded
```

### Export to Markdown
```bash
You: export
✓ Conversation exported to: zipcode-export-1714420800000.md
```

## 🔧 Custom Provider Examples

### LM Studio (Local)
```bash
export ZIPCODE_PROVIDER=custom
export ZIPCODE_API_KEY="lm-studio"
export ZIPCODE_BASE_URL="http://localhost:1234/v1"
export ZIPCODE_MODEL="local-model"
```

### Ollama
```bash
export ZIPCODE_PROVIDER=custom
export ZIPCODE_API_KEY="ollama"
export ZIPCODE_BASE_URL="http://localhost:11434/v1"
export ZIPCODE_MODEL="llama2"
```

### Custom API Gateway
```bash
export ZIPCODE_PROVIDER=custom
export ZIPCODE_API_KEY="your-gateway-key"
export ZIPCODE_BASE_URL="https://api.yourcompany.com/v1"
export ZIPCODE_MODEL="custom-gpt-4"
```

## 📖 Example Usage

```bash
$ zipcode

 ┏━━━━┓━━┓━━━┓┃┃┃━━━┓━━━┓━━━┓━━━┓
 ┗━━┓┃┃┫┣┛┏━┓┃┃┃┃┏━┓┃┏━┓┃┓┏┓┃┏━━┛
 ┃┃┏┛┏┛┃┃┃┗━┛┃┃┃┃┃┃┗┛┃┃┃┃┃┃┃┃┗━━┓
 ┃┏┛┏┛┃┃┃┃┏━━┛┃┃┃┃┃┏┓┃┃┃┃┃┃┃┃┏━━┛
 ┏┛┃┗━┓┫┣┓┃┃┃┃┃┃┃┗━┛┃┗━┛┃┛┗┛┃┗━━┓
 ┗━━━━┛━━┛┛┃┃┃┃┃┃━━━┛━━━┛━━━┛━━━┛

           AI Coding Assistant v1.3.0

Type 'exit' to quit, 'help' for commands

🤖 Provider: 0penAI
   Model: gpt-4

█ ███ ███ █ ███ █ █ █████ █████ ███ ███ ███████ █ █ █ █ █ █
> Create a TypeScript function to calculate fibonacci
█ ███ ███ █ ███ █ █ █████ █████ ███ ███ ███████ █ █ █ █ █ █

█ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
I'll create a TypeScript function to calculate Fibonacci numbers.

[Tool: write_file]
File: fibonacci.ts

✓ File created successfully

The function is ready! It includes:
- Recursive implementation
- Memoization for performance
- Type safety with TypeScript
█ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
```

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
│  Terminal   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         CLI Interface                │
│  - Input handling                    │
│  - Output rendering                  │
│  - Provider management               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Agent Core (ReAct Loop)        │
│  - Conversation history              │
│  - Tool call parsing                 │
│  - Response streaming                │
└──────────┬──────────────────────────┘
           │
           ├──────────────┬─────────────┐
           ▼              ▼             ▼
    ┌──────────┐   ┌──────────┐  ┌──────────┐
    │   LLM    │   │  Tools   │  │    UI    │
    │ Provider │   │  System  │  │ Renderer │
    └──────────┘   └──────────┘  └──────────┘
```

## 📂 Project Structure

```
zipcode/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent.ts              # Agent with ReAct loop
│   ├── tools.ts              # Tool implementations
│   ├── ui.ts                 # Terminal UI utilities
│   ├── config.ts             # Configuration management
│   ├── types.ts              # TypeScript types
│   ├── persistence.ts        # Conversation persistence
│   └── provider-manager.ts   # Provider management
├── test/
│   └── tools.test.ts         # Tests
├── scripts/
│   └── make-executable.js    # Build script
├── dist/                     # Compiled output
├── .zipcode-conversations/   # Saved conversations
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md              # Complete documentation
├── LICENSE
└── .env.example
```

## 🧪 Development

### Run in Development Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Link Globally
```bash
npm link
zipcode
```

## 🔒 Security

- API keys stored in environment variables only
- File operations restricted to accessible paths
- Shell commands have 30-second timeout
- Dangerous operations require user confirmation
- No data sent to third parties (except chosen LLM provider)

## 🚀 Performance

- **Startup Time:** < 500ms
- **Memory Usage:** < 100MB typical
- **Conversation Limit:** Up to 100 messages
- **Streaming:** Real-time token-by-token output

## 📝 Version History

### v1.3.0 (Current)
- ✨ Interactive provider management with arrow key navigation
- 🎨 Gradient ASCII art banner
- 🎨 Custom chat borders with gradient colors
- 🔄 Seamless provider switching without restart
- 📋 Automatic model discovery from API

### v1.2.0
- 🔧 Custom provider support (0penAI SDK compatible)
- ⚙️ Optional API key (tools-only mode)
- 📚 Comprehensive provider documentation

### v1.1.0
- 💾 Conversation persistence
- 📤 Export to markdown
- 📋 List saved conversations

### v1.0.0
- 🎉 Initial release
- 🤖 ReAct agent implementation
- 🛠️ 5 core tools
- 💬 Real-time streaming
- 🎨 Terminal UI

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Inspired by OpenCode/Code Assistant
- Uses 0penAI API for LLM capabilities
- Terminal UI powered by picocolors and marked

## 📞 Support

For detailed documentation, see [CHANGELOG.md](CHANGELOG.md)

For issues and questions:
- 📧 Email: support@zipcode.dev
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/zipcode/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/zipcode/discussions)

---

<div align="center">

**Made with ❤️ by the ZIP CODE Team**

[⭐ Star us on GitHub](https://github.com/yourusername/zipcode) | [📖 Documentation](CHANGELOG.md) | [🐛 Report Bug](https://github.com/yourusername/zipcode/issues)

</div>
