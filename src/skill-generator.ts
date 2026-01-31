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
  roleTitle: string;
  roleDescription: string;
  availableAgentsTitle: string;
  instructionsTitle: string;
  instructions: string[];
  examplesTitle: string;
  examples: string[];
}

const I18N: Record<OutputLanguage, SkillI18n> = {
  en: {
    skillName: 'proteus',
    skillDescription: 'Select and delegate tasks to project-specific agents based on your needs',
    roleTitle: 'Role',
    roleDescription: 'You are a task router that analyzes user requests and delegates them to the most appropriate project-specific agent. Each agent is specialized for a particular aspect of this project.',
    availableAgentsTitle: 'Available Agents',
    instructionsTitle: 'Instructions',
    instructions: [
      'Analyze the user\'s request to understand the task type',
      'Select the SINGLE most appropriate agent from the list below',
      'Delegate the task to that agent using @agent-name',
      'If no agent fits, handle the task directly or suggest which agent might be needed',
    ],
    examplesTitle: 'Examples',
    examples: [
      'User: "Review this GraphQL resolver" → Delegate to the GraphQL-related agent',
      'User: "Write tests for this endpoint" → Delegate to the test-writing agent',
      'User: "Check if this follows our patterns" → Delegate to the pattern/style enforcement agent',
    ],
  },
  ja: {
    skillName: 'proteus',
    skillDescription: 'ユーザーのニーズに基づいて、プロジェクト専用エージェントにタスクを委譲します',
    roleTitle: '役割',
    roleDescription: 'あなたはタスクルーターです。ユーザーのリクエストを分析し、最も適切なプロジェクト専用エージェントに委譲します。各エージェントはこのプロジェクトの特定の側面に特化しています。',
    availableAgentsTitle: '利用可能なエージェント',
    instructionsTitle: '手順',
    instructions: [
      'ユーザーのリクエストを分析してタスクの種類を理解する',
      '以下のリストから最も適切なエージェントを1つ選択する',
      '@agent-name を使用してそのエージェントにタスクを委譲する',
      '適切なエージェントがない場合は、直接タスクを処理するか、必要なエージェントを提案する',
    ],
    examplesTitle: '使用例',
    examples: [
      'ユーザー: 「このGraphQLリゾルバをレビューして」→ GraphQL関連エージェントに委譲',
      'ユーザー: 「このエンドポイントのテストを書いて」→ テスト作成エージェントに委譲',
      'ユーザー: 「これがパターンに従っているか確認して」→ パターン/スタイル適用エージェントに委譲',
    ],
  },
  zh: {
    skillName: 'proteus',
    skillDescription: '根据您的需求选择并将任务委派给项目专用代理',
    roleTitle: '角色',
    roleDescription: '您是一个任务路由器，分析用户请求并将其委派给最合适的项目专用代理。每个代理都专门针对此项目的特定方面。',
    availableAgentsTitle: '可用代理',
    instructionsTitle: '说明',
    instructions: [
      '分析用户请求以了解任务类型',
      '从下面的列表中选择最合适的单个代理',
      '使用 @agent-name 将任务委派给该代理',
      '如果没有合适的代理，直接处理任务或建议可能需要的代理',
    ],
    examplesTitle: '示例',
    examples: [
      '用户："审查这个GraphQL解析器" → 委派给GraphQL相关代理',
      '用户："为这个端点编写测试" → 委派给测试编写代理',
      '用户："检查这是否符合我们的模式" → 委派给模式/风格执行代理',
    ],
  },
  ko: {
    skillName: 'proteus',
    skillDescription: '사용자의 요구에 따라 프로젝트 전용 에이전트에 작업을 위임합니다',
    roleTitle: '역할',
    roleDescription: '사용자 요청을 분석하고 가장 적절한 프로젝트 전용 에이전트에 위임하는 작업 라우터입니다. 각 에이전트는 이 프로젝트의 특정 측면에 특화되어 있습니다.',
    availableAgentsTitle: '사용 가능한 에이전트',
    instructionsTitle: '지침',
    instructions: [
      '사용자 요청을 분석하여 작업 유형 파악',
      '아래 목록에서 가장 적절한 에이전트 하나 선택',
      '@agent-name을 사용하여 해당 에이전트에 작업 위임',
      '적절한 에이전트가 없으면 직접 작업을 처리하거나 필요한 에이전트 제안',
    ],
    examplesTitle: '예시',
    examples: [
      '사용자: "이 GraphQL 리졸버 검토해줘" → GraphQL 관련 에이전트에 위임',
      '사용자: "이 엔드포인트 테스트 작성해줘" → 테스트 작성 에이전트에 위임',
      '사용자: "이것이 패턴을 따르는지 확인해줘" → 패턴/스타일 적용 에이전트에 위임',
    ],
  },
  es: {
    skillName: 'proteus',
    skillDescription: 'Selecciona y delega tareas a agentes específicos del proyecto según sus necesidades',
    roleTitle: 'Rol',
    roleDescription: 'Eres un enrutador de tareas que analiza las solicitudes del usuario y las delega al agente específico del proyecto más apropiado. Cada agente está especializado en un aspecto particular de este proyecto.',
    availableAgentsTitle: 'Agentes Disponibles',
    instructionsTitle: 'Instrucciones',
    instructions: [
      'Analizar la solicitud del usuario para comprender el tipo de tarea',
      'Seleccionar el agente más apropiado de la lista siguiente',
      'Delegar la tarea a ese agente usando @agent-name',
      'Si ningún agente es adecuado, manejar la tarea directamente o sugerir qué agente podría necesitarse',
    ],
    examplesTitle: 'Ejemplos',
    examples: [
      'Usuario: "Revisa este resolver de GraphQL" → Delegar al agente relacionado con GraphQL',
      'Usuario: "Escribe pruebas para este endpoint" → Delegar al agente de escritura de pruebas',
      'Usuario: "Verifica si esto sigue nuestros patrones" → Delegar al agente de aplicación de patrones/estilos',
    ],
  },
  fr: {
    skillName: 'proteus',
    skillDescription: 'Sélectionne et délègue les tâches aux agents spécifiques au projet selon vos besoins',
    roleTitle: 'Rôle',
    roleDescription: 'Vous êtes un routeur de tâches qui analyse les demandes des utilisateurs et les délègue à l\'agent spécifique au projet le plus approprié. Chaque agent est spécialisé dans un aspect particulier de ce projet.',
    availableAgentsTitle: 'Agents Disponibles',
    instructionsTitle: 'Instructions',
    instructions: [
      'Analyser la demande de l\'utilisateur pour comprendre le type de tâche',
      'Sélectionner l\'agent le plus approprié dans la liste ci-dessous',
      'Déléguer la tâche à cet agent en utilisant @agent-name',
      'Si aucun agent ne convient, gérer la tâche directement ou suggérer quel agent pourrait être nécessaire',
    ],
    examplesTitle: 'Exemples',
    examples: [
      'Utilisateur : "Révise ce résolveur GraphQL" → Déléguer à l\'agent lié à GraphQL',
      'Utilisateur : "Écris des tests pour ce endpoint" → Déléguer à l\'agent d\'écriture de tests',
      'Utilisateur : "Vérifie si cela suit nos patterns" → Déléguer à l\'agent d\'application des patterns/styles',
    ],
  },
  de: {
    skillName: 'proteus',
    skillDescription: 'Wählt und delegiert Aufgaben an projektspezifische Agenten basierend auf Ihren Anforderungen',
    roleTitle: 'Rolle',
    roleDescription: 'Sie sind ein Aufgaben-Router, der Benutzeranfragen analysiert und sie an den am besten geeigneten projektspezifischen Agenten delegiert. Jeder Agent ist auf einen bestimmten Aspekt dieses Projekts spezialisiert.',
    availableAgentsTitle: 'Verfügbare Agenten',
    instructionsTitle: 'Anweisungen',
    instructions: [
      'Analysieren Sie die Anfrage des Benutzers, um den Aufgabentyp zu verstehen',
      'Wählen Sie den am besten geeigneten Agenten aus der folgenden Liste',
      'Delegieren Sie die Aufgabe an diesen Agenten mit @agent-name',
      'Wenn kein Agent passt, bearbeiten Sie die Aufgabe direkt oder schlagen Sie vor, welcher Agent benötigt werden könnte',
    ],
    examplesTitle: 'Beispiele',
    examples: [
      'Benutzer: "Überprüfe diesen GraphQL-Resolver" → An den GraphQL-bezogenen Agenten delegieren',
      'Benutzer: "Schreibe Tests für diesen Endpoint" → An den Test-Schreib-Agenten delegieren',
      'Benutzer: "Prüfe, ob dies unseren Mustern folgt" → An den Muster-/Stil-Durchsetzungs-Agenten delegieren',
    ],
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

  // Build agent list section
  const agentListContent = agentList.map(agent => {
    const description = extractAgentDescription(agent.content);
    return `- **@${agent.name}**: ${description}`;
  }).join('\n');

  // Build the skill content with YAML frontmatter
  const content = `---
name: ${t.skillName}
description: ${t.skillDescription}
---

# Proteus

${t.roleDescription}

**Project**: ${projectName}

## ${t.availableAgentsTitle}

${agentListContent || '_No agents available yet. Run `proteus` to generate project-specific agents._'}

## ${t.instructionsTitle}

${t.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

## ${t.examplesTitle}

${t.examples.map(ex => `- ${ex}`).join('\n')}
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
      return line.trim();
    }
  }

  return 'Project-specific agent';
}
