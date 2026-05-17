# Contributing to ZIP CODE

Thanks for your interest in contributing! ZIP CODE welcomes contributions of all kinds.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Zip-Code.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

### Setup

```bash
npm install
npm run build
```

### Run in dev mode

```bash
npm run dev
```

### Run tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Code Quality

```bash
npm run lint            # Lint code
npm run lint:fix        # Auto-fix lint issues
npm run format          # Format code
npm run typecheck       # TypeScript check
```

## Coding Standards

- **TypeScript strict mode** is enforced
- **ESLint + Prettier** must pass before commit (handled by pre-commit hooks)
- Follow the existing code style and patterns
- Write tests for new features
- Update documentation when adding new tools or features

## Adding a New Tool

1. Create a new file in `src/` (e.g. `src/my-tool.ts`)
2. Define tool schema and implementation:

```typescript
import type { ToolDefinition, ToolResult } from './types';

export const MY_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'What the tool does',
      parameters: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Param description' },
        },
        required: ['param'],
      },
    },
  },
];

export async function myTool(param: string): Promise<ToolResult> {
  try {
    // Implementation
    return { success: true, output: 'result' };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Error: ${error?.message || error}`,
    };
  }
}
```

3. Register in `src/tools.ts`:
   - Add to TOOLS array import
   - Add case in `executeTool` switch
4. Add tests in `test/my-tool.test.ts`
5. Update README.md tool table

## Commit Messages

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance
- `perf:` Performance improvement
- `ci:` CI/CD changes

Example: `feat: add database query tool`

## Pull Request Process

1. Update README.md with details of changes if needed
2. Update CHANGELOG.md with your changes under `[Unreleased]`
3. Ensure all tests pass: `npm test`
4. Ensure no lint errors: `npm run lint`
5. Open a PR with clear description
6. PR will be reviewed and merged after approval

## Security

If you discover a security vulnerability, please **do not** open a public issue. See [SECURITY.md](SECURITY.md) for reporting instructions.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## License

By contributing, you agree your contributions will be licensed under the MIT License.
