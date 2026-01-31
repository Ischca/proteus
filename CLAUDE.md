# CLAUDE.md

## Project Overview

Proteus CLI is a TypeScript-based command-line interface tool. The project uses modern TypeScript with Vitest for testing.

## Tech Stack

- **Language**: TypeScript 5.3.3
- **Runtime**: Node.js
- **Test Framework**: Vitest
- **Package Manager**: npm

## Project Structure

```
proteus/
├── src/           # Source code
├── package.json
└── tsconfig.json
```

## Commands

| Task | Command |
|------|---------|
| Development | `npm run dev` |
| Build | `npm run build` |
| Test | `npm run test` |

## Code Conventions

### Naming

- **Functions**: camelCase (e.g., `processInput`, `validateConfig`)
- **Variables**: camelCase (e.g., `userInput`, `configPath`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (e.g., `UserConfig`, `CommandOptions`)

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer explicit type annotations for function parameters and return types
- Use interfaces for object shapes, type aliases for unions and primitives
- Avoid `any` type - use `unknown` when type is truly unknown

### Code Style

- Use ES modules (import/export)
- Prefer async/await over raw promises
- Keep functions small and focused on a single responsibility
- Add JSDoc comments for public APIs and complex logic

## Testing

- Write tests alongside the code they test
- Use descriptive test names that explain the expected behavior
- Run `npm run test` before committing changes

## Git Conventions

- Write concise commit messages focused on the "why" (intent) rather than "what"
- Do not include co-author attributions in commit messages