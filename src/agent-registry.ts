import * as fs from 'fs';
import * as path from 'path';
import type { AgentSuggestion, OutputLanguage } from './claude-bridge.js';

// ============================================
// i18n
// ============================================

interface RegistryI18n {
  availableAgents: string;
  noAgentsConfigured: string;
  agentHeader: string;
  descriptionHeader: string;
  pathHeader: string;
  agentsAvailable: (count: number) => string;
  projectAgentsTitle: string;
  projectAgentsDescription: string;
}

const I18N: Record<OutputLanguage, RegistryI18n> = {
  en: {
    availableAgents: 'Available Agents',
    noAgentsConfigured: 'No agents configured yet.',
    agentHeader: 'Agent',
    descriptionHeader: 'Description',
    pathHeader: 'Path',
    agentsAvailable: (n) => `${n} agent(s) available`,
    projectAgentsTitle: 'Project Agents',
    projectAgentsDescription: 'This file lists all available Claude Code agents for this project.',
  },
  ja: {
    availableAgents: '利用可能なエージェント',
    noAgentsConfigured: 'エージェントはまだ設定されていません。',
    agentHeader: 'エージェント',
    descriptionHeader: '説明',
    pathHeader: 'パス',
    agentsAvailable: (n) => `${n}個のエージェントが利用可能`,
    projectAgentsTitle: 'プロジェクトエージェント',
    projectAgentsDescription: 'このファイルは、このプロジェクトで利用可能なClaude Codeエージェントの一覧です。',
  },
  zh: {
    availableAgents: '可用代理',
    noAgentsConfigured: '尚未配置代理。',
    agentHeader: '代理',
    descriptionHeader: '描述',
    pathHeader: '路径',
    agentsAvailable: (n) => `${n}个代理可用`,
    projectAgentsTitle: '项目代理',
    projectAgentsDescription: '此文件列出了此项目所有可用的Claude Code代理。',
  },
  ko: {
    availableAgents: '사용 가능한 에이전트',
    noAgentsConfigured: '아직 구성된 에이전트가 없습니다.',
    agentHeader: '에이전트',
    descriptionHeader: '설명',
    pathHeader: '경로',
    agentsAvailable: (n) => `${n}개의 에이전트 사용 가능`,
    projectAgentsTitle: '프로젝트 에이전트',
    projectAgentsDescription: '이 파일은 이 프로젝트에서 사용 가능한 Claude Code 에이전트 목록입니다.',
  },
  es: {
    availableAgents: 'Agentes Disponibles',
    noAgentsConfigured: 'No hay agentes configurados todavía.',
    agentHeader: 'Agente',
    descriptionHeader: 'Descripción',
    pathHeader: 'Ruta',
    agentsAvailable: (n) => `${n} agente(s) disponible(s)`,
    projectAgentsTitle: 'Agentes del Proyecto',
    projectAgentsDescription: 'Este archivo lista todos los agentes de Claude Code disponibles para este proyecto.',
  },
  fr: {
    availableAgents: 'Agents Disponibles',
    noAgentsConfigured: 'Aucun agent configuré pour le moment.',
    agentHeader: 'Agent',
    descriptionHeader: 'Description',
    pathHeader: 'Chemin',
    agentsAvailable: (n) => `${n} agent(s) disponible(s)`,
    projectAgentsTitle: 'Agents du Projet',
    projectAgentsDescription: 'Ce fichier liste tous les agents Claude Code disponibles pour ce projet.',
  },
  de: {
    availableAgents: 'Verfügbare Agenten',
    noAgentsConfigured: 'Noch keine Agenten konfiguriert.',
    agentHeader: 'Agent',
    descriptionHeader: 'Beschreibung',
    pathHeader: 'Pfad',
    agentsAvailable: (n) => `${n} Agent(en) verfügbar`,
    projectAgentsTitle: 'Projekt-Agenten',
    projectAgentsDescription: 'Diese Datei listet alle verfügbaren Claude Code Agenten für dieses Projekt auf.',
  },
};

// ============================================
// Types
// ============================================

export interface AgentRegistryOptions {
  projectPath: string;
  agentDir: string;
  format?: 'table' | 'list';
  lang?: OutputLanguage;
}

export interface ExistingAgent {
  name: string;
  description?: string;
  path: string;
}

interface RegistryUpdateResult {
  file: string;
  action: 'created' | 'updated' | 'added-section';
  agentCount: number;
}

// ============================================
// Functions
// ============================================

/**
 * Scan for existing agents in the agent directory
 */
export function scanExistingAgents(agentDir: string): ExistingAgent[] {
  const agents: ExistingAgent[] = [];

  if (!fs.existsSync(agentDir)) {
    return agents;
  }

  const files = fs.readdirSync(agentDir);

  for (const file of files) {
    if (!file.endsWith('.md') || file.startsWith('_') || file.toLowerCase() === 'readme.md') {
      continue;
    }

    const filePath = path.join(agentDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract name from H1 heading or filename
    const h1Match = content.match(/^#\s+(.+)$/m);
    const name = h1Match ? h1Match[1].trim() : file.replace('.md', '');

    // Extract description from first paragraph after H1
    const descMatch = content.match(/^#\s+.+\n+([^#\n].+)/m);
    const description = descMatch ? descMatch[1].trim() : undefined;

    agents.push({
      name,
      description,
      path: file,
    });
  }

  return agents;
}

/**
 * Generate agent list section content
 */
export function generateAgentListSection(
  agents: ExistingAgent[],
  agentDir: string,
  format: 'table' | 'list' = 'table',
  lang: OutputLanguage = 'en'
): string {
  const t = I18N[lang];

  if (agents.length === 0) {
    return `## ${t.availableAgents}\n\n${t.noAgentsConfigured}\n`;
  }

  const relativePath = agentDir.replace(/^\.\//, '');

  if (format === 'table') {
    let section = `## ${t.availableAgents}\n\n`;
    section += `| ${t.agentHeader} | ${t.descriptionHeader} | ${t.pathHeader} |\n`;
    section += '|-------|-------------|------|\n';

    for (const agent of agents) {
      const desc = agent.description ? truncate(agent.description, 60) : '-';
      section += `| ${agent.name} | ${desc} | \`${relativePath}/${agent.path}\` |\n`;
    }

    section += `\n*${t.agentsAvailable(agents.length)}*\n`;
    return section;
  } else {
    let section = `## ${t.availableAgents}\n\n`;

    for (const agent of agents) {
      section += `### ${agent.name}\n`;
      if (agent.description) {
        section += `${agent.description}\n`;
      }
      section += `- **${t.pathHeader}**: \`${relativePath}/${agent.path}\`\n\n`;
    }

    return section;
  }
}

/**
 * Update or create agent registry in CLAUDE.md or agents.md
 */
export function updateAgentRegistry(
  options: AgentRegistryOptions,
  newAgents: AgentSuggestion[] = []
): RegistryUpdateResult | null {
  const { projectPath, agentDir, format = 'table', lang = 'en' } = options;
  const t = I18N[lang];

  // Scan all existing agents
  const existingAgents = scanExistingAgents(path.join(projectPath, agentDir));

  // Merge with newly generated agents
  const allAgents: ExistingAgent[] = [...existingAgents];

  for (const newAgent of newAgents) {
    const filename = `${newAgent.name}.md`;
    if (!allAgents.some(a => a.path === filename)) {
      allAgents.push({
        name: formatAgentName(newAgent.name),
        description: newAgent.description,
        path: filename,
      });
    }
  }

  // Generate the agent list section
  const agentSection = generateAgentListSection(allAgents, agentDir, format, lang);

  // Try to update CLAUDE.md first, then agents.md
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  const agentsMdPath = path.join(projectPath, 'agents.md');

  // Check if CLAUDE.md exists and update it
  if (fs.existsSync(claudeMdPath)) {
    const result = updateFileWithAgentSection(claudeMdPath, agentSection, lang);
    return {
      file: 'CLAUDE.md',
      action: result.action,
      agentCount: allAgents.length,
    };
  }

  // Check if agents.md exists and update it
  if (fs.existsSync(agentsMdPath)) {
    const result = updateFileWithAgentSection(agentsMdPath, agentSection, lang);
    return {
      file: 'agents.md',
      action: result.action,
      agentCount: allAgents.length,
    };
  }

  // Create new agents.md if neither exists
  const newContent = `# ${t.projectAgentsTitle}\n\n${t.projectAgentsDescription}\n\n${agentSection}`;
  fs.writeFileSync(agentsMdPath, newContent, 'utf-8');

  return {
    file: 'agents.md',
    action: 'created',
    agentCount: allAgents.length,
  };
}

/**
 * Update a file with the agent section
 */
function updateFileWithAgentSection(
  filePath: string,
  agentSection: string,
  lang: OutputLanguage
): { action: 'updated' | 'added-section' } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const t = I18N[lang];

  // Pattern to match existing agent section (any language)
  const allSectionHeaders = Object.values(I18N).map(i => i.availableAgents).join('|');
  const agentSectionPattern = new RegExp(`## (${allSectionHeaders})[\\s\\S]*?(?=\\n## |\\n# |$)`);

  if (agentSectionPattern.test(content)) {
    // Replace existing section
    const newContent = content.replace(agentSectionPattern, agentSection.trim());
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { action: 'updated' };
  } else {
    // Add new section at the end
    const newContent = content.trimEnd() + '\n\n' + agentSection;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { action: 'added-section' };
  }
}

/**
 * Format agent name for display (kebab-case to Title Case)
 */
function formatAgentName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Check if agent registry update is needed
 */
export function shouldUpdateRegistry(
  projectPath: string,
  agentDir: string,
  newAgentCount: number
): boolean {
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  const agentsMdPath = path.join(projectPath, 'agents.md');

  // If no registry file exists, we should create one
  if (!fs.existsSync(claudeMdPath) && !fs.existsSync(agentsMdPath)) {
    return true;
  }

  // Check if the agent count in the registry matches
  const existingAgents = scanExistingAgents(path.join(projectPath, agentDir));

  // If new agents were generated, we should update
  if (newAgentCount > 0) {
    return true;
  }

  // Check if registry is out of sync with actual agents
  const registryPath = fs.existsSync(claudeMdPath) ? claudeMdPath : agentsMdPath;
  const content = fs.readFileSync(registryPath, 'utf-8');

  // Simple heuristic: check if agent count in file matches (any language pattern)
  const agentCountMatch = content.match(/\*(\d+)/);
  if (agentCountMatch) {
    const registeredCount = parseInt(agentCountMatch[1], 10);
    return registeredCount !== existingAgents.length;
  }

  return true; // Default to update if we can't determine
}
