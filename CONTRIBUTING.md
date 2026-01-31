# Contributing to Proteus

Thank you for your interest in contributing to Proteus! 🔱

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Build: `npm run build`

## Development

```bash
# Watch mode
npm run dev

# Run on a test project
node dist/cli.js --dry-run

# Type check
npm run typecheck

# Run tests
npm run test
```

## Project Structure

```
proteus/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── types.ts         # TypeScript types
│   ├── generator.ts     # CLAUDE.md generator
│   └── detectors/
│       ├── stack.ts     # Tech stack detection
│       ├── patterns.ts  # Code pattern detection
│       └── commands.ts  # Command detection
├── dist/                # Built output
└── templates/           # Template files (future)
```

## Adding a New Language/Framework

1. Add the type to `src/types.ts`
2. Add detection logic to `src/detectors/stack.ts`
3. Add pattern detection to `src/detectors/patterns.ts`
4. Update the formatter in `src/generator.ts`
5. Add tests

Example:

```typescript
// In stack.ts
if (ctx.hasFile('pubspec.yaml')) {
  return { language: 'dart' };
}

// Check for Flutter
const pubspec = await ctx.readFile('pubspec.yaml');
if (pubspec?.includes('flutter:')) {
  return { framework: 'flutter' };
}
```

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Ensure tests pass: `npm test`
4. Ensure type check passes: `npm run typecheck`
5. Commit with a clear message
6. Push and create a PR

## Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

## Code Style

- Use TypeScript strict mode
- Use named exports (not default)
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Questions?

Feel free to open an issue for questions or discussions!
