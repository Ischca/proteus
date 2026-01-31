// ============================================
// Stack Detection Types
// ============================================

export type Language = 
  | 'typescript'
  | 'javascript'
  | 'go'
  | 'python'
  | 'rust'
  | 'ruby'
  | 'java'
  | 'php'
  | 'unknown';

export type Framework =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'gin'
  | 'echo'
  | 'fiber'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'rails'
  | 'spring'
  | 'laravel'
  | 'actix'
  | 'axum'
  | 'unknown';

export type TestFramework =
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'pytest'
  | 'go-test'
  | 'rspec'
  | 'junit'
  | 'phpunit'
  | 'unknown';

export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'go-modules'
  | 'pip'
  | 'poetry'
  | 'cargo'
  | 'bundler'
  | 'maven'
  | 'gradle'
  | 'composer'
  | 'unknown';

export interface TechStack {
  language: Language;
  languageVersion?: string;
  framework: Framework;
  frameworkVersion?: string;
  testFramework: TestFramework;
  packageManager: PackageManager;
  styling?: string;
  database?: string;
  additionalTools: string[];
}

// ============================================
// Pattern Detection Types
// ============================================

export type NamingConvention = 
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'kebab-case'
  | 'SCREAMING_SNAKE_CASE'
  | 'mixed';

export interface NamingPatterns {
  files: {
    components?: NamingConvention;
    utilities?: NamingConvention;
    tests?: string; // e.g., "*.test.ts", "*.spec.ts"
  };
  code: {
    functions: NamingConvention;
    variables: NamingConvention;
    constants: NamingConvention;
    types?: NamingConvention;
    components?: NamingConvention;
  };
}

export interface DirectoryStructure {
  type: 'flat' | 'feature-based' | 'layer-based' | 'hybrid' | 'unknown';
  sourceDir: string;
  testDir?: string;
  keyDirectories: Array<{
    path: string;
    purpose: string;
  }>;
}

export interface CodePatterns {
  naming: NamingPatterns;
  structure: DirectoryStructure;
  imports?: {
    style: 'absolute' | 'relative' | 'mixed';
    aliases?: Record<string, string>;
  };
  exports?: {
    style: 'named' | 'default' | 'mixed';
  };
  errorHandling?: string;
  stateManagement?: string;
  dataFetching?: string;
}

// ============================================
// Command Types
// ============================================

export interface Commands {
  dev?: string;
  build?: string;
  test?: string;
  lint?: string;
  format?: string;
  typecheck?: string;
  [key: string]: string | undefined;
}

// ============================================
// Analysis Result
// ============================================

export interface AnalysisResult {
  projectName: string;
  projectPath: string;
  description?: string;
  stack: TechStack;
  patterns: CodePatterns;
  commands: Commands;
  gitInfo?: {
    defaultBranch?: string;
    hasHusky?: boolean;
  };
  confidence: {
    stack: number;      // 0-1
    patterns: number;   // 0-1
    overall: number;    // 0-1
  };
}

// ============================================
// Generator Options
// ============================================

export interface GeneratorOptions {
  template: 'minimal' | 'full';
  includeExamples: boolean;
  includeComments: boolean;
  version: string;
}

// ============================================
// CLI Options
// ============================================

export interface CLIOptions {
  output?: string;
  template: 'minimal' | 'full';
  dryRun: boolean;
  interactive: boolean;
  force: boolean;
  verbose: boolean;
}

// ============================================
// Agent Types
// ============================================

export type AgentType =
  | 'code-reviewer'
  | 'test-writer'
  | 'refactorer'
  | 'docs-writer'
  | 'api-designer'
  | 'component-builder'
  | 'db-reviewer';

export interface AgentConfig {
  directory: string;
  format: 'markdown' | 'yaml';
}

export interface GeneratedAgent {
  type: AgentType;
  name: string;
  path: string;
  content: string;
}

export interface TransformOptions {
  agents: AgentType[];
  outputDir?: string;
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  includeClaudeMd: boolean;
}

// ============================================
// Full Analysis (including documents)
// ============================================

export interface FullAnalysis {
  projectName: string;
  projectPath: string;
  analysis: AnalysisResult;
  documents: import('./detectors/documents.js').ProjectDocuments;
}
