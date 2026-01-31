import fs from 'node:fs/promises';
import path from 'node:path';
import type { Commands, TechStack } from './types.js';

interface PackageJson {
  scripts?: Record<string, string>;
}

export async function detectCommands(cwd: string, stack: TechStack): Promise<Commands> {
  const commands: Commands = {};

  // JavaScript/TypeScript projects - read from package.json
  if (stack.language === 'typescript' || stack.language === 'javascript') {
    try {
      const pkgContent = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
      const pkg: PackageJson = JSON.parse(pkgContent);
      
      if (pkg.scripts) {
        // Dev command
        const devCmd = pkg.scripts.dev || pkg.scripts.start || pkg.scripts.serve;
        if (devCmd) {
          commands.dev = findScriptRunner(cwd, stack) + ' run dev';
        }

        // Build command
        if (pkg.scripts.build) {
          commands.build = findScriptRunner(cwd, stack) + ' run build';
        }

        // Test command
        if (pkg.scripts.test) {
          commands.test = findScriptRunner(cwd, stack) + ' run test';
        }

        // Lint command
        if (pkg.scripts.lint) {
          commands.lint = findScriptRunner(cwd, stack) + ' run lint';
        }

        // Format command
        if (pkg.scripts.format) {
          commands.format = findScriptRunner(cwd, stack) + ' run format';
        }

        // Type check
        if (pkg.scripts.typecheck || pkg.scripts['type-check']) {
          commands.typecheck = findScriptRunner(cwd, stack) + ' run typecheck';
        }
      }
    } catch {
      // Fallback commands
      commands.dev = 'npm run dev';
      commands.build = 'npm run build';
      commands.test = 'npm test';
    }
  }

  // Go projects
  if (stack.language === 'go') {
    commands.build = 'go build ./...';
    commands.test = 'go test ./...';
    commands.lint = 'golangci-lint run';
    
    // Check for Makefile
    try {
      const makefile = await fs.readFile(path.join(cwd, 'Makefile'), 'utf-8');
      if (makefile.includes('run:')) commands.dev = 'make run';
      if (makefile.includes('build:')) commands.build = 'make build';
      if (makefile.includes('test:')) commands.test = 'make test';
      if (makefile.includes('lint:')) commands.lint = 'make lint';
    } catch {
      // No Makefile
    }
  }

  // Python projects
  if (stack.language === 'python') {
    commands.test = 'pytest';
    commands.lint = 'ruff check .';
    commands.format = 'ruff format .';

    // Check for Django/FastAPI
    if (stack.framework === 'django') {
      commands.dev = 'python manage.py runserver';
    } else if (stack.framework === 'fastapi') {
      commands.dev = 'uvicorn main:app --reload';
    } else if (stack.framework === 'flask') {
      commands.dev = 'flask run';
    }
  }

  // Ruby/Rails projects
  if (stack.language === 'ruby') {
    if (stack.framework === 'rails') {
      commands.dev = 'rails server';
      commands.test = 'rails test';
      commands.lint = 'rubocop';
    }
  }

  // Rust projects
  if (stack.language === 'rust') {
    commands.build = 'cargo build';
    commands.test = 'cargo test';
    commands.lint = 'cargo clippy';
    commands.dev = 'cargo run';
  }

  return commands;
}

function findScriptRunner(cwd: string, stack: TechStack): string {
  switch (stack.packageManager) {
    case 'pnpm':
      return 'pnpm';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun';
    default:
      return 'npm';
  }
}
