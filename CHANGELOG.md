# ZIP CODE - Complete Changelog & Documentation

All notable changes, implementation details, and guides for ZIP CODE.

---

## Version History

### [2.6.0] - 2026-05-17

#### Added - TUI Feature Discovery

7 new in-app panels surfacing every v2.4/v2.5 feature without leaving the terminal:

**🔧 Tools Panel (`Ctrl+T` / `/tools`)**
- Browse all 33 native tools + dynamic MCP tools
- Grouped by category: Filesystem, Git, Web, Watcher, Code Analysis, Database, Multi-Agent, Memory, MCP
- Up/down navigation, scrollable list
- Shows native vs MCP source counts

**🎭 Profiles Panel (`Ctrl+P` / `/profiles`)**
- Browse all 7 agent profiles (general, orchestrator, coder, reviewer, debugger, researcher, writer)
- Per-profile detail: model, temperature, max iterations, allowed/blocked tools
- System prompt preview

**📝 Templates Panel (`/templates`)**
- Browse 8 built-in prompt templates plus user/project overrides
- Per-template detail: source, variables, body preview
- Enter to use template via `/template <name>` command

**💰 Budget Panel (`Ctrl+B` / `/budget`)**
- Real-time budget usage display (refreshes every 1s)
- Visual progress bars (green/yellow/red at 75%/90% thresholds)
- USD spent, tokens used, tool calls made vs limits
- Setup instructions when no budget configured
- `/budget reset` slash command to clear counters

**🧠 Memory Panel (`Ctrl+M` / `/memory`)**
- Browse persistent memory entries with category breakdown
- Per-category counts (user/project/tech/preference/fact)
- Selected entry detail with timestamp

**🔌 MCP Panel (`/mcp`)**
- Show connected MCP servers with status (🟢/🔴)
- Per-server tool count
- Command shown for each connection
- Setup instructions when no servers configured

**📤 Export Panel (`Ctrl+E` / `/export`)**
- Export current conversation in 3 formats: Markdown, HTML (dark mode), JSON
- Toggle: hide tool calls (`t`), hide system messages (`y`)
- Saves to `~/.zipcode/exports/`
- Success/error feedback in-panel

#### Enhanced UI

**Header** now shows badges for:
- 🎭 Active profile (when not 'general')
- 🔧 Total tool count (native + MCP)
- 🔌 Connected MCP server count
- 💰 Budget usage percentage with color coding (green/yellow/red)

**StatusBar** updated hint shows new keybinds:
- `/help · Ctrl+S settings · Ctrl+T tools · Ctrl+P profiles · Ctrl+M memory · Ctrl+C quit`

**Slash commands** expanded:
- `/tools`, `/profiles`, `/templates`, `/memory`, `/budget`, `/budget reset`, `/mcp`, `/export`
- `/template <name> [vars-json]` to render and send a prompt template

**Keybinds** added:
- `Ctrl+T` — toggle tools panel
- `Ctrl+P` — toggle profiles panel
- `Ctrl+M` — toggle memory panel
- `Ctrl+B` — toggle budget panel
- `Ctrl+E` — toggle export panel

#### Internal

- New API: `mcpManager.getServerStatus()` returns connection info for UI
- All panels handle empty states gracefully with setup instructions
- Live data: budget panel updates 1Hz, MCP/header badges update 0.5Hz

#### Stats
- Source files: +7 UI panels (~30k chars)
- Build: ✅ Pass
- Tests: ✅ 147/147 Pass

---

### [2.5.0] - 2026-05-17

#### Added - Extensibility & Ecosystem

**🔌 MCP Client (`src/mcp-client.ts`)**
- Connect to external MCP (Model Context Protocol) servers via stdio transport
- Auto-discover and register tools (namespaced as `mcp__<server>__<tool>`)
- JSON-RPC over stdio with handshake, tools/list, and tools/call
- Multiple servers configured at `~/.zipcode/mcp-servers.json`
- Lifecycle managed with graceful shutdown on exit/SIGINT
- Unlimited extensibility - works with any MCP-compatible server

**🪝 Hooks/Middleware System (`src/hooks.ts`)**
- Pre/post tool execution hooks (audit, validate, confirm, rewrite)
- Pre/post message hooks
- Session start/end hooks
- Tool name filter (string or regex)
- Block tool execution with custom reason
- Rewrite tool args before execution
- Built-in factories: `registerAuditHook`, `registerConfirmHook`, `registerValidationHook`
- Errors in hooks logged but never break the agent

**⚡ Custom Slash Commands (`src/slash-commands.ts`)**
- User-defined shortcuts loaded from markdown files
- Two locations: `./.zipcode/commands/` (project) and `~/.zipcode/commands/` (user)
- YAML frontmatter for metadata (description, args)
- Variable substitution: `{{arg1}}`, `{{name}}`, `{{args}}`
- Project commands override user commands

**🗄️ Database Tools (`src/database-tools.ts`)**
- `sql_query` - Execute SQL against SQLite databases
- `sql_schema` - Inspect tables, indexes, columns
- Read-only mode by default (SELECT/PRAGMA/EXPLAIN/WITH allowed)
- Opt-in write mode via `allow_write=true`
- Result row cap (500 default) to protect context window
- Lazy import - reuses existing better-sqlite3 dependency

**💰 Budget Guards (`src/budget-guard.ts`)**
- Hard caps on USD spent, tokens used, tool calls made
- Configurable via env: `ZIPCODE_BUDGET_USD`, `ZIPCODE_BUDGET_TOKENS`, `ZIPCODE_BUDGET_TOOLCALLS`
- Soft warnings at 75% and 90% (fire once per threshold)
- Projected delta check before operations
- Snapshot for status display

**📝 Prompt Templates (`src/prompt-templates.ts`)**
- Built-in library: review, refactor, debug, tests, explain, docs, optimize, security
- User templates at `~/.zipcode/prompts/<name>.md`
- Project templates at `./.zipcode/prompts/<name>.md`
- Variable syntax with defaults: `{{name|default}}`
- Precedence: builtin < user < project

**📤 Conversation Export (`src/conversation-export.ts`)**
- Three formats: Markdown, HTML (self-contained, dark mode), JSON
- Tool calls folded into details/summary blocks
- Time range filtering (since/until)
- Hide system/tool messages on demand
- HTML escapes user content to prevent XSS

#### Testing
- Test suite expanded: 107 → 147 tests (+37%)
- New test files:
  - `test/hooks.test.ts` (14 tests)
  - `test/budget-guard.test.ts` (12 tests)
  - `test/prompt-templates.test.ts` (5 tests)
  - `test/conversation-export.test.ts` (12 tests)

#### Tools Integration
- 31 → 33 native tools (+`sql_query`, `sql_schema`)
- Plus dynamic MCP tools loaded at runtime via `getAllTools()`
- Hook system intercepts every tool execution (pre/post)

#### Stats
- Lines of code: ~7000 → ~9500 (+35%)
- Tests: 107 → 147 (+37%)
- Build: ✅ Pass
- All tests: ✅ Pass

---

### [2.4.0] - 2026-05-17

#### Added — Multi-Agent Architecture

**Sub-agent System** (`src/sub-agent.ts`, `src/agent-profiles.ts`)
- `delegate_task` tool — spawn sub-agents with their own model, profile, and context
- `list_profiles` tool — see available specializations
- 7 specialized profiles:
  - `general` — default coding assistant
  - `orchestrator` — decomposes complex tasks, delegates to sub-agents
  - `coder` — focused code-writing (low temperature, blocks delegate_task)
  - `reviewer` — read-only code review (no write/execute)
  - `debugger` — methodical bug investigation
  - `researcher` — web search and documentation
  - `writer` — documentation and prose
- Per-profile tool allowlist/denylist
- Per-profile temperature, max iterations, system prompt
- Sub-agents run in isolated context — only summary returned to parent

**Long-term Memory** (`src/memory-tools.ts`)
- 4 new tools: `memory_add`, `memory_search`, `memory_list`, `memory_remove`
- 5 categories: user, project, tech, preference, fact
- Persisted at `~/.zipcode/memory.json`
- Deduplication by content hash
- Hit counter to surface frequently-used facts

**Workspace Context** (`src/workspace.ts`)
- Auto-discovers `.zipcoderc`, `ZIPCODE.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`
- Walks up directory tree from CWD
- Optional YAML frontmatter for structured metadata (name, language, test, build, lint)
- Loaded into system prompt automatically

**Resilience** (`src/resilience.ts`)
- `retry()` — exponential backoff with jitter, configurable shouldRetry predicate
- `defaultShouldRetry()` — retries 429, 5xx, network errors; not 4xx
- `CircuitBreaker` — three states (CLOSED/OPEN/HALF_OPEN), auto-recovery
- Logs all retries and state transitions

**Token Usage & Cost Tracking** (`src/usage-tracker.ts`)
- Tracks prompt/completion tokens per session
- Pricing table for OpenAI, Anthropic, local models
- Prefix matching for model versions (e.g. gpt-4o-2024-08-06)
- Aggregate stats across sessions
- Formatted summaries for display

#### Testing
- Test count: 52 → 107 (+106%)
- New test files:
  - `test/agent-profiles.test.ts` (11 tests)
  - `test/resilience-and-usage.test.ts` (22 tests)
  - `test/workspace.test.ts` (11 tests)
  - `test/memory.test.ts` (11 tests)

#### Stats
- Total tools: 25 → 31 (+6 new tools)
- Test count: 52 → 107 (+55 tests)
- New modules: 6 (sub-agent, agent-profiles, memory-tools, workspace, resilience, usage-tracker)
- Build: ✅ Pass
- Tests: 107/107 ✅

---

### [2.3.0] - 2026-05-17

#### Added - Production Hardening

**Observability**
- **Structured Logging System** (`src/logger.ts`)
  - JSON-formatted logs with timestamps and context
  - Configurable log levels (DEBUG, INFO, WARN, ERROR, FATAL)
  - Auto-redaction of sensitive data (API keys, passwords, tokens)
  - File-based logs at `~/.zipcode/logs/`
  - Optional console output

- **Privacy-first Telemetry** (`src/telemetry.ts`)
  - **OPT-IN by default** — zero data collected unless `ZIPCODE_TELEMETRY=true`
  - All data stored locally at `~/.zipcode/telemetry/`
  - No external transmission
  - Auto-sanitization of sensitive metadata
  - Tool usage, performance, and error tracking
  - Error fingerprinting for deduplication

**Deployment**
- **Docker Support**
  - Multi-stage Dockerfile (builder + runtime)
  - Non-root user for security
  - Health checks
  - `.dockerignore` for smaller images
  - `docker-compose.yml` with environment configuration
  - Persistent volume for sessions

**Documentation**
- `CONTRIBUTING.md` — Contributor guide with development workflow
- `SECURITY.md` — Security policy and disclosure process
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1

**GitHub Templates**
- Bug report template
- Feature request template
- Pull request template

**Testing**
- Comprehensive test suite expanded from 8 to 52 tests
- New test files:
  - `test/security.test.ts` (26 tests)
  - `test/code-analysis.test.ts` (10 tests)
  - `test/watcher.test.ts` (8 tests)
- Coverage: tools, security utilities, code analysis, watchers

#### Cleanup
- Removed leftover `test-debug.js` debug file

#### Stats
- Tests: 8 → 52 (+550%)
- Documentation files: 1 → 7
- Production-ready features: ✅
- Build: ✅ Pass
- All tests: ✅ Pass

---

### [2.2.0] - 2026-05-17

#### Added - Code Analysis Tools
- **Code Analysis (4 new tools)**: Project insights and code quality
  - `analyze_complexity` - Analyze code complexity metrics and largest files
  - `find_todos` - Find and categorize TODO/FIXME/HACK/NOTE comments
  - `analyze_dependencies` - Analyze dependencies from package.json, requirements.txt, go.mod
  - `count_lines` - Count lines of code by file type with statistics

#### Improvements
- Modular code analysis architecture
- Support for multiple languages (TypeScript, JavaScript, Python, Go, Java, C/C++, Rust)
- Grouped and categorized output for better readability

#### Stats
- Total tools: 21 → 25 tools (+4 new tools)
- Code analysis utilities: 250+ LOC

---

### [2.1.0] - 2026-05-17

#### Added - Major Feature Release
- **Git Integration (8 new tools)**: Full git workflow support
  - `git_status` - Check repository status
  - `git_diff` - View staged/unstaged changes
  - `git_log` - Show commit history
  - `git_branch` - Branch management (list, create, switch, delete)
  - `git_commit` - Create commits with messages
  - `git_push` - Push to remote repositories
  - `git_pull` - Pull from remote repositories
  - `git_add` - Stage files for commit

- **Web Tools (3 new tools)**: Internet connectivity
  - `web_search` - Search the web using DuckDuckGo
  - `http_request` - Make HTTP requests (GET, POST, PUT, DELETE, PATCH)
  - `download_file` - Download files from URLs

- **File Watcher Tools (3 new tools)**: Real-time file monitoring
  - `watch_file` - Watch files/directories for changes
  - `stop_watch` - Stop watching a file/directory
  - `list_watches` - List all active file watches with recent changes

#### Security & Performance
- **Rate Limiting**: Prevent abuse and resource exhaustion
  - Bash commands: 30 per minute
  - Web requests: 20 per minute
  
- **Security Hardening**:
  - Path sanitization (prevent directory traversal)
  - Dangerous command detection (rm -rf /, fork bombs, etc.)
  - URL validation (SSRF protection, block private IPs)
  
- **Performance Optimization**:
  - File read caching (30s TTL, 100 files)
  - Directory listing cache (30s TTL, 50 dirs)
  - Reduced redundant I/O operations

#### Development Infrastructure
- **Testing Framework**: Vitest with coverage reporting
- **Code Quality**: ESLint + Prettier + TypeScript strict mode
- **Pre-commit Hooks**: Husky + lint-staged for automatic formatting
- **CI/CD Pipeline**: GitHub Actions workflow
  - Multi-version Node.js testing (18.x, 20.x)
  - Automated type checking, linting, testing
  - Code coverage upload to Codecov

#### Improvements
- Modular tool architecture (git-tools.ts, web-tools.ts, watcher-tools.ts, security.ts)
- Dynamic tool loading for better performance
- Comprehensive error handling for all new tools
- Updated documentation with all new tools

#### Stats
- Total tools: 7 → 21 tools (+14 new tools)
- Security utilities: 200+ LOC
- Test coverage infrastructure added
- CI/CD pipeline automated

---

### [2.0.0] - Previous Release

ZIP CODE has been rewritten as a modern TUI inspired by `opencode`:

- 🎨 **Ink + React TUI** with persistent header, scrolling message view, status bar, and modal panels
- ⚙️ **Settings panel (Ctrl+S)** — switch provider, edit API key, fetch models, tweak temperature/tokens
- 💾 **SQLite-backed sessions** at `~/.zipcode/zipcode.db`
- 🔧 **Tool calling** — 7 core tools
- ⚡ **Event-driven agent** — streaming tokens, parallel tool execution
- 🗂 **Session browser (Ctrl+L)** — list, switch, and create sessions
- ⌨️ **Keybinds**: `Ctrl+S` settings · `Ctrl+L` sessions · `Ctrl+N` new session

---

## Production Readiness

### Security ✅
- Rate limiting on all external operations
- Path sanitization and validation
- Command injection prevention
- SSRF protection
- Dangerous command detection

### Performance ✅
- Result caching for expensive operations
- Optimized file I/O
- Efficient tool loading
- Memory-efficient data structures

### Code Quality ✅
- TypeScript strict mode
- ESLint + Prettier
- Pre-commit hooks
- Comprehensive error handling
- Modular architecture

### Testing ✅
- Vitest test framework
- Unit tests for core tools
- Coverage reporting
- CI/CD pipeline

---

## Future Enhancements

- Plugin system for custom tools
- MCP (Model Context Protocol) support
- Syntax highlighting themes
- Multi-language support
- Voice input/output
- Web UI companion
- Docker integration
- Database tools
- Cloud provider integrations

---

## License

MIT License - See LICENSE file for details

---

**Current Version:** 2.2.0  
**Last Updated:** May 17, 2026  
**Status:** Production Ready ✅
