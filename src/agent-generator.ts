import type { AnalysisResult } from './types.js';
import type { ProjectDocuments } from './detectors/documents.js';
import {
  isClaudeAvailable,
  suggestAgents as claudeSuggestAgents,
  generateAgentContent as claudeGenerateAgent,
  type AgentSuggestion,
} from './claude-bridge.js';

export interface GeneratedAgent {
  name: string;
  description: string;
  content: string;
  path: string;
}

export interface AgentGeneratorOptions {
  outputDir?: string;
  verbose?: boolean;
}

// Re-export for convenience
export type { AgentSuggestion } from './claude-bridge.js';

/**
 * Get agent suggestions from Claude Code based on project analysis
 */
export function suggestAgents(
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: AgentGeneratorOptions = {}
): AgentSuggestion[] {
  if (!isClaudeAvailable()) {
    if (options.verbose) {
      console.log('⚠️ Claude Codeが利用できないため、デフォルトの提案を使用します');
    }
    return getDefaultSuggestions(analysis);
  }

  try {
    if (options.verbose) {
      console.log('🤖 Claude Codeにエージェント候補を問い合わせ中...');
    }
    return claudeSuggestAgents(analysis, documents, { verbose: options.verbose });
  } catch (error) {
    if (options.verbose) {
      console.warn('⚠️ Claude Code呼び出しに失敗、デフォルトの提案を使用します');
      if (error instanceof Error) {
        console.warn(`  詳細: ${error.message}`);
      }
    }
    return getDefaultSuggestions(analysis);
  }
}

/**
 * Generate a single agent using Claude Code
 */
export function generateAgent(
  suggestion: AgentSuggestion,
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: AgentGeneratorOptions = {}
): GeneratedAgent {
  const outputDir = options.outputDir || '.agents';

  if (!isClaudeAvailable()) {
    if (options.verbose) {
      console.log(`⚠️ Claude Codeが利用できないため、${suggestion.name}のフォールバックを使用します`);
    }
    return {
      name: suggestion.name,
      description: suggestion.description,
      content: generateFallbackAgent(suggestion, analysis, documents),
      path: `${outputDir}/${suggestion.name}.md`,
    };
  }

  try {
    if (options.verbose) {
      console.log(`🤖 ${suggestion.name} エージェントを生成中...`);
    }
    const content = claudeGenerateAgent(
      suggestion.name,
      suggestion.description,
      analysis,
      documents,
      { verbose: options.verbose }
    );

    return {
      name: suggestion.name,
      description: suggestion.description,
      content,
      path: `${outputDir}/${suggestion.name}.md`,
    };
  } catch (error) {
    if (options.verbose) {
      console.warn(`⚠️ ${suggestion.name}の生成に失敗、フォールバックを使用します`);
      if (error instanceof Error) {
        console.warn(`  詳細: ${error.message}`);
      }
    }
    return {
      name: suggestion.name,
      description: suggestion.description,
      content: generateFallbackAgent(suggestion, analysis, documents),
      path: `${outputDir}/${suggestion.name}.md`,
    };
  }
}

/**
 * Generate multiple agents
 */
export function generateAgents(
  suggestions: AgentSuggestion[],
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: AgentGeneratorOptions = {}
): GeneratedAgent[] {
  return suggestions.map(suggestion =>
    generateAgent(suggestion, analysis, documents, options)
  );
}

// ============================================
// Fallback Functions (when Claude is not available)
// ============================================

function getDefaultSuggestions(analysis: AnalysisResult): AgentSuggestion[] {
  const suggestions: AgentSuggestion[] = [];
  const { stack } = analysis;

  // Code reviewer - always useful
  suggestions.push({
    name: 'code-reviewer',
    description: `${formatLanguage(stack.language)}コードのレビュー専門エージェント`,
    focus: 'コード品質、ベストプラクティス、セキュリティ',
    reason: 'コードレビューは全てのプロジェクトで有効',
  });

  // Test writer - if test framework exists
  if (stack.testFramework !== 'unknown') {
    suggestions.push({
      name: 'test-writer',
      description: `${formatTestFramework(stack.testFramework)}でのテスト作成専門エージェント`,
      focus: 'ユニットテスト、統合テスト、テストカバレッジ',
      reason: `${formatTestFramework(stack.testFramework)}が検出されたため`,
    });
  }

  // Framework-specific agents
  if (stack.framework !== 'unknown') {
    if (['react', 'vue', 'svelte', 'angular'].includes(stack.framework)) {
      suggestions.push({
        name: 'component-builder',
        description: `${formatFramework(stack.framework)}コンポーネント設計専門エージェント`,
        focus: 'コンポーネント設計、状態管理、パフォーマンス',
        reason: `${formatFramework(stack.framework)}プロジェクトのため`,
      });
    } else if (['express', 'fastify', 'nestjs', 'fastapi', 'gin'].includes(stack.framework)) {
      suggestions.push({
        name: 'api-designer',
        description: `${formatFramework(stack.framework)} APIエンドポイント設計専門エージェント`,
        focus: 'API設計、バリデーション、エラーハンドリング',
        reason: `${formatFramework(stack.framework)}バックエンドプロジェクトのため`,
      });
    }
  }

  // Docs writer
  suggestions.push({
    name: 'docs-writer',
    description: 'ドキュメント作成専門エージェント',
    focus: 'README、APIドキュメント、コメント',
    reason: 'ドキュメントは全てのプロジェクトで重要',
  });

  // Refactorer
  suggestions.push({
    name: 'refactorer',
    description: `${formatLanguage(stack.language)}リファクタリング専門エージェント`,
    focus: 'コード改善、設計パターン、技術的負債の解消',
    reason: 'コードの継続的改善に有効',
  });

  return suggestions.slice(0, 5); // Max 5 suggestions
}

function generateFallbackAgent(
  suggestion: AgentSuggestion,
  analysis: AnalysisResult,
  documents: ProjectDocuments
): string {
  const { stack, patterns, projectName } = analysis;
  const rules = documents.claudeMd?.rules || [];
  const conventions = documents.claudeMd?.conventions || [];

  const lines: string[] = [];

  lines.push(`# ${suggestion.name}`);
  lines.push('');
  lines.push(`> ${suggestion.description}`);
  lines.push('');
  lines.push('## 役割');
  lines.push('');
  lines.push(`${projectName}プロジェクトにおける${suggestion.focus}を担当します。`);
  lines.push('');
  lines.push('## プロジェクト情報');
  lines.push('');
  lines.push(`- **言語**: ${formatLanguage(stack.language)}${stack.languageVersion ? ` ${stack.languageVersion}` : ''}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **フレームワーク**: ${formatFramework(stack.framework)}`);
  }
  if (stack.testFramework !== 'unknown') {
    lines.push(`- **テスト**: ${formatTestFramework(stack.testFramework)}`);
  }
  lines.push(`- **構造**: ${patterns.structure.type}`);
  lines.push('');

  if (rules.length > 0 || conventions.length > 0) {
    lines.push('## プロジェクトルール');
    lines.push('');
    lines.push('以下のルールを遵守してください:');
    lines.push('');
    [...rules, ...conventions].forEach(rule => {
      lines.push(`- ${rule}`);
    });
    lines.push('');
  }

  lines.push('## 指示');
  lines.push('');
  lines.push(`このエージェントは${suggestion.focus}に特化しています。`);
  lines.push(`${formatLanguage(stack.language)}のベストプラクティスに従ってください。`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*Generated by Proteus (fallback mode)*');

  return lines.join('\n');
}

// ============================================
// Helpers
// ============================================

function formatLanguage(lang: string): string {
  const map: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    go: 'Go',
    python: 'Python',
    rust: 'Rust',
    ruby: 'Ruby',
    java: 'Java',
    php: 'PHP',
  };
  return map[lang] || lang;
}

function formatFramework(fw: string): string {
  const map: Record<string, string> = {
    nextjs: 'Next.js',
    react: 'React',
    vue: 'Vue.js',
    angular: 'Angular',
    svelte: 'Svelte',
    express: 'Express',
    fastify: 'Fastify',
    nestjs: 'NestJS',
    gin: 'Gin',
    echo: 'Echo',
    fiber: 'Fiber',
    django: 'Django',
    flask: 'Flask',
    fastapi: 'FastAPI',
    rails: 'Ruby on Rails',
    spring: 'Spring',
    laravel: 'Laravel',
    actix: 'Actix Web',
    axum: 'Axum',
  };
  return map[fw] || fw;
}

function formatTestFramework(tf: string): string {
  const map: Record<string, string> = {
    jest: 'Jest',
    vitest: 'Vitest',
    mocha: 'Mocha',
    pytest: 'pytest',
    'go-test': 'Go testing',
    rspec: 'RSpec',
    junit: 'JUnit',
    phpunit: 'PHPUnit',
  };
  return map[tf] || tf;
}
