import { execSync, spawnSync } from 'child_process';
import type { AnalysisResult } from './types.js';
import type { ProjectDocuments } from './detectors/documents.js';

export interface ClaudeBridgeOptions {
  timeout?: number;  // milliseconds
  verbose?: boolean;
}

export interface AgentSuggestion {
  name: string;
  description: string;
  focus: string;
  reason: string;
}

export interface GeneratedContent {
  content: string;
  type: 'claude-md' | 'agent';
}

/**
 * Check if Claude Code CLI is available
 */
export function isClaudeAvailable(): boolean {
  try {
    const result = spawnSync('claude', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Call Claude Code CLI with a prompt and return the response
 */
export function callClaude(prompt: string, options: ClaudeBridgeOptions = {}): string {
  const { timeout = 120000, verbose = false } = options;

  if (verbose) {
    console.log('📤 Sending to Claude Code...');
  }

  try {
    // Use --print (-p) flag to get direct output
    const result = execSync(`claude -p "${escapeForShell(prompt)}"`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return result.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Claude Code call failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Suggest agents based on project analysis
 */
export function suggestAgents(
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: ClaudeBridgeOptions = {}
): AgentSuggestion[] {
  const prompt = buildAgentSuggestionPrompt(analysis, documents);
  const response = callClaude(prompt, options);
  return parseAgentSuggestions(response);
}

/**
 * Generate CLAUDE.md content
 */
export function generateClaudeMdContent(
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: ClaudeBridgeOptions = {}
): string {
  const prompt = buildClaudeMdPrompt(analysis, documents);
  return callClaude(prompt, options);
}

/**
 * Generate agent content
 */
export function generateAgentContent(
  agentName: string,
  agentDescription: string,
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  options: ClaudeBridgeOptions = {}
): string {
  const prompt = buildAgentPrompt(agentName, agentDescription, analysis, documents);
  return callClaude(prompt, options);
}

// ============================================
// Prompt Builders
// ============================================

function buildAgentSuggestionPrompt(analysis: AnalysisResult, documents: ProjectDocuments): string {
  const existingRules = documents.claudeMd?.rules || [];
  const existingAgents = documents.existingAgents.map(a => a.name).join(', ') || 'なし';

  return `あなたはプロジェクト分析の専門家です。以下のプロジェクト情報に基づいて、このプロジェクトに最適なClaude Codeエージェントを5つ提案してください。

## プロジェクト情報

- **名前**: ${analysis.projectName}
- **言語**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **フレームワーク**: ${analysis.stack.framework}
- **テストフレームワーク**: ${analysis.stack.testFramework}
- **追加ツール**: ${analysis.stack.additionalTools.join(', ') || 'なし'}
- **プロジェクト構造**: ${analysis.patterns.structure.type}
- **既存エージェント**: ${existingAgents}

## 既存のルール・規約
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : '特になし'}

## 要件

1. このプロジェクト専用にパーソナライズされたエージェントを提案すること
2. 汎用的なエージェントではなく、このプロジェクトの言語・FW・構造に特化したものであること
3. 既存のエージェントと重複しないこと
4. 各エージェントには具体的な役割と、なぜこのプロジェクトに有効かの理由を含めること

## 出力形式（JSON）

以下の形式で出力してください:

\`\`\`json
[
  {
    "name": "エージェント名（kebab-case）",
    "description": "一行での説明",
    "focus": "このエージェントが専門とする領域",
    "reason": "このプロジェクトでなぜ有効か"
  }
]
\`\`\`

JSONのみを出力してください。`;
}

function buildClaudeMdPrompt(analysis: AnalysisResult, documents: ProjectDocuments): string {
  const existingContent = documents.claudeMd?.rawContent || '';

  return `あなたはプロジェクトドキュメントの専門家です。以下のプロジェクト情報に基づいて、CLAUDE.md（Claude Code用のプロジェクト説明ファイル）を生成してください。

## プロジェクト情報

- **名前**: ${analysis.projectName}
- **説明**: ${analysis.description || '不明'}
- **言語**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **フレームワーク**: ${analysis.stack.framework} ${analysis.stack.frameworkVersion || ''}
- **テストフレームワーク**: ${analysis.stack.testFramework}
- **パッケージマネージャー**: ${analysis.stack.packageManager}
- **追加ツール**: ${analysis.stack.additionalTools.join(', ') || 'なし'}

## プロジェクト構造
- タイプ: ${analysis.patterns.structure.type}
- ソースディレクトリ: ${analysis.patterns.structure.sourceDir}
- テストディレクトリ: ${analysis.patterns.structure.testDir || 'なし'}

## コマンド
- 開発: ${analysis.commands.dev || 'なし'}
- ビルド: ${analysis.commands.build || 'なし'}
- テスト: ${analysis.commands.test || 'なし'}
- リント: ${analysis.commands.lint || 'なし'}

## 命名規則
- ファイル（コンポーネント）: ${analysis.patterns.naming.files.components || '不明'}
- ファイル（テスト）: ${analysis.patterns.naming.files.tests || '不明'}
- 関数: ${analysis.patterns.naming.code.functions}
- 変数: ${analysis.patterns.naming.code.variables}

${existingContent ? `## 既存のCLAUDE.md内容（参考）\n${existingContent}` : ''}

## 要件

1. Claude Codeがこのプロジェクトを理解し、効果的に作業できるような内容にすること
2. プロジェクトの重要なルール、規約、ベストプラクティスを含めること
3. 明確で読みやすいMarkdown形式で出力すること
4. 既存の内容がある場合は、それを活かしつつ改善すること

Markdownのみを出力してください。`;
}

function buildAgentPrompt(
  agentName: string,
  agentDescription: string,
  analysis: AnalysisResult,
  documents: ProjectDocuments
): string {
  const existingRules = documents.claudeMd?.rules || [];
  const conventions = documents.claudeMd?.conventions || [];

  return `あなたはClaude Codeエージェントの設計専門家です。以下の情報に基づいて、プロジェクト専用のエージェント定義（Markdown）を生成してください。

## エージェント情報
- **名前**: ${agentName}
- **説明**: ${agentDescription}

## プロジェクト情報
- **名前**: ${analysis.projectName}
- **言語**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **フレームワーク**: ${analysis.stack.framework}
- **テストフレームワーク**: ${analysis.stack.testFramework}
- **プロジェクト構造**: ${analysis.patterns.structure.type}
- **ソースディレクトリ**: ${analysis.patterns.structure.sourceDir}

## プロジェクトのルール・規約
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : '特になし'}

## プロジェクトの慣習
${conventions.length > 0 ? conventions.map(c => `- ${c}`).join('\n') : '特になし'}

## 要件

1. このプロジェクト専用にパーソナライズされたエージェントを生成すること
2. プロジェクトの言語・フレームワーク・構造に特化した具体的な指示を含めること
3. プロジェクトのルールや規約を遵守するよう指示を含めること
4. エージェントの役割、できること、制約を明確に記述すること
5. 汎用的な説明ではなく、このプロジェクトでの具体的なユースケースを含めること

## 出力形式

以下の構造でMarkdownを出力してください:

\`\`\`markdown
# {エージェント名}

{一行での説明}

## 役割

{このエージェントが担当する具体的な役割}

## 専門領域

{このプロジェクトにおける専門領域の詳細}

## 指示

{このエージェントへの具体的な指示。プロジェクト固有のルールを含む}

## 制約

{このエージェントがやってはいけないこと}

## 使用例

{具体的な使用例やプロンプト例}
\`\`\`

Markdownのみを出力してください。`;
}

// ============================================
// Helpers
// ============================================

function escapeForShell(str: string): string {
  // Escape double quotes and special characters for shell
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n');
}

function parseAgentSuggestions(response: string): AgentSuggestion[] {
  try {
    // Extract JSON from response (might be wrapped in markdown code block)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.warn('Could not parse agent suggestions from response');
      return [];
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(item => ({
      name: String(item.name || ''),
      description: String(item.description || ''),
      focus: String(item.focus || ''),
      reason: String(item.reason || ''),
    })).filter(s => s.name && s.description);
  } catch (error) {
    console.warn('Failed to parse agent suggestions:', error);
    return [];
  }
}
