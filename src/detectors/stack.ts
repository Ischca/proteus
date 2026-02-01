import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  TechStack,
  StackItem,
  MonorepoInfo,
  Language,
  Framework,
  TestFramework,
  PackageManager
} from './types.js';

interface DetectorContext {
  cwd: string;
  files: string[];
  dirs: string[];
  hasFile: (name: string) => boolean;
  hasDir: (name: string) => boolean;
  readJson: <T>(name: string) => Promise<T | null>;
  readFile: (name: string) => Promise<string | null>;
}

async function createContext(cwd: string): Promise<DetectorContext> {
  const entries = await fs.readdir(cwd, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  return {
    cwd,
    files,
    dirs,
    hasFile: (name: string) => files.includes(name),
    hasDir: (name: string) => dirs.includes(name),
    readJson: async <T>(name: string): Promise<T | null> => {
      try {
        const content = await fs.readFile(path.join(cwd, name), 'utf-8');
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
    readFile: async (name: string): Promise<string | null> => {
      try {
        return await fs.readFile(path.join(cwd, name), 'utf-8');
      } catch {
        return null;
      }
    },
  };
}

// ============================================
// Language Detection (returns ALL detected)
// ============================================

interface LanguageInfo {
  language: Language;
  version?: string;
}

async function detectAllLanguages(ctx: DetectorContext): Promise<LanguageInfo[]> {
  const detected: LanguageInfo[] = [];

  // TypeScript
  if (ctx.hasFile('tsconfig.json')) {
    const pkg = await ctx.readJson<{ devDependencies?: Record<string, string> }>('package.json');
    const version = pkg?.devDependencies?.typescript?.replace(/[\^~]/, '');
    detected.push({ language: 'typescript', version });
  }
  // JavaScript (if no TypeScript but has package.json)
  else if (ctx.hasFile('package.json')) {
    detected.push({ language: 'javascript' });
  }

  // Go
  if (ctx.hasFile('go.mod')) {
    const goMod = await ctx.readFile('go.mod');
    const match = goMod?.match(/^go\s+(\d+\.\d+)/m);
    detected.push({ language: 'go', version: match?.[1] });
  }

  // Python
  if (ctx.hasFile('pyproject.toml') || ctx.hasFile('requirements.txt') || ctx.hasFile('setup.py')) {
    detected.push({ language: 'python' });
  }

  // Rust
  if (ctx.hasFile('Cargo.toml')) {
    detected.push({ language: 'rust' });
  }

  // Ruby
  if (ctx.hasFile('Gemfile')) {
    detected.push({ language: 'ruby' });
  }

  // Java
  if (ctx.hasFile('pom.xml') || ctx.hasFile('build.gradle') || ctx.hasFile('build.gradle.kts')) {
    detected.push({ language: 'java' });
  }

  // PHP
  if (ctx.hasFile('composer.json')) {
    detected.push({ language: 'php' });
  }

  return detected.length > 0 ? detected : [{ language: 'unknown' }];
}

// ============================================
// Framework Detection (returns ALL detected)
// ============================================

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface FrameworkInfo {
  framework: Framework;
  version?: string;
  language: Language;
}

async function detectAllFrameworks(ctx: DetectorContext, languages: LanguageInfo[]): Promise<FrameworkInfo[]> {
  const detected: FrameworkInfo[] = [];

  // JavaScript/TypeScript frameworks
  const hasJS = languages.some(l => l.language === 'typescript' || l.language === 'javascript');
  if (hasJS) {
    const pkg = await ctx.readJson<PackageJson>('package.json');
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    const lang = languages.find(l => l.language === 'typescript')?.language || 'javascript';

    // Next.js
    if (deps?.next) {
      detected.push({ framework: 'nextjs', version: deps.next.replace(/[\^~]/, ''), language: lang });
    }

    // React (standalone, not if Next.js is present)
    if (deps?.react && !deps?.next) {
      detected.push({ framework: 'react', version: deps.react.replace(/[\^~]/, ''), language: lang });
    }

    // Vue
    if (deps?.vue) {
      detected.push({ framework: 'vue', version: deps.vue.replace(/[\^~]/, ''), language: lang });
    }

    // Angular
    if (deps?.['@angular/core']) {
      detected.push({ framework: 'angular', version: deps['@angular/core'].replace(/[\^~]/, ''), language: lang });
    }

    // Svelte
    if (deps?.svelte) {
      detected.push({ framework: 'svelte', version: deps.svelte.replace(/[\^~]/, ''), language: lang });
    }

    // NestJS
    if (deps?.['@nestjs/core']) {
      detected.push({ framework: 'nestjs', version: deps['@nestjs/core'].replace(/[\^~]/, ''), language: lang });
    }

    // Express
    if (deps?.express) {
      detected.push({ framework: 'express', version: deps.express.replace(/[\^~]/, ''), language: lang });
    }

    // Fastify
    if (deps?.fastify) {
      detected.push({ framework: 'fastify', version: deps.fastify.replace(/[\^~]/, ''), language: lang });
    }
  }

  // Go frameworks
  if (languages.some(l => l.language === 'go')) {
    const goMod = await ctx.readFile('go.mod');

    if (goMod?.includes('github.com/gin-gonic/gin')) {
      detected.push({ framework: 'gin', language: 'go' });
    }
    if (goMod?.includes('github.com/labstack/echo')) {
      detected.push({ framework: 'echo', language: 'go' });
    }
    if (goMod?.includes('github.com/gofiber/fiber')) {
      detected.push({ framework: 'fiber', language: 'go' });
    }
  }

  // Python frameworks
  if (languages.some(l => l.language === 'python')) {
    const requirements = await ctx.readFile('requirements.txt');
    const pyproject = await ctx.readFile('pyproject.toml');
    const content = (requirements || '') + (pyproject || '');

    if (content.includes('django')) detected.push({ framework: 'django', language: 'python' });
    if (content.includes('fastapi')) detected.push({ framework: 'fastapi', language: 'python' });
    if (content.includes('flask')) detected.push({ framework: 'flask', language: 'python' });
  }

  // Ruby frameworks
  if (languages.some(l => l.language === 'ruby')) {
    const gemfile = await ctx.readFile('Gemfile');
    if (gemfile?.includes('rails')) detected.push({ framework: 'rails', language: 'ruby' });
  }

  // Rust frameworks
  if (languages.some(l => l.language === 'rust')) {
    const cargo = await ctx.readFile('Cargo.toml');
    if (cargo?.includes('actix-web')) detected.push({ framework: 'actix', language: 'rust' });
    if (cargo?.includes('axum')) detected.push({ framework: 'axum', language: 'rust' });
  }

  return detected;
}

// ============================================
// Test Framework Detection
// ============================================

async function detectTestFramework(ctx: DetectorContext, language: Language): Promise<TestFramework> {
  if (language === 'typescript' || language === 'javascript') {
    const pkg = await ctx.readJson<PackageJson>('package.json');
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

    if (deps?.vitest || ctx.hasFile('vitest.config.ts') || ctx.hasFile('vitest.config.js')) {
      return 'vitest';
    }
    if (deps?.jest || ctx.hasFile('jest.config.js') || ctx.hasFile('jest.config.ts')) {
      return 'jest';
    }
    if (deps?.mocha) {
      return 'mocha';
    }
  }

  if (language === 'go') {
    return 'go-test';
  }

  if (language === 'python') {
    const content = (await ctx.readFile('requirements.txt') || '') +
                   (await ctx.readFile('pyproject.toml') || '');
    if (content.includes('pytest')) return 'pytest';
  }

  if (language === 'ruby') {
    const gemfile = await ctx.readFile('Gemfile');
    if (gemfile?.includes('rspec')) return 'rspec';
  }

  return 'unknown';
}

// ============================================
// Package Manager Detection
// ============================================

async function detectPackageManager(ctx: DetectorContext, language: Language): Promise<PackageManager> {
  if (language === 'typescript' || language === 'javascript') {
    if (ctx.hasFile('bun.lockb')) return 'bun';
    if (ctx.hasFile('pnpm-lock.yaml')) return 'pnpm';
    if (ctx.hasFile('yarn.lock')) return 'yarn';
    if (ctx.hasFile('package-lock.json')) return 'npm';
    return 'npm'; // default
  }

  if (language === 'go') return 'go-modules';
  if (language === 'python') {
    if (ctx.hasFile('poetry.lock')) return 'poetry';
    return 'pip';
  }
  if (language === 'rust') return 'cargo';
  if (language === 'ruby') return 'bundler';
  if (language === 'java') {
    if (ctx.hasFile('pom.xml')) return 'maven';
    return 'gradle';
  }
  if (language === 'php') return 'composer';

  return 'unknown';
}

// ============================================
// Monorepo Detection
// ============================================

interface WorkspacePackageJson {
  workspaces?: string[] | { packages?: string[] };
}

interface PnpmWorkspace {
  packages?: string[];
}

async function detectMonorepo(ctx: DetectorContext): Promise<MonorepoInfo | undefined> {
  // Check for pnpm workspaces
  if (ctx.hasFile('pnpm-workspace.yaml')) {
    const content = await ctx.readFile('pnpm-workspace.yaml');
    const match = content?.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
    const workspaces = match?.[1]
      .split('\n')
      .map(line => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
      .filter(Boolean) || [];
    return {
      type: 'pnpm-workspaces',
      rootPath: ctx.cwd,
      workspaces,
    };
  }

  // Check for npm/yarn workspaces in package.json
  const pkg = await ctx.readJson<WorkspacePackageJson>('package.json');
  if (pkg?.workspaces) {
    const workspaces = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces.packages || [];

    // Determine type based on lock file
    let type: MonorepoInfo['type'] = 'npm-workspaces';
    if (ctx.hasFile('yarn.lock')) type = 'yarn-workspaces';

    return {
      type,
      rootPath: ctx.cwd,
      workspaces,
    };
  }

  // Check for Turborepo
  if (ctx.hasFile('turbo.json')) {
    const pkgWorkspaces = pkg?.workspaces;
    const workspaces = Array.isArray(pkgWorkspaces)
      ? pkgWorkspaces
      : (pkgWorkspaces as { packages?: string[] })?.packages || ['packages/*', 'apps/*'];
    return {
      type: 'turborepo',
      rootPath: ctx.cwd,
      workspaces,
    };
  }

  // Check for Nx
  if (ctx.hasFile('nx.json')) {
    return {
      type: 'nx',
      rootPath: ctx.cwd,
      workspaces: ['packages/*', 'apps/*', 'libs/*'],
    };
  }

  // Check for Lerna
  if (ctx.hasFile('lerna.json')) {
    const lerna = await ctx.readJson<{ packages?: string[] }>('lerna.json');
    return {
      type: 'lerna',
      rootPath: ctx.cwd,
      workspaces: lerna?.packages || ['packages/*'],
    };
  }

  // Check for Go workspace
  if (ctx.hasFile('go.work')) {
    const content = await ctx.readFile('go.work');
    const matches = content?.match(/use\s+\(\s*([\s\S]*?)\s*\)/);
    const workspaces = matches?.[1]
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean) || [];
    return {
      type: 'go-workspace',
      rootPath: ctx.cwd,
      workspaces,
    };
  }

  // Check for Cargo workspace
  const cargoToml = await ctx.readFile('Cargo.toml');
  if (cargoToml?.includes('[workspace]')) {
    const match = cargoToml.match(/members\s*=\s*\[([\s\S]*?)\]/);
    const workspaces = match?.[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean) || [];
    return {
      type: 'cargo-workspace',
      rootPath: ctx.cwd,
      workspaces,
    };
  }

  return undefined;
}

// ============================================
// Scan Subdirectories for Stacks
// ============================================

async function scanSubdirectories(cwd: string, patterns: string[]): Promise<string[]> {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    // Handle glob patterns like "packages/*", "apps/*"
    if (pattern.includes('*')) {
      const basePath = pattern.replace(/\/?\*.*$/, '');
      const fullBasePath = path.join(cwd, basePath);

      try {
        const entries = await fs.readdir(fullBasePath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            dirs.push(path.join(basePath, entry.name));
          }
        }
      } catch {
        // Directory doesn't exist
      }
    } else {
      // Direct path
      try {
        const stat = await fs.stat(path.join(cwd, pattern));
        if (stat.isDirectory()) {
          dirs.push(pattern);
        }
      } catch {
        // Directory doesn't exist
      }
    }
  }

  return dirs;
}

async function detectStackInDirectory(cwd: string, relativePath: string): Promise<StackItem | null> {
  const fullPath = path.join(cwd, relativePath);

  try {
    const ctx = await createContext(fullPath);
    const languages = await detectAllLanguages(ctx);

    if (languages.length === 0 || (languages.length === 1 && languages[0].language === 'unknown')) {
      return null;
    }

    const frameworks = await detectAllFrameworks(ctx, languages);

    // Determine primary language based on framework if available
    // If a framework is detected, its associated language should be primary
    let primaryLang = languages[0];
    let primaryFramework = frameworks[0];

    if (frameworks.length > 0) {
      // Prioritize "real" application frameworks over tooling
      // Rails, Django, etc. are more indicative of the primary language than React in a Rails app
      const appFrameworks = ['rails', 'django', 'flask', 'fastapi', 'gin', 'echo', 'fiber', 'nestjs', 'actix', 'axum', 'spring', 'laravel'];
      const primaryAppFramework = frameworks.find(f => appFrameworks.includes(f.framework));

      if (primaryAppFramework) {
        primaryFramework = primaryAppFramework;
        primaryLang = languages.find(l => l.language === primaryAppFramework.language) || primaryLang;
      } else {
        // Use the first framework's language
        primaryFramework = frameworks[0];
        primaryLang = languages.find(l => l.language === frameworks[0].language) || primaryLang;
      }
    }

    const testFramework = await detectTestFramework(ctx, primaryLang.language);
    const packageManager = await detectPackageManager(ctx, primaryLang.language);

    // Try to get package name
    const pkg = await ctx.readJson<{ name?: string }>('package.json');
    const cargoToml = await ctx.readFile('Cargo.toml');
    const goMod = await ctx.readFile('go.mod');

    let name = pkg?.name;
    if (!name && cargoToml) {
      const match = cargoToml.match(/name\s*=\s*"([^"]+)"/);
      name = match?.[1];
    }
    if (!name && goMod) {
      const match = goMod.match(/module\s+(\S+)/);
      name = match?.[1]?.split('/').pop();
    }

    return {
      language: primaryLang.language,
      languageVersion: primaryLang.version,
      framework: primaryFramework?.framework || 'unknown',
      frameworkVersion: primaryFramework?.version,
      testFramework,
      packageManager,
      path: relativePath,
      name,
    };
  } catch {
    return null;
  }
}

// ============================================
// Additional Tools Detection
// ============================================

async function detectAdditionalTools(ctx: DetectorContext, language: Language): Promise<{
  styling?: string;
  database?: string;
  additionalTools: string[];
}> {
  const tools: string[] = [];
  let styling: string | undefined;
  let database: string | undefined;

  if (language === 'typescript' || language === 'javascript') {
    const pkg = await ctx.readJson<PackageJson>('package.json');
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

    // Styling
    if (deps?.tailwindcss || ctx.hasFile('tailwind.config.js') || ctx.hasFile('tailwind.config.ts')) {
      styling = 'Tailwind CSS';
    } else if (deps?.['styled-components']) {
      styling = 'styled-components';
    } else if (deps?.['@emotion/react']) {
      styling = 'Emotion';
    } else if (ctx.files.some(f => f.endsWith('.module.css') || f.endsWith('.module.scss'))) {
      styling = 'CSS Modules';
    }

    // Database / ORM
    if (deps?.prisma || deps?.['@prisma/client']) {
      database = 'Prisma';
      tools.push('Prisma');
    }
    if (deps?.drizzle || deps?.['drizzle-orm']) {
      database = 'Drizzle';
      tools.push('Drizzle');
    }

    // State Management
    if (deps?.zustand) tools.push('Zustand');
    if (deps?.['@reduxjs/toolkit'] || deps?.redux) tools.push('Redux');
    if (deps?.jotai) tools.push('Jotai');
    if (deps?.recoil) tools.push('Recoil');

    // Data Fetching
    if (deps?.['@tanstack/react-query']) tools.push('React Query');
    if (deps?.swr) tools.push('SWR');
    if (deps?.axios) tools.push('Axios');

    // Validation
    if (deps?.zod) tools.push('Zod');
    if (deps?.yup) tools.push('Yup');

    // Linting/Formatting
    if (deps?.eslint || ctx.files.some(f => f.startsWith('.eslintrc'))) tools.push('ESLint');
    if (deps?.prettier || ctx.hasFile('.prettierrc') || ctx.hasFile('prettier.config.js')) tools.push('Prettier');
    if (deps?.biome || ctx.hasFile('biome.json')) tools.push('Biome');

    // Other
    if (ctx.hasFile('docker-compose.yml') || ctx.hasFile('docker-compose.yaml')) tools.push('Docker');
    if (ctx.hasDir('.github')) tools.push('GitHub Actions');
  }

  return { styling, database, additionalTools: tools };
}

// ============================================
// Main Detection Function
// ============================================

export async function detectStack(cwd: string): Promise<TechStack> {
  const ctx = await createContext(cwd);

  // Detect monorepo first
  const monorepo = await detectMonorepo(ctx);

  // Collect all stacks
  const stacks: StackItem[] = [];

  if (monorepo) {
    // Scan workspace directories
    const workspaceDirs = await scanSubdirectories(cwd, monorepo.workspaces);

    for (const dir of workspaceDirs) {
      const stack = await detectStackInDirectory(cwd, dir);
      if (stack) {
        stacks.push(stack);
      }
    }

    // Also check root if it has its own stack
    const rootStack = await detectStackInDirectory(cwd, '.');
    if (rootStack && rootStack.language !== 'unknown') {
      rootStack.path = '.';
      rootStack.name = 'root';
      stacks.unshift(rootStack);
    }
  } else {
    // Non-monorepo: just detect root
    const languages = await detectAllLanguages(ctx);
    const frameworks = await detectAllFrameworks(ctx, languages);

    // Prioritize app frameworks to determine language order
    const appFrameworks = ['rails', 'django', 'flask', 'fastapi', 'gin', 'echo', 'fiber', 'nestjs', 'actix', 'axum', 'spring', 'laravel'];
    const primaryAppFramework = frameworks.find(f => appFrameworks.includes(f.framework));

    // Reorder languages to put the primary framework's language first
    let orderedLanguages = [...languages];
    if (primaryAppFramework) {
      orderedLanguages = [
        ...languages.filter(l => l.language === primaryAppFramework.language),
        ...languages.filter(l => l.language !== primaryAppFramework.language),
      ];
    }

    for (const lang of orderedLanguages) {
      if (lang.language === 'unknown') continue;

      const langFrameworks = frameworks.filter(f => f.language === lang.language);
      const testFramework = await detectTestFramework(ctx, lang.language);
      const packageManager = await detectPackageManager(ctx, lang.language);

      if (langFrameworks.length > 0) {
        for (const fw of langFrameworks) {
          stacks.push({
            language: lang.language,
            languageVersion: lang.version,
            framework: fw.framework,
            frameworkVersion: fw.version,
            testFramework,
            packageManager,
            path: '.',
          });
        }
      } else {
        stacks.push({
          language: lang.language,
          languageVersion: lang.version,
          framework: 'unknown',
          testFramework,
          packageManager,
          path: '.',
        });
      }
    }
  }

  // If no stacks detected, add unknown
  if (stacks.length === 0) {
    stacks.push({
      language: 'unknown',
      framework: 'unknown',
      testFramework: 'unknown',
      packageManager: 'unknown',
      path: '.',
    });
  }

  // Primary stack (first one)
  const primary = stacks[0];

  // Additional tools (from root)
  const { styling, database, additionalTools } = await detectAdditionalTools(ctx, primary.language);

  // Aggregate all unique languages and frameworks
  const allLanguages = [...new Set(stacks.map(s => s.language))].filter(l => l !== 'unknown') as Language[];
  const allFrameworks = [...new Set(stacks.map(s => s.framework))].filter(f => f !== 'unknown') as Framework[];

  return {
    // Primary (backwards compatibility)
    language: primary.language,
    languageVersion: primary.languageVersion,
    framework: primary.framework,
    frameworkVersion: primary.frameworkVersion,
    testFramework: primary.testFramework,
    packageManager: primary.packageManager,
    styling,
    database,
    additionalTools,

    // Multiple stacks
    stacks,

    // Monorepo info
    monorepo,

    // Aggregated
    allLanguages: allLanguages.length > 0 ? allLanguages : [primary.language],
    allFrameworks: allFrameworks.length > 0 ? allFrameworks : [primary.framework],
  };
}
