# 🔱 Proteus

> Shape-shifting project intelligence for Claude Code

Proteus analyzes your project and generates **project-specific agents** — specialized AI assistants that understand your codebase's language, framework, conventions, and rules.

## Why Proteus?

Claude Code works best with context. But generic agents don't know your project's:
- Coding conventions and style
- Directory structure
- Testing patterns
- Project-specific rules

**Proteus transforms into your project**, creating personalized agents that already understand everything.

## Installation

```bash
# Run directly with npx
npx agent-proteus

# Or install globally
npm install -g agent-proteus
```

## Quick Start

```bash
# In your project directory
proteus

# Preview without saving
proteus --dry-run

# Specify output language
proteus --lang ja
```

Proteus will:
1. Analyze your project structure
2. Read existing CLAUDE.md (if present) for rules
3. Suggest project-specific agents using Claude Code
4. Generate selected agents to `.claude/agents/`
5. Optionally generate `/proteus` skill for easy routing

## Generated Structure

```
.claude/
├── agents/                    # Project-specific agents
│   ├── rails-graphql-type-generator.md
│   ├── rspec-request-spec-writer.md
│   └── ...
└── skills/
    └── proteus/
        └── SKILL.md           # Router skill for agents
```

## Commands

```bash
# Default: Analyze and generate agents
proteus

# Generate CLAUDE.md only
proteus init

# Update agent list in CLAUDE.md or agents.md
proteus registry

# Just analyze (no generation)
proteus analyze
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (default: `.claude/agents`) |
| `-l, --lang <code>` | Output language (en, ja, zh, ko, es, fr, de) |
| `-d, --dry-run` | Preview without saving |
| `-f, --force` | Skip confirmations |
| `--include-claude-md` | Also generate CLAUDE.md if not exists |

## How It Works

```
┌─────────────────────────────────────┐
│  1. Analyze Project                 │
│  - Language, framework, tools       │
│  - Directory structure              │
│  - Naming conventions               │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  2. Read Existing Documents         │
│  - CLAUDE.md (rules, conventions)   │
│  - README.md (description)          │
│  - Existing agents (avoids dupes)   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  3. Suggest Agents (via Claude)     │
│  - Dynamic based on your stack      │
│  - Considers existing coverage      │
│  - Project-specific naming          │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  4. Generate & Save                 │
│  - Personalized agent definitions   │
│  - /proteus skill for routing       │
│  - Registry in CLAUDE.md            │
└─────────────────────────────────────┘
```

## Smart Agent Suggestions

Proteus adjusts suggestions based on existing coverage:

| Existing Agents | Max Suggestions |
|-----------------|-----------------|
| 0 | 5 agents |
| 1-2 | 3 agents |
| 3-4 | 2 agents |
| 5+ | 0-1 agents (if gaps exist) |

## Supported Languages & Frameworks

| Language | Frameworks |
|----------|------------|
| TypeScript/JavaScript | Next.js, React, Vue, Angular, Svelte, Express, Fastify, NestJS |
| Go | Gin, Echo, Fiber |
| Python | Django, Flask, FastAPI |
| Ruby | Rails |
| Rust | Actix, Axum |
| Java | Spring |
| PHP | Laravel |

## Example: Rails Project

```bash
$ proteus

🔱 PROTEUS - Shape-shifting project intelligence

✓ Claude Code detected - using AI-powered generation
✔ Output language: 日本語

Tech Stack:
  Language:    ruby
  Framework:   rails
  Testing:     rspec

Recommended agents:
  1. rails-graphql-type-generator
  2. serializable-pattern-enforcer
  3. rspec-request-spec-writer
  ...

✅ Created .claude/agents/rails-graphql-type-generator.md
✅ Created .claude/skills/proteus/SKILL.md
```

## Using Generated Agents

```bash
# Use specific agent
@rails-graphql-type-generator このResolverをレビューして

# Use /proteus to auto-route
/proteus テストを書いて  # → automatically uses rspec-request-spec-writer
```

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT

---

<p align="center">
  <i>Named after Proteus, the shape-shifting Greek sea god who could transform into anything — just like this tool transforms into your project.</i>
</p>
