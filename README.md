# ZIP CODE - AI TUI Agent

```
 ███████╗██╗██████╗      ██████╗ ██████╗ ██████╗ ███████╗
 ╚══███╔╝██║██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ███╔╝ ██║██████╔╝    ██║     ██║   ██║██║  ██║█████╗
  ███╔╝  ██║██╔═══╝     ██║     ██║   ██║██║  ██║██╔══╝
 ███████╗██║██║         ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝╚═╝          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**A modern, Ink-powered Terminal UI agent for coding assistance.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## What's new in v2.0

ZIP CODE has been rewritten as a modern TUI inspired by `opencode`:

- 🎨 **Ink + React TUI** with persistent header, scrolling message view, status bar, and modal panels
- ⚙️ **Settings panel (Ctrl+S)** — switch provider, edit API key, fetch models, tweak temperature/tokens, all without restart
- 💾 **SQLite-backed sessions** at `~/.zipcode/zipcode.db` — every message and tool call is persisted automatically
- 🔧 **Tool calling** — `read_file`, `write_file`, `list_dir`, `execute_bash`, `grep`, `glob`, `ask_user`
- ⚡ **Event-driven agent** — streaming tokens, parallel tool execution, cancellable in-flight requests
- 🗂 **Session browser (Ctrl+L)** — list, switch, and create sessions with arrow keys
- ⌨️ **Keybinds**: `Ctrl+S` settings · `Ctrl+L` sessions · `Ctrl+N` new session · `Esc` cancel · `Ctrl+C` quit

## Install

```bash
npm install
npm run build
npm link            # optional, exposes `zipcode` globally
```

## Run

```bash
npm run dev         # tsx, hot start
# or
zipcode             # if linked globally
# or
node dist/index.js
```

## Configuration

Two paths — both work:

1. **In-app**: press **Ctrl+S** and fill in the form. Press **f** in the Model field to fetch the model list from the provider. Save with **Ctrl+S** again. The values are stored in SQLite (`~/.zipcode/zipcode.db`).
2. **Environment variables** (used as fallback when nothing is saved):
   - `ZIPCODE_PROVIDER` — `openai` or `custom`
   - `OPENAI_API_KEY` / `ZIPCODE_API_KEY`
   - `ZIPCODE_BASE_URL` — for custom OpenAI-compatible endpoints (Ollama, LM Studio, gateways…)
   - `ZIPCODE_MODEL`, `ZIPCODE_MAX_TOKENS`, `ZIPCODE_TEMPERATURE`

## Tools

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `read_file`    | Read a file's contents                            |
| `write_file`   | Write a file (creates parent directories)         |
| `list_dir`     | List a directory                                  |
| `execute_bash` | Run a shell command (30s timeout)                 |
| `grep`         | Recursively search file contents with a regex     |
| `glob`         | Find files matching a glob pattern (`src/**/*.ts`)|
| `ask_user`     | Ask the user — used for confirmation prompts      |

The agent calls these via OpenAI tool-calling and may chain or parallelise calls during a single turn.

## Slash commands

Type these in the input bar:

- `/help` — show keybinds and commands
- `/new` — start a new session
- `/sessions` — open the session browser
- `/settings` — open the settings panel
- `/clear` — clear the visible transcript
- `/quit`, `/exit` — quit

## Storage

```
~/.zipcode/
└── zipcode.db        # SQLite — sessions, messages, app config
```

Tables:

- `sessions` — id, title, timestamps, model, provider
- `messages` — id, session_id, role, content, tool metadata, created_at
- `app_config` — key/value store for in-app settings

## Project structure

```
src/
├── index.tsx           # Ink bootstrap
├── agent.ts            # ReAct loop + tool calling + event emitter
├── tools.ts            # Tool implementations + JSON schemas
├── store.ts            # SQLite (better-sqlite3) layer
├── config.ts           # Config load/save (DB-backed + env fallback)
├── types.ts            # Shared types
└── ui/
    ├── App.tsx         # Root component, modal & keybind logic
    ├── Header.tsx      # Top bar (provider/model/session/cwd)
    ├── MessageView.tsx # Chat transcript with markdown rendering
    ├── InputBar.tsx    # Text input
    ├── StatusBar.tsx   # Spinner / hints / errors
    ├── ToolCallView.tsx# Tool call visualisation
    ├── ConfigPanel.tsx # Ctrl+S settings modal
    ├── SessionList.tsx # Ctrl+L session browser
    ├── Banner.tsx      # Gradient ASCII banner
    ├── markdown.ts     # Lightweight inline markdown renderer
    └── theme.ts        # Color tokens + gradient helpers
```

## License

MIT
