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

[![Version](https://img.shields.io/badge/version-2.4.0-blue.svg)]()
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

### Git Tools (NEW in v2.1)

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `git_status`   | Check repository status                           |
| `git_diff`     | View staged/unstaged changes                      |
| `git_log`      | Show commit history                               |
| `git_branch`   | List, create, switch, or delete branches          |
| `git_commit`   | Create commits                                    |
| `git_push`     | Push to remote repository                         |
| `git_pull`     | Pull from remote repository                       |
| `git_add`      | Stage files for commit                            |

### Web Tools (NEW in v2.1)

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `web_search`   | Search the web using DuckDuckGo                   |
| `http_request` | Make HTTP requests (GET, POST, PUT, DELETE)       |
| `download_file`| Download files from URLs                          |

### File Watcher Tools (NEW in v2.1)

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `watch_file`   | Watch files/directories for changes               |
| `stop_watch`   | Stop watching a file/directory                    |
| `list_watches` | List all active file watches                      |

### Code Analysis Tools (NEW in v2.2)

| Tool                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `analyze_complexity`   | Analyze code complexity metrics                   |
| `find_todos`           | Find TODO/FIXME/HACK/NOTE comments                |
| `analyze_dependencies` | Analyze project dependencies                      |
| `count_lines`          | Count lines of code by file type                  |

The agent calls these via OpenAI tool-calling and may chain or parallelise calls during a single turn.

## What's New in v2.3 - Production Hardening

- **Structured Logging** — JSON logs with auto-redaction of secrets, configurable levels
- **Privacy-first Telemetry** — Opt-in (OFF by default), all data stored locally
- **Docker Support** — Multi-stage Dockerfile + docker-compose for easy deployment
- **52 Tests** — Comprehensive test coverage for tools, security, watchers, analysis
- **Documentation** — CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md
- **GitHub Templates** — Bug report, feature request, PR template

### Docker

```bash
# Build the image
docker build -t zipcode .

# Run with docker-compose
docker-compose up

# Or run directly
docker run -it -e OPENAI_API_KEY=your-key zipcode
```

### Logging

```bash
# Set log level
export ZIPCODE_LOG_LEVEL=DEBUG  # DEBUG | INFO | WARN | ERROR | FATAL

# Enable console output
export ZIPCODE_LOG_CONSOLE=true

# Logs are written to ~/.zipcode/logs/zipcode-YYYY-MM-DD.log
```

### Telemetry (Opt-in)

```bash
# Enable local telemetry (privacy-first, stored at ~/.zipcode/telemetry/)
export ZIPCODE_TELEMETRY=true
```

## What's New in v2.4 — Multi-Agent Architecture

ZIP CODE can now spawn specialized sub-agents with different models and tool sets.

### Sub-agent System

| Tool             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `delegate_task`  | Spawn a sub-agent with its own model, profile, and context |
| `list_profiles`  | List available sub-agent profiles                          |

### Agent Profiles

| Profile        | Description                              | Tools                            |
| -------------- | ---------------------------------------- | -------------------------------- |
| `general`      | Default coding assistant                 | All                              |
| `orchestrator` | Decomposes & delegates tasks             | delegate_task + read-only        |
| `coder`        | Writes/edits code (low temperature)      | All except delegate_task         |
| `reviewer`     | Reviews code (read-only, no execution)   | read_file, grep, git_diff, etc.  |
| `debugger`     | Investigates bugs methodically           | All except delegate_task         |
| `researcher`   | Web search and docs                      | web_search, http_request, etc.   |
| `writer`       | Writes documentation                     | read_file, write_file, etc.      |

### Memory System

| Tool             | Description                              |
| ---------------- | ---------------------------------------- |
| `memory_add`     | Save a durable fact                      |
| `memory_search`  | Search memory by keyword                 |
| `memory_list`    | List all entries (optional category)     |
| `memory_remove`  | Remove an entry by ID                    |

Categories: `user`, `project`, `tech`, `preference`, `fact`. Stored at `~/.zipcode/memory.json`.

### Workspace Context

Drop a `.zipcoderc`, `ZIPCODE.md`, `AGENTS.md`, or `.cursorrules` in your project root.
ZIP CODE auto-loads it into the system prompt.

```yaml
---
name: my-app
language: TypeScript
test: pnpm test
build: pnpm build
---

Use functional React components, prefer named exports.
```

### Resilience

- **Retry with exponential backoff** — auto-retries 429s, 5xx, network errors
- **Circuit breaker** — fails fast after repeated failures, auto-recovers
- **Token usage tracking** — see `~/.zipcode/logs/` for cost estimates per session

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
