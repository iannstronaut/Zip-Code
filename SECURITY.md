# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported |
| ------- | --------- |
| 2.2.x   | ✅        |
| 2.1.x   | ✅        |
| 2.0.x   | ⚠️ Critical fixes only |
| < 2.0   | ❌        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, report it privately:

1. Open a GitHub Security Advisory: https://github.com/ianns-astronot/Zip-Code/security/advisories/new
2. Or email the maintainers directly

### What to Include

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)
- Your contact info for follow-up

### Response Timeline

- **Initial response**: Within 48 hours
- **Triage**: Within 7 days
- **Fix timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Next minor release

## Security Features

ZIP CODE includes built-in security features:

### Path Traversal Protection
All file operations use `sanitizePath()` to prevent directory traversal attacks (`../../../etc/passwd`).

### Dangerous Command Detection
Bash execution blocks known dangerous patterns:
- `rm -rf /`
- Fork bombs
- Filesystem operations (`mkfs`, `dd if=...of=/dev/...`)
- Pipe-to-shell attacks (`curl ... | bash`)
- Permission abuse (`chmod 777`, `chown root`)

### SSRF Protection
HTTP requests block:
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Localhost (127.x, ::1)
- Link-local (169.254.x, fe80::)
- Non-HTTP protocols (file://, ftp://, etc.)

### Rate Limiting
- Bash commands: 30/minute
- Web requests: 20/minute
- Prevents abuse and resource exhaustion

### Secrets Sanitization
The logger automatically redacts sensitive data:
- API keys
- Passwords
- Tokens
- Authorization headers

## Best Practices for Users

### API Keys
- Never commit API keys to git
- Use environment variables or the in-app settings panel
- Rotate keys regularly
- Use minimum-privilege scopes

### Tool Execution
- Review what the agent plans to do before approving destructive operations
- Use `ask_user` confirmations for sensitive actions
- Keep your `.env` file out of version control (already in `.gitignore`)

### Updates
- Keep ZIP CODE updated to receive security patches
- Run `npm audit` regularly to check dependencies
- Subscribe to security advisories

## Disclosure Policy

We follow responsible disclosure:

1. Vulnerability reported privately
2. Maintainers confirm and develop fix
3. Fix released in a security update
4. Public disclosure 7 days after fix is available
5. Credit given to the reporter (unless they prefer anonymity)

## Hall of Fame

Security researchers who responsibly disclosed vulnerabilities will be credited here.

---

Thanks for helping keep ZIP CODE and its users safe!
