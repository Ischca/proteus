# 🔱 Proteus

> Shape-shifting project intelligence for Claude Code

Proteus automatically analyzes your project and generates a `CLAUDE.md` file — giving Claude Code the context it needs to understand your codebase.

## Why Proteus?

Claude Code works best when it understands your project's conventions, structure, and patterns. Instead of manually writing documentation, let Proteus detect everything automatically:

- **Tech Stack** — Language, framework, testing, styling
- **Project Structure** — Directory layout, key folders
- **Code Patterns** — Naming conventions, import/export styles
- **Commands** — Build, test, lint, dev scripts

## Installation

```bash
# Run directly with npx
npx proteus-cli

# Or install globally
npm install -g proteus-cli
```

## Usage

### Generate CLAUDE.md

```bash
# In your project directory
npx proteus-cli

# Or just
proteus
```

Proteus will:
1. Analyze your project
2. Show a summary of detected patterns
3. Generate `CLAUDE.md`
4. Ask for confirmation before saving

### Options

```bash
# Generate with minimal template
proteus --template minimal

# Preview without saving
proteus --dry-run

# Overwrite existing file
proteus --force

# Specify output path
proteus --output docs/CLAUDE.md

# Non-interactive mode
proteus --no-interactive
```

### Update Existing

```bash
# Show changes since last generation
proteus update

# Coming soon: diff view and selective merge
```

## What It Detects

### Languages
- TypeScript / JavaScript
- Go
- Python
- Rust
- Ruby
- Java
- PHP

### Frameworks
| Language | Frameworks |
|----------|------------|
| JS/TS | Next.js, React, Vue, Angular, Svelte, Express, Fastify, NestJS |
| Go | Gin, Echo, Fiber |
| Python | Django, Flask, FastAPI |
| Ruby | Rails |
| Rust | Actix, Axum |

### Additional Tools
- State management (Redux, Zustand, Jotai)
- Data fetching (React Query, SWR)
- Validation (Zod, Yup)
- Styling (Tailwind, styled-components, CSS Modules)
- ORM (Prisma, Drizzle)
- Linting (ESLint, Prettier, Biome)

## Generated CLAUDE.md

Proteus generates a structured markdown file:

```markdown
# my-project

## Tech Stack
| Category | Technology | Version |
|----------|------------|---------|
| Language | TypeScript | 5.3 |
| Framework | Next.js | 14.0 |
| Testing | Vitest | - |
| Styling | Tailwind CSS | - |

## Project Structure
- **Type**: Feature-based (modular)
- **Source Directory**: `src/`

### Key Directories
| Directory | Purpose |
|-----------|---------|
| `components/` | UI Components |
| `hooks/` | Custom React hooks |
| `lib/` | Library code |

## Commands
| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests |

## Code Conventions
### Naming
| Type | Convention |
|------|------------|
| Component files | PascalCase |
| Test files | *.test.ts |
| Functions | camelCase |

...
```

## Roadmap

- [ ] `proteus update` with diff view
- [ ] Plugin system for custom detectors
- [ ] Git hooks integration
- [ ] VS Code extension
- [ ] Support for monorepos

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT

---

<p align="center">
  <i>Named after Proteus, the shape-shifting Greek sea god who could transform into anything — just like this tool adapts to any project.</i>
</p>
