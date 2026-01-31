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
npx proteus-cli

# Or install globally
npm install -g proteus-cli
```

## Quick Start

```bash
# In your project directory
proteus

# Preview without saving
proteus --dry-run
```

Proteus will:
1. Analyze your project structure
2. Read existing CLAUDE.md (if present) for rules
3. Generate specialized agents
4. Save to `.agents/` directory

## Generated Agents

```
.agents/
├── code-reviewer.md   # コードレビュー専門
├── test-writer.md     # テスト作成専門
├── refactorer.md      # リファクタリング専門
└── docs-writer.md     # ドキュメント作成専門
```

Each agent contains:
- Project context (language, framework, tools)
- Directory structure knowledge
- Naming conventions
- Project-specific rules (from CLAUDE.md)
- Role-specific checklists

## Commands

```bash
# Default: Generate agents (transform)
proteus

# Generate specific agents only
proteus -a code-reviewer test-writer

# Generate to custom directory
proteus -o .claude/agents

# List available agent types
proteus list

# Generate CLAUDE.md only (legacy)
proteus init
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (default: `.agents`) |
| `-a, --agents <types...>` | Specific agents to generate |
| `-d, --dry-run` | Preview without saving |
| `-f, --force` | Overwrite without confirmation |
| `--include-claude-md` | Also generate CLAUDE.md |

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
│  - Existing agents                  │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  3. Generate Personalized Agents    │
│  - Project-specific knowledge       │
│  - Human-defined rules included     │
│  - Role-specific checklists         │
└─────────────────────────────────────┘
```

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

## Agent Types

| Type | Purpose |
|------|---------|
| `code-reviewer` | コードレビュー、ベストプラクティスの確認 |
| `test-writer` | テストコードの作成 |
| `refactorer` | リファクタリング、コード改善 |
| `docs-writer` | ドキュメント作成 |

## Example Output

For a Next.js + Prisma project with existing CLAUDE.md rules:

```markdown
# my-app - Code Reviewer

あなたはこのプロジェクト専属のコードレビュアーです。

## プロジェクト情報
- **言語**: TypeScript 5.3
- **フレームワーク**: Next.js 14
- **ORM**: Prisma
- **スタイリング**: Tailwind CSS

## プロジェクト固有のルール
- コミットメッセージは日本語で書く
- PRは必ずレビューを通す
- main ブランチへの直接pushは禁止

## レビューチェックリスト
- [ ] 命名規則に従っているか
- [ ] TypeScriptの型が適切か
- [ ] N+1問題がないか
- [ ] `pnpm run lint` が通るか
```

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT

---

<p align="center">
  <i>Named after Proteus, the shape-shifting Greek sea god who could transform into anything — just like this tool transforms into your project.</i>
</p>
