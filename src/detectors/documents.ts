import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

// ============================================
// Types
// ============================================

export interface ClaudeMdContent {
  path: string;
  content: string;
  rules: string[];
  conventions: string[];
  warnings: string[];
  mustDo: string[];
  prefer: string[];
  customSections: Record<string, string>;
}

export interface ReadmeContent {
  path: string;
  content: string;
  description: string;
  badges: string[];
}

export interface ExistingAgent {
  path: string;
  name: string;
  content: string;
  type: 'agent' | 'skill';
}

export interface ProjectDocuments {
  claudeMd?: ClaudeMdContent;
  claudeMdRawContent?: string;  // For passing full content to prompts
  readme?: ReadmeContent;
  existingAgents: ExistingAgent[];
  agentDirectory?: string;  // 検出された既存のエージェントディレクトリ (.claude/agents)
  skillDirectory?: string;  // 検出された既存のスキルディレクトリ (.claude/skills)
}

// ============================================
// CLAUDE.md Parser
// ============================================

function extractSection(content: string, headerPatterns: string[]): string[] {
  const lines: string[] = [];
  let inSection = false;

  for (const line of content.split('\n')) {
    // Check if this is a header we're looking for
    const isTargetHeader = headerPatterns.some(pattern => {
      const regex = new RegExp(`^##\\s*${pattern}\\s*$`, 'i');
      return regex.test(line.trim());
    });

    if (isTargetHeader) {
      inSection = true;
      continue;
    }

    // Check if we hit another header (section end)
    if (inSection && /^##\s/.test(line)) {
      break;
    }

    // Collect content in section
    if (inSection) {
      const trimmed = line.trim();
      // Extract list items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        lines.push(trimmed.slice(2).trim());
      } else if (/^\d+\.\s/.test(trimmed)) {
        lines.push(trimmed.replace(/^\d+\.\s*/, '').trim());
      }
    }
  }

  return lines;
}

function extractCustomSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentHeader = '';
  let currentContent: string[] = [];

  const knownHeaders = [
    'rules', 'ルール', 'conventions', '規約',
    'must do', 'prefer', 'warnings', '注意',
    'tech stack', 'commands', 'project structure'
  ];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch) {
      // Save previous section if it was custom
      if (currentHeader && !knownHeaders.some(h =>
        currentHeader.toLowerCase().includes(h)
      )) {
        sections[currentHeader] = currentContent.join('\n').trim();
      }

      currentHeader = headerMatch[1].trim();
      currentContent = [];
    } else if (currentHeader) {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentHeader && !knownHeaders.some(h =>
    currentHeader.toLowerCase().includes(h)
  )) {
    sections[currentHeader] = currentContent.join('\n').trim();
  }

  return sections;
}

async function parseClaudeMd(filePath: string): Promise<ClaudeMdContent> {
  const content = await fs.readFile(filePath, 'utf-8');

  return {
    path: filePath,
    content,
    rules: extractSection(content, ['Rules', 'ルール', 'Project Rules']),
    conventions: extractSection(content, ['Conventions', '規約', 'Code Conventions']),
    warnings: extractSection(content, ['Warnings', '注意', '警告', 'Cautions']),
    mustDo: extractSection(content, ['Must Do', '必須', 'Required']),
    prefer: extractSection(content, ['Prefer', '推奨', 'Recommended']),
    customSections: extractCustomSections(content),
  };
}

// ============================================
// README Parser
// ============================================

async function parseReadme(filePath: string): Promise<ReadmeContent> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract description (first paragraph after title)
  let description = '';
  let foundTitle = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() && !line.startsWith('!') && !line.startsWith('[')) {
      // Skip badges (usually images or links at the start)
      if (!line.includes('![') && !line.includes('[![')) {
        description = line.trim();
        break;
      }
    }
  }

  // Extract badges
  const badges: string[] = [];
  const badgeRegex = /\[!\[.+?\]\(.+?\)\]\(.+?\)/g;
  const matches = content.match(badgeRegex);
  if (matches) {
    badges.push(...matches);
  }

  return {
    path: filePath,
    content,
    description,
    badges,
  };
}

// ============================================
// Agent Detection
// ============================================

async function detectExistingAgents(cwd: string): Promise<{
  agents: ExistingAgent[];
  agentDirectory?: string;
  skillDirectory?: string;
}> {
  const agents: ExistingAgent[] = [];
  let agentDirectory: string | undefined;
  let skillDirectory: string | undefined;

  // Check possible agent directories (agents first, then skills)
  const agentDirs = [
    { path: '.claude/agents', type: 'agent' as const },
    { path: '.agents', type: 'agent' as const },
  ];

  const skillDirs = [
    { path: '.claude/skills', type: 'skill' as const },
    { path: '.skills', type: 'skill' as const },
  ];

  // Scan agent directories
  for (const dir of agentDirs) {
    const fullPath = path.join(cwd, dir.path);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        if (!agentDirectory) agentDirectory = dir.path;

        const files = await fg(['*.md'], {
          cwd: fullPath,
          onlyFiles: true,
        });

        for (const file of files) {
          if (file.startsWith('_')) continue;

          const filePath = path.join(fullPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const name = path.basename(file, '.md');

          agents.push({
            path: filePath,
            name,
            content,
            type: 'agent',
          });
        }
        break;
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Scan skill directories
  for (const dir of skillDirs) {
    const fullPath = path.join(cwd, dir.path);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        if (!skillDirectory) skillDirectory = dir.path;

        const files = await fg(['*.md'], {
          cwd: fullPath,
          onlyFiles: true,
        });

        for (const file of files) {
          if (file.startsWith('_') || file === 'SKILL.md') continue;

          const filePath = path.join(fullPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const name = path.basename(file, '.md');

          // Check if it's a skill (has YAML frontmatter)
          const isSkill = content.startsWith('---');

          agents.push({
            path: filePath,
            name,
            content,
            type: isSkill ? 'skill' : 'agent',
          });
        }
        break;
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return { agents, agentDirectory, skillDirectory };
}

// ============================================
// Main Detection Function
// ============================================

export async function detectProjectDocuments(cwd: string): Promise<ProjectDocuments> {
  const result: ProjectDocuments = {
    existingAgents: [],
  };

  // Detect CLAUDE.md
  const claudeMdPaths = ['CLAUDE.md', 'claude.md', '.claude/CLAUDE.md'];
  for (const claudePath of claudeMdPaths) {
    const fullPath = path.join(cwd, claudePath);
    try {
      await fs.access(fullPath);
      result.claudeMd = await parseClaudeMd(fullPath);
      break;
    } catch {
      // File doesn't exist
    }
  }

  // Detect README.md
  const readmePaths = ['README.md', 'readme.md', 'Readme.md'];
  for (const readmePath of readmePaths) {
    const fullPath = path.join(cwd, readmePath);
    try {
      await fs.access(fullPath);
      result.readme = await parseReadme(fullPath);
      break;
    } catch {
      // File doesn't exist
    }
  }

  // Detect existing agents and skills
  const { agents, agentDirectory, skillDirectory } = await detectExistingAgents(cwd);
  result.existingAgents = agents;
  result.agentDirectory = agentDirectory;
  result.skillDirectory = skillDirectory;

  // Store raw CLAUDE.md content for prompts
  if (result.claudeMd) {
    result.claudeMdRawContent = result.claudeMd.content;
  }

  return result;
}
