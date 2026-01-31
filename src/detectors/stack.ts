import fs from 'node:fs/promises';
import path from 'node:path';
import type { 
  TechStack, 
  Language, 
  Framework, 
  TestFramework, 
  PackageManager 
} from './types.js';

interface DetectorContext {
  cwd: string;
  files: string[];
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
// Language Detection
// ============================================

async function detectLanguage(ctx: DetectorContext): Promise<{ language: Language; version?: string }> {
  // TypeScript
  if (ctx.hasFile('tsconfig.json')) {
    const pkg = await ctx.readJson<{ devDependencies?: Record<string, string> }>('package.json');
    const version = pkg?.devDependencies?.typescript?.replace('^', '').replace('~', '');
    return { language: 'typescript', version };
  }

  // Go
  if (ctx.hasFile('go.mod')) {
    const goMod = await ctx.readFile('go.mod');
    const match = goMod?.match(/^go\s+(\d+\.\d+)/m);
    return { language: 'go', version: match?.[1] };
  }

  // Python
  if (ctx.hasFile('pyproject.toml') || ctx.hasFile('requirements.txt') || ctx.hasFile('setup.py')) {
    return { language: 'python' };
  }

  // Rust
  if (ctx.hasFile('Cargo.toml')) {
    return { language: 'rust' };
  }

  // Ruby
  if (ctx.hasFile('Gemfile')) {
    return { language: 'ruby' };
  }

  // Java
  if (ctx.hasFile('pom.xml') || ctx.hasFile('build.gradle') || ctx.hasFile('build.gradle.kts')) {
    return { language: 'java' };
  }

  // PHP
  if (ctx.hasFile('composer.json')) {
    return { language: 'php' };
  }

  // JavaScript (fallback if package.json exists)
  if (ctx.hasFile('package.json')) {
    return { language: 'javascript' };
  }

  return { language: 'unknown' };
}

// ============================================
// Framework Detection
// ============================================

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function detectFramework(ctx: DetectorContext, language: Language): Promise<{ framework: Framework; version?: string }> {
  // JavaScript/TypeScript frameworks
  if (language === 'typescript' || language === 'javascript') {
    const pkg = await ctx.readJson<PackageJson>('package.json');
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

    // Next.js
    if (deps?.next) {
      return { framework: 'nextjs', version: deps.next.replace('^', '').replace('~', '') };
    }

    // React (standalone)
    if (deps?.react && !deps?.next) {
      // Check for meta-frameworks
      if (deps?.['@remix-run/react']) return { framework: 'react', version: deps.react };
      return { framework: 'react', version: deps.react.replace('^', '').replace('~', '') };
    }

    // Vue
    if (deps?.vue) {
      return { framework: 'vue', version: deps.vue.replace('^', '').replace('~', '') };
    }

    // Angular
    if (deps?.['@angular/core']) {
      return { framework: 'angular', version: deps['@angular/core'].replace('^', '').replace('~', '') };
    }

    // Svelte
    if (deps?.svelte) {
      return { framework: 'svelte', version: deps.svelte.replace('^', '').replace('~', '') };
    }

    // NestJS
    if (deps?.['@nestjs/core']) {
      return { framework: 'nestjs', version: deps['@nestjs/core'].replace('^', '').replace('~', '') };
    }

    // Express
    if (deps?.express) {
      return { framework: 'express', version: deps.express.replace('^', '').replace('~', '') };
    }

    // Fastify
    if (deps?.fastify) {
      return { framework: 'fastify', version: deps.fastify.replace('^', '').replace('~', '') };
    }
  }

  // Go frameworks
  if (language === 'go') {
    const goMod = await ctx.readFile('go.mod');
    
    if (goMod?.includes('github.com/gin-gonic/gin')) {
      return { framework: 'gin' };
    }
    if (goMod?.includes('github.com/labstack/echo')) {
      return { framework: 'echo' };
    }
    if (goMod?.includes('github.com/gofiber/fiber')) {
      return { framework: 'fiber' };
    }
  }

  // Python frameworks
  if (language === 'python') {
    const requirements = await ctx.readFile('requirements.txt');
    const pyproject = await ctx.readFile('pyproject.toml');
    const content = (requirements || '') + (pyproject || '');

    if (content.includes('django')) return { framework: 'django' };
    if (content.includes('fastapi')) return { framework: 'fastapi' };
    if (content.includes('flask')) return { framework: 'flask' };
  }

  // Ruby frameworks
  if (language === 'ruby') {
    const gemfile = await ctx.readFile('Gemfile');
    if (gemfile?.includes('rails')) return { framework: 'rails' };
  }

  // Rust frameworks
  if (language === 'rust') {
    const cargo = await ctx.readFile('Cargo.toml');
    if (cargo?.includes('actix-web')) return { framework: 'actix' };
    if (cargo?.includes('axum')) return { framework: 'axum' };
  }

  return { framework: 'unknown' };
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
    if (ctx.hasFile('.github')) tools.push('GitHub Actions');
  }

  return { styling, database, additionalTools: tools };
}

// ============================================
// Main Detection Function
// ============================================

export async function detectStack(cwd: string): Promise<TechStack> {
  const ctx = await createContext(cwd);

  const { language, version: languageVersion } = await detectLanguage(ctx);
  const { framework, version: frameworkVersion } = await detectFramework(ctx, language);
  const testFramework = await detectTestFramework(ctx, language);
  const packageManager = await detectPackageManager(ctx, language);
  const { styling, database, additionalTools } = await detectAdditionalTools(ctx, language);

  return {
    language,
    languageVersion,
    framework,
    frameworkVersion,
    testFramework,
    packageManager,
    styling,
    database,
    additionalTools,
  };
}
