# ZIP CODE - Complete Changelog & Documentation

All notable changes, implementation details, and guides for ZIP CODE.

---

## Version History

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
