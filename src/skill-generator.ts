import * as fs from 'fs';
import * as path from 'path';
import type { OutputLanguage } from './claude-bridge.js';
import type { ExistingAgent } from './detectors/documents.js';

// ============================================
// i18n
// ============================================

interface SkillI18n {
  skillName: string;
  skillDescription: string;
  architectureTitle: string;
  agentTableTitle: string;
  agentTableHeaders: { name: string; description: string; triggers: string };
  howToUseTitle: string;
  howToUseSteps: string[];
  taskToolTitle: string;
  examplesTitle: string;
  noAgentsMessage: string;
}

const I18N: Record<OutputLanguage, SkillI18n> = {
  en: {
    skillName: 'proteus',
    skillDescription: 'Route tasks to project-specific agents using Task tool',
    architectureTitle: 'Architecture',
    agentTableTitle: 'Available Agents',
    agentTableHeaders: { name: 'Agent', description: 'Description', triggers: 'Trigger Examples' },
    howToUseTitle: 'How to Use',
    howToUseSteps: [
      'Analyze the user request to identify the task type',
      'Select the most appropriate agent from the table above',
      'Use the **Task tool** to spawn a subagent that reads and follows the agent definition',
      'If no agent matches, handle the task directly',
    ],
    taskToolTitle: 'Task Tool Invocation',
    examplesTitle: 'Examples',
    noAgentsMessage: 'No agents available yet. Run `npx agent-proteus` to generate project-specific agents.',
  },
  ja: {
    skillName: 'proteus',
    skillDescription: 'Task toolを使用してプロジェクト専用エージェントにタスクをルーティング',
    architectureTitle: 'アーキテクチャ',
    agentTableTitle: '利用可能なエージェント',
    agentTableHeaders: { name: 'エージェント', description: '説明', triggers: 'トリガー例' },
    howToUseTitle: '使用方法',
    howToUseSteps: [
      'ユーザーリクエストを分析してタスクの種類を特定',
      '上記テーブルから最も適切なエージェントを選択',
      '**Task tool**を使用してエージェント定義を読み込むサブエージェントを起動',
      '適切なエージェントがない場合は直接タスクを処理',
    ],
    taskToolTitle: 'Task tool の呼び出し方',
    examplesTitle: '使用例',
    noAgentsMessage: 'エージェントがまだありません。`npx agent-proteus`を実行してプロジェクト専用エージェントを生成してください。',
  },
  zh: {
    skillName: 'proteus',
    skillDescription: '使用Task tool将任务路由到项目专用代理',
    architectureTitle: '架构',
    agentTableTitle: '可用代理',
    agentTableHeaders: { name: '代理', description: '描述', triggers: '触发示例' },
    howToUseTitle: '使用方法',
    howToUseSteps: [
      '分析用户请求以识别任务类型',
      '从上表中选择最合适的代理',
      '使用**Task tool**启动子代理读取并遵循代理定义',
      '如果没有匹配的代理，直接处理任务',
    ],
    taskToolTitle: 'Task tool 调用方式',
    examplesTitle: '示例',
    noAgentsMessage: '尚无代理。运行`npx agent-proteus`生成项目专用代理。',
  },
  ko: {
    skillName: 'proteus',
    skillDescription: 'Task tool을 사용하여 프로젝트 전용 에이전트에 작업 라우팅',
    architectureTitle: '아키텍처',
    agentTableTitle: '사용 가능한 에이전트',
    agentTableHeaders: { name: '에이전트', description: '설명', triggers: '트리거 예시' },
    howToUseTitle: '사용 방법',
    howToUseSteps: [
      '사용자 요청을 분석하여 작업 유형 식별',
      '위 테이블에서 가장 적절한 에이전트 선택',
      '**Task tool**을 사용하여 에이전트 정의를 읽고 따르는 서브에이전트 생성',
      '일치하는 에이전트가 없으면 직접 작업 처리',
    ],
    taskToolTitle: 'Task tool 호출 방법',
    examplesTitle: '예시',
    noAgentsMessage: '아직 에이전트가 없습니다. `npx agent-proteus`를 실행하여 프로젝트 전용 에이전트를 생성하세요.',
  },
  es: {
    skillName: 'proteus',
    skillDescription: 'Enruta tareas a agentes específicos del proyecto usando Task tool',
    architectureTitle: 'Arquitectura',
    agentTableTitle: 'Agentes Disponibles',
    agentTableHeaders: { name: 'Agente', description: 'Descripción', triggers: 'Ejemplos de Activación' },
    howToUseTitle: 'Cómo Usar',
    howToUseSteps: [
      'Analizar la solicitud del usuario para identificar el tipo de tarea',
      'Seleccionar el agente más apropiado de la tabla anterior',
      'Usar **Task tool** para crear un subagente que lea y siga la definición del agente',
      'Si no hay agente coincidente, manejar la tarea directamente',
    ],
    taskToolTitle: 'Invocación de Task tool',
    examplesTitle: 'Ejemplos',
    noAgentsMessage: 'Aún no hay agentes. Ejecuta `npx agent-proteus` para generar agentes específicos del proyecto.',
  },
  fr: {
    skillName: 'proteus',
    skillDescription: 'Route les tâches vers des agents spécifiques au projet via Task tool',
    architectureTitle: 'Architecture',
    agentTableTitle: 'Agents Disponibles',
    agentTableHeaders: { name: 'Agent', description: 'Description', triggers: 'Exemples de Déclenchement' },
    howToUseTitle: 'Comment Utiliser',
    howToUseSteps: [
      'Analyser la demande de l\'utilisateur pour identifier le type de tâche',
      'Sélectionner l\'agent le plus approprié dans le tableau ci-dessus',
      'Utiliser **Task tool** pour créer un sous-agent qui lit et suit la définition de l\'agent',
      'Si aucun agent ne correspond, gérer la tâche directement',
    ],
    taskToolTitle: 'Invocation de Task tool',
    examplesTitle: 'Exemples',
    noAgentsMessage: 'Pas encore d\'agents. Exécutez `npx agent-proteus` pour générer des agents spécifiques au projet.',
  },
  de: {
    skillName: 'proteus',
    skillDescription: 'Leitet Aufgaben an projektspezifische Agenten über Task tool weiter',
    architectureTitle: 'Architektur',
    agentTableTitle: 'Verfügbare Agenten',
    agentTableHeaders: { name: 'Agent', description: 'Beschreibung', triggers: 'Trigger-Beispiele' },
    howToUseTitle: 'Verwendung',
    howToUseSteps: [
      'Analysieren Sie die Benutzeranfrage, um den Aufgabentyp zu identifizieren',
      'Wählen Sie den am besten geeigneten Agenten aus der obigen Tabelle',
      'Verwenden Sie **Task tool**, um einen Subagenten zu erstellen, der die Agentendefinition liest und befolgt',
      'Wenn kein Agent passt, bearbeiten Sie die Aufgabe direkt',
    ],
    taskToolTitle: 'Task tool Aufruf',
    examplesTitle: 'Beispiele',
    noAgentsMessage: 'Noch keine Agenten. Führen Sie `npx agent-proteus` aus, um projektspezifische Agenten zu generieren.',
  },
};

// ============================================
// Types
// ============================================

export interface ProteusSkillOptions {
  projectName: string;
  agents: ExistingAgent[];
  lang?: OutputLanguage;
  outputDir?: string;
}

export interface GeneratedSkill {
  name: string;
  path: string;
  content: string;
}

// ============================================
// Skill Generator
// ============================================

/**
 * Generate the proteus skill content
 */
export function generateProteusSkillContent(options: ProteusSkillOptions): string {
  const { projectName, agents, lang = 'en' } = options;
  const t = I18N[lang];

  // Filter to only include agents (not skills)
  const agentList = agents.filter(a => a.type === 'agent');

  // Build architecture diagram
  const architectureDiagram = `\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                      User Request                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    /proteus Skill                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Analyze request → Identify task type              │    │
│  │ 2. Select appropriate agent from table               │    │
│  │ 3. Spawn Task tool with agent instructions           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ Agent A  │    │ Agent B  │    │ Agent C  │
       └──────────┘    └──────────┘    └──────────┘
\`\`\``;

  // Build agent table
  let agentTable = '';
  if (agentList.length > 0) {
    const rows = agentList.map(agent => {
      const description = extractAgentDescription(agent.content);
      const triggers = extractTriggerExamples(agent.content, agent.name);
      return `| \`${agent.name}\` | ${description} | ${triggers} |`;
    });
    agentTable = `| ${t.agentTableHeaders.name} | ${t.agentTableHeaders.description} | ${t.agentTableHeaders.triggers} |
|------|------|------|
${rows.join('\n')}`;
  }

  // Build Task tool invocation example
  const taskToolExample = agentList.length > 0
    ? buildTaskToolExample(agentList[0], lang)
    : buildGenericTaskToolExample(lang);

  // Build concrete examples for each agent
  const concreteExamples = agentList.length > 0
    ? agentList.slice(0, 3).map(agent => buildConcreteExample(agent, lang)).join('\n\n')
    : '';

  // Build the skill content with YAML frontmatter
  const content = `---
name: ${t.skillName}
description: ${t.skillDescription}
---

# 🔱 Proteus

**Project**: ${projectName}

## ${t.architectureTitle}

${architectureDiagram}

## ${t.agentTableTitle}

${agentTable || `_${t.noAgentsMessage}_`}

## ${t.howToUseTitle}

${t.howToUseSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## ${t.taskToolTitle}

${taskToolExample}

${concreteExamples ? `## ${t.examplesTitle}\n\n${concreteExamples}` : ''}
`;

  return content;
}

/**
 * Generate and save the proteus skill
 */
export function generateProteusSkill(options: ProteusSkillOptions): GeneratedSkill {
  const { outputDir = '.claude/skills', lang = 'en' } = options;

  const content = generateProteusSkillContent(options);
  const skillDir = path.join(outputDir, 'proteus');
  const skillPath = path.join(skillDir, 'SKILL.md');

  return {
    name: 'proteus',
    path: skillPath,
    content,
  };
}

/**
 * Save the proteus skill to disk
 */
export function saveProteusSkill(skill: GeneratedSkill, projectPath: string): void {
  const fullDir = path.join(projectPath, path.dirname(skill.path));
  const fullPath = path.join(projectPath, skill.path);

  // Create directory if it doesn't exist
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }

  fs.writeFileSync(fullPath, skill.content, 'utf-8');
}

// ============================================
// Helpers
// ============================================

/**
 * Extract description from agent content (first line after H1)
 */
function extractAgentDescription(content: string): string {
  const lines = content.split('\n');
  let foundH1 = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundH1 = true;
      continue;
    }
    if (foundH1 && line.trim() && !line.startsWith('#')) {
      // Remove markdown formatting and limit length
      const desc = line.trim().replace(/\*\*/g, '').replace(/`/g, '');
      return desc.length > 80 ? desc.substring(0, 77) + '...' : desc;
    }
  }

  return 'Project-specific agent';
}

/**
 * Extract trigger examples from agent content or generate from name
 */
function extractTriggerExamples(content: string, agentName: string): string {
  // Try to find examples section in content
  const examplesMatch = content.match(/##\s*(Examples?|使用例|例|示例|예시)/i);
  if (examplesMatch) {
    const afterExamples = content.substring(content.indexOf(examplesMatch[0]));
    const lines = afterExamples.split('\n').slice(1, 4);
    const examples = lines
      .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
      .map(l => l.replace(/^[\s\-\*]+/, '').trim())
      .filter(l => l.length > 0 && l.length < 50)
      .slice(0, 2);
    if (examples.length > 0) {
      return examples.map(e => `"${e}"`).join(', ');
    }
  }

  // Generate from agent name
  const keywords = agentName
    .split('-')
    .filter(w => !['the', 'a', 'an', 'for', 'with'].includes(w.toLowerCase()));

  if (keywords.length >= 2) {
    return `"${keywords.slice(0, 2).join(' ')}..."`;
  }
  return `"${agentName}..."`;
}

/**
 * Build Task tool invocation example for a specific agent
 */
function buildTaskToolExample(agent: ExistingAgent, lang: OutputLanguage): string {
  const isJapanese = lang === 'ja';
  const userRequest = isJapanese ? 'ユーザーリクエスト' : 'user request';
  const taskDescription = isJapanese ? 'タスクの説明' : 'task description';

  return `\`\`\`javascript
// Use Task tool to invoke an agent
Task({
  description: "${taskDescription}",
  subagent_type: "general-purpose",
  prompt: \`
    Read the agent definition file first:
    Read .claude/agents/${agent.name}.md

    Then follow the agent's instructions to complete this task:
    [${userRequest}]

    IMPORTANT:
    - Read the agent file FIRST before taking any action
    - Follow the agent's instructions EXACTLY
    - Use the agent's specified patterns and conventions
  \`
})
\`\`\``;
}

/**
 * Build generic Task tool example when no agents exist
 */
function buildGenericTaskToolExample(lang: OutputLanguage): string {
  const isJapanese = lang === 'ja';

  return `\`\`\`javascript
// ${isJapanese ? 'Task toolを使用してエージェントを呼び出す' : 'Use Task tool to invoke an agent'}
Task({
  description: "Execute task with agent",
  subagent_type: "general-purpose",
  prompt: \`
    Read the agent definition file first:
    Read .claude/agents/[agent-name].md

    Then follow the agent's instructions to complete this task:
    [user request here]
  \`
})
\`\`\``;
}

/**
 * Build a concrete example for an agent
 */
function buildConcreteExample(agent: ExistingAgent, lang: OutputLanguage): string {
  const isJapanese = lang === 'ja';
  const description = extractAgentDescription(agent.content);

  // Generate a plausible user request based on agent name/description
  const userRequest = generateUserRequest(agent.name, description, isJapanese);

  const header = isJapanese
    ? `### ${agent.name} を使用する場合`
    : `### Using ${agent.name}`;

  const userLabel = isJapanese ? 'ユーザー' : 'User';
  const actionLabel = isJapanese ? 'アクション' : 'Action';

  return `${header}

**${userLabel}**: "${userRequest}"

**${actionLabel}**:
\`\`\`javascript
Task({
  description: "${agent.name}",
  subagent_type: "general-purpose",
  prompt: \`
    Read the agent definition:
    Read .claude/agents/${agent.name}.md

    Task: ${userRequest}

    Follow the agent's instructions exactly.
  \`
})
\`\`\``;
}

/**
 * Generate a plausible user request based on agent name
 */
function generateUserRequest(agentName: string, description: string, isJapanese: boolean): string {
  const nameLower = agentName.toLowerCase();

  // Common patterns
  if (nameLower.includes('test') || nameLower.includes('spec')) {
    return isJapanese ? 'このファイルのテストを書いて' : 'Write tests for this file';
  }
  if (nameLower.includes('review')) {
    return isJapanese ? 'このコードをレビューして' : 'Review this code';
  }
  if (nameLower.includes('refactor')) {
    return isJapanese ? 'このコードをリファクタリングして' : 'Refactor this code';
  }
  if (nameLower.includes('doc') || nameLower.includes('comment')) {
    return isJapanese ? 'このコードにドキュメントを追加して' : 'Add documentation to this code';
  }
  if (nameLower.includes('graphql')) {
    return isJapanese ? 'GraphQLスキーマを生成して' : 'Generate GraphQL schema';
  }
  if (nameLower.includes('api')) {
    return isJapanese ? 'APIエンドポイントを作成して' : 'Create an API endpoint';
  }
  if (nameLower.includes('component')) {
    return isJapanese ? 'コンポーネントを作成して' : 'Create a component';
  }
  if (nameLower.includes('optimize') || nameLower.includes('performance')) {
    return isJapanese ? 'パフォーマンスを最適化して' : 'Optimize performance';
  }
  if (nameLower.includes('coverage')) {
    return isJapanese ? 'テストカバレッジを改善して' : 'Improve test coverage';
  }

  // Default based on description
  if (description && description.length > 10) {
    const shortDesc = description.split(/[。.]/)[0].substring(0, 30);
    return isJapanese ? `${shortDesc}をお願い` : `Help me with ${shortDesc.toLowerCase()}`;
  }

  return isJapanese ? 'このタスクを実行して' : 'Execute this task';
}
