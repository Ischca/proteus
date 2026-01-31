import type { AnalysisResult } from './types.js';
import type { ProjectDocuments } from './detectors/documents.js';
import {
  isClaudeAvailable,
  suggestAgents as claudeSuggestAgents,
  generateAgentContent as claudeGenerateAgent,
  type AgentSuggestion,
  type OutputLanguage,
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
  lang?: OutputLanguage;
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
      console.log('⚠️ Claude Code not available, using default suggestions');
    }
    return getDefaultSuggestions(analysis);
  }

  try {
    if (options.verbose) {
      console.log('🤖 Querying Claude Code for agent suggestions...');
    }
    return claudeSuggestAgents(analysis, documents, { verbose: options.verbose, lang: options.lang });
  } catch (error) {
    if (options.verbose) {
      console.warn('⚠️ Claude Code call failed, using default suggestions');
      if (error instanceof Error) {
        console.warn(`  Details: ${error.message}`);
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
  const outputDir = options.outputDir || '.claude/agents';

  if (!isClaudeAvailable()) {
    if (options.verbose) {
      console.log(`⚠️ Claude Code not available, using fallback for ${suggestion.name}`);
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
      console.log(`🤖 Generating ${suggestion.name} agent...`);
    }
    const content = claudeGenerateAgent(
      suggestion.name,
      suggestion.description,
      analysis,
      documents,
      { verbose: options.verbose, lang: options.lang }
    );

    return {
      name: suggestion.name,
      description: suggestion.description,
      content,
      path: `${outputDir}/${suggestion.name}.md`,
    };
  } catch (error) {
    if (options.verbose) {
      console.warn(`⚠️ Failed to generate ${suggestion.name}, using fallback`);
      if (error instanceof Error) {
        console.warn(`  Details: ${error.message}`);
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
    description: `${formatLanguage(stack.language)} code review specialist`,
    focus: 'Code quality, best practices, security',
    reason: 'Code review is valuable for all projects',
  });

  // Test writer - if test framework exists
  if (stack.testFramework !== 'unknown') {
    suggestions.push({
      name: 'test-writer',
      description: `${formatTestFramework(stack.testFramework)} test writing specialist`,
      focus: 'Unit tests, integration tests, test coverage',
      reason: `${formatTestFramework(stack.testFramework)} detected in project`,
    });
  }

  // Framework-specific agents
  if (stack.framework !== 'unknown') {
    if (['react', 'vue', 'svelte', 'angular'].includes(stack.framework)) {
      suggestions.push({
        name: 'component-builder',
        description: `${formatFramework(stack.framework)} component design specialist`,
        focus: 'Component design, state management, performance',
        reason: `${formatFramework(stack.framework)} frontend project`,
      });
    } else if (['express', 'fastify', 'nestjs', 'fastapi', 'gin'].includes(stack.framework)) {
      suggestions.push({
        name: 'api-designer',
        description: `${formatFramework(stack.framework)} API endpoint design specialist`,
        focus: 'API design, validation, error handling',
        reason: `${formatFramework(stack.framework)} backend project`,
      });
    }
  }

  // Docs writer
  suggestions.push({
    name: 'docs-writer',
    description: 'Documentation writing specialist',
    focus: 'README, API docs, code comments',
    reason: 'Documentation is important for all projects',
  });

  // Refactorer
  suggestions.push({
    name: 'refactorer',
    description: `${formatLanguage(stack.language)} refactoring specialist`,
    focus: 'Code improvement, design patterns, technical debt',
    reason: 'Continuous code improvement',
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
  lines.push('## Role');
  lines.push('');
  lines.push(`Handles ${suggestion.focus} for the ${projectName} project.`);
  lines.push('');
  lines.push('## Project Information');
  lines.push('');
  lines.push(`- **Language**: ${formatLanguage(stack.language)}${stack.languageVersion ? ` ${stack.languageVersion}` : ''}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **Framework**: ${formatFramework(stack.framework)}`);
  }
  if (stack.testFramework !== 'unknown') {
    lines.push(`- **Testing**: ${formatTestFramework(stack.testFramework)}`);
  }
  lines.push(`- **Structure**: ${patterns.structure.type}`);
  lines.push('');

  if (rules.length > 0 || conventions.length > 0) {
    lines.push('## Project Rules');
    lines.push('');
    lines.push('Follow these rules:');
    lines.push('');
    [...rules, ...conventions].forEach(rule => {
      lines.push(`- ${rule}`);
    });
    lines.push('');
  }

  lines.push('## Instructions');
  lines.push('');
  lines.push(`This agent specializes in ${suggestion.focus}.`);
  lines.push(`Follow ${formatLanguage(stack.language)} best practices.`);
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
