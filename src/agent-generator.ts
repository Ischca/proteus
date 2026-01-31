import type { AnalysisResult, AgentType, GeneratedAgent } from './types.js';
import type { ProjectDocuments } from './detectors/documents.js';

// ============================================
// Formatting Helpers
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

// ============================================
// Agent Templates
// ============================================

function generateCodeReviewer(
  analysis: AnalysisResult,
  docs: ProjectDocuments
): string {
  const { projectName, stack, patterns, commands } = analysis;
  const lines: string[] = [];

  // Header
  lines.push(`# ${projectName} - Code Reviewer`);
  lines.push('');
  lines.push('あなたはこのプロジェクト専属のコードレビュアーです。');
  lines.push('');

  // Project Context
  lines.push('## プロジェクト情報');
  lines.push('');
  lines.push(`- **言語**: ${formatLanguage(stack.language)}${stack.languageVersion ? ` ${stack.languageVersion}` : ''}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **フレームワーク**: ${formatFramework(stack.framework)}${stack.frameworkVersion ? ` ${stack.frameworkVersion}` : ''}`);
  }
  if (stack.testFramework !== 'unknown') {
    lines.push(`- **テスト**: ${stack.testFramework}`);
  }
  if (stack.styling) {
    lines.push(`- **スタイリング**: ${stack.styling}`);
  }
  if (stack.database) {
    lines.push(`- **データベース/ORM**: ${stack.database}`);
  }
  lines.push('');

  // Project Structure
  lines.push('## プロジェクト構造');
  lines.push('');
  lines.push(`- ソースディレクトリ: \`${patterns.structure.sourceDir}/\``);
  if (patterns.structure.testDir) {
    lines.push(`- テストディレクトリ: \`${patterns.structure.testDir}/\``);
  }
  if (patterns.structure.keyDirectories.length > 0) {
    lines.push('- 主要ディレクトリ:');
    for (const dir of patterns.structure.keyDirectories) {
      lines.push(`  - \`${dir.path}/\`: ${dir.purpose}`);
    }
  }
  lines.push('');

  // Rules from CLAUDE.md
  if (docs.claudeMd) {
    if (docs.claudeMd.rules.length > 0) {
      lines.push('## プロジェクト固有のルール');
      lines.push('');
      lines.push('このプロジェクトでは以下のルールが定められています:');
      lines.push('');
      for (const rule of docs.claudeMd.rules) {
        lines.push(`- ${rule}`);
      }
      lines.push('');
    }

    if (docs.claudeMd.mustDo.length > 0) {
      lines.push('### 必須事項');
      lines.push('');
      for (const item of docs.claudeMd.mustDo) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (docs.claudeMd.prefer.length > 0) {
      lines.push('### 推奨事項');
      lines.push('');
      for (const item of docs.claudeMd.prefer) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (docs.claudeMd.conventions.length > 0) {
      lines.push('## コーディング規約');
      lines.push('');
      for (const conv of docs.claudeMd.conventions) {
        lines.push(`- ${conv}`);
      }
      lines.push('');
    }
  }

  // Naming Conventions (from analysis)
  lines.push('## 命名規則');
  lines.push('');
  if (patterns.naming.files.components) {
    lines.push(`- コンポーネントファイル: ${patterns.naming.files.components}`);
  }
  if (patterns.naming.files.utilities) {
    lines.push(`- ユーティリティファイル: ${patterns.naming.files.utilities}`);
  }
  if (patterns.naming.files.tests) {
    lines.push(`- テストファイル: ${patterns.naming.files.tests}`);
  }
  lines.push(`- 関数: ${patterns.naming.code.functions}`);
  lines.push(`- 変数: ${patterns.naming.code.variables}`);
  lines.push(`- 定数: ${patterns.naming.code.constants}`);
  lines.push('');

  // Review Checklist
  lines.push('## レビューチェックリスト');
  lines.push('');
  lines.push('コードレビュー時は以下を確認してください:');
  lines.push('');
  lines.push('- [ ] 命名規則に従っているか');
  lines.push('- [ ] プロジェクトの構造に合っているか');

  if (stack.language === 'typescript') {
    lines.push('- [ ] TypeScriptの型が適切に定義されているか');
  }

  if (stack.testFramework !== 'unknown') {
    lines.push('- [ ] テストが書かれているか');
  }

  if (commands.lint) {
    lines.push(`- [ ] \`${commands.lint}\` が通るか`);
  }

  if (commands.typecheck) {
    lines.push(`- [ ] \`${commands.typecheck}\` が通るか`);
  }

  // Framework specific checks
  if (stack.framework === 'nextjs') {
    lines.push('- [ ] App Router のベストプラクティスに従っているか');
    lines.push('- [ ] Server/Client コンポーネントの使い分けが適切か');
  }

  if (stack.framework === 'react') {
    lines.push('- [ ] React Hooks のルールに従っているか');
    lines.push('- [ ] 不要な再レンダリングがないか');
  }

  if (stack.database === 'Prisma') {
    lines.push('- [ ] N+1問題がないか');
    lines.push('- [ ] トランザクションが適切に使われているか');
  }

  // Custom sections from CLAUDE.md
  if (docs.claudeMd) {
    for (const [sectionName, content] of Object.entries(docs.claudeMd.customSections)) {
      if (content.trim()) {
        lines.push('');
        lines.push(`## ${sectionName}`);
        lines.push('');
        lines.push(content);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Proteus for ${projectName}*`);

  return lines.join('\n');
}

function generateTestWriter(
  analysis: AnalysisResult,
  docs: ProjectDocuments
): string {
  const { projectName, stack, patterns, commands } = analysis;
  const lines: string[] = [];

  lines.push(`# ${projectName} - Test Writer`);
  lines.push('');
  lines.push('あなたはこのプロジェクト専属のテストライターです。');
  lines.push('');

  lines.push('## プロジェクト情報');
  lines.push('');
  lines.push(`- **言語**: ${formatLanguage(stack.language)}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **フレームワーク**: ${formatFramework(stack.framework)}`);
  }
  lines.push(`- **テストフレームワーク**: ${stack.testFramework}`);
  lines.push('');

  lines.push('## テストファイルの配置');
  lines.push('');
  if (patterns.structure.testDir) {
    lines.push(`テストは \`${patterns.structure.testDir}/\` に配置してください。`);
  } else {
    lines.push('テストはソースファイルと同じディレクトリに配置してください（colocate）。');
  }
  if (patterns.naming.files.tests) {
    lines.push(`テストファイル名: ${patterns.naming.files.tests}`);
  }
  lines.push('');

  if (commands.test) {
    lines.push('## テストの実行');
    lines.push('');
    lines.push('```bash');
    lines.push(commands.test);
    lines.push('```');
    lines.push('');
  }

  // Rules from CLAUDE.md
  if (docs.claudeMd?.rules.length) {
    lines.push('## プロジェクト固有のルール');
    lines.push('');
    for (const rule of docs.claudeMd.rules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  lines.push('## テスト作成のガイドライン');
  lines.push('');

  if (stack.testFramework === 'vitest' || stack.testFramework === 'jest') {
    lines.push('- `describe` でテストをグループ化');
    lines.push('- `it` / `test` で個別のテストケースを記述');
    lines.push('- `expect` でアサーションを行う');
  }

  if (stack.framework === 'react' || stack.framework === 'nextjs') {
    lines.push('- React Testing Library を使用してコンポーネントをテスト');
    lines.push('- ユーザー操作をシミュレートしてテスト');
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Proteus for ${projectName}*`);

  return lines.join('\n');
}

function generateRefactorer(
  analysis: AnalysisResult,
  docs: ProjectDocuments
): string {
  const { projectName, stack, patterns } = analysis;
  const lines: string[] = [];

  lines.push(`# ${projectName} - Refactorer`);
  lines.push('');
  lines.push('あなたはこのプロジェクト専属のリファクタリング担当です。');
  lines.push('');

  lines.push('## プロジェクト情報');
  lines.push('');
  lines.push(`- **言語**: ${formatLanguage(stack.language)}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **フレームワーク**: ${formatFramework(stack.framework)}`);
  }
  lines.push('');

  lines.push('## プロジェクト構造');
  lines.push('');
  lines.push(`このプロジェクトは **${patterns.structure.type}** 構造を採用しています。`);
  lines.push('');
  if (patterns.structure.keyDirectories.length > 0) {
    for (const dir of patterns.structure.keyDirectories) {
      lines.push(`- \`${dir.path}/\`: ${dir.purpose}`);
    }
    lines.push('');
  }

  // Rules from CLAUDE.md
  if (docs.claudeMd?.rules.length) {
    lines.push('## プロジェクト固有のルール');
    lines.push('');
    for (const rule of docs.claudeMd.rules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  lines.push('## リファクタリング時の注意');
  lines.push('');
  lines.push('- 既存の命名規則を維持すること');
  lines.push('- プロジェクト構造を崩さないこと');
  lines.push('- 既存のテストが通ることを確認すること');

  if (patterns.imports?.style) {
    lines.push(`- インポートは ${patterns.imports.style} スタイルを使用`);
  }

  if (patterns.exports?.style) {
    lines.push(`- エクスポートは ${patterns.exports.style} スタイルを使用`);
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Proteus for ${projectName}*`);

  return lines.join('\n');
}

function generateDocsWriter(
  analysis: AnalysisResult,
  docs: ProjectDocuments
): string {
  const { projectName, stack } = analysis;
  const lines: string[] = [];

  lines.push(`# ${projectName} - Documentation Writer`);
  lines.push('');
  lines.push('あなたはこのプロジェクト専属のドキュメントライターです。');
  lines.push('');

  lines.push('## プロジェクト情報');
  lines.push('');
  lines.push(`- **言語**: ${formatLanguage(stack.language)}`);
  if (stack.framework !== 'unknown') {
    lines.push(`- **フレームワーク**: ${formatFramework(stack.framework)}`);
  }
  lines.push('');

  if (docs.readme) {
    lines.push('## 既存のREADME');
    lines.push('');
    lines.push(`現在のプロジェクト説明: ${docs.readme.description || '(なし)'}`);
    lines.push('');
  }

  // Rules from CLAUDE.md
  if (docs.claudeMd?.rules.length) {
    lines.push('## プロジェクト固有のルール');
    lines.push('');
    for (const rule of docs.claudeMd.rules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  lines.push('## ドキュメント作成のガイドライン');
  lines.push('');
  lines.push('- 明確で簡潔な文章を心がける');
  lines.push('- コード例を適切に含める');
  lines.push('- 日本語で記述する（特に指定がない場合）');

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Proteus for ${projectName}*`);

  return lines.join('\n');
}

// ============================================
// Main Generator Function
// ============================================

export function generateAgent(
  type: AgentType,
  analysis: AnalysisResult,
  docs: ProjectDocuments
): GeneratedAgent {
  let content: string;
  let name: string;

  switch (type) {
    case 'code-reviewer':
      name = 'code-reviewer';
      content = generateCodeReviewer(analysis, docs);
      break;
    case 'test-writer':
      name = 'test-writer';
      content = generateTestWriter(analysis, docs);
      break;
    case 'refactorer':
      name = 'refactorer';
      content = generateRefactorer(analysis, docs);
      break;
    case 'docs-writer':
      name = 'docs-writer';
      content = generateDocsWriter(analysis, docs);
      break;
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }

  return {
    type,
    name,
    path: `${name}.md`,
    content,
  };
}

export function generateAgents(
  types: AgentType[],
  analysis: AnalysisResult,
  docs: ProjectDocuments
): GeneratedAgent[] {
  return types.map(type => generateAgent(type, analysis, docs));
}

// ============================================
// Auto-select agents based on project
// ============================================

export function selectRecommendedAgents(analysis: AnalysisResult): AgentType[] {
  const agents: AgentType[] = ['code-reviewer']; // Always recommend

  if (analysis.stack.testFramework !== 'unknown') {
    agents.push('test-writer');
  }

  // Add more based on project characteristics
  agents.push('refactorer');
  agents.push('docs-writer');

  return agents;
}
