# ZIP CODE - Complete Changelog & Documentation

All notable changes, implementation details, and guides for ZIP CODE.

---

## Version History

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
