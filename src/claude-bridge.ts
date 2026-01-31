import { execSync, spawnSync } from 'child_process';
import type { AnalysisResult } from './types.js';
import type { ProjectDocuments } from './detectors/documents.js';

export type OutputLanguage = 'en' | 'ja' | 'zh' | 'ko' | 'es' | 'fr' | 'de';

export interface ClaudeBridgeOptions {
  timeout?: number;  // milliseconds
  verbose?: boolean;
  lang?: OutputLanguage;
}

const LANGUAGE_NAMES: Record<OutputLanguage, string> = {
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

/**
 * Format stack information for prompts, including monorepo and multiple stacks
 */
function formatStackInfo(analysis: AnalysisResult): string {
  const { stack } = analysis;
  const lines: string[] = [];

  // Monorepo info
  if (stack.monorepo) {
    lines.push(`- **Monorepo**: ${stack.monorepo.type}`);
    lines.push(`- **Workspaces**: ${stack.monorepo.workspaces.join(', ')}`);
  }

  // Multiple stacks
  if (stack.stacks.length > 1) {
    lines.push(`- **Multiple Stacks Detected**: ${stack.stacks.length} workspaces`);
    lines.push(`- **All Languages**: ${stack.allLanguages.join(', ')}`);
    lines.push(`- **All Frameworks**: ${stack.allFrameworks.filter(f => f !== 'unknown').join(', ') || 'none'}`);
    lines.push('');
    lines.push('### Workspace Details');
    for (const s of stack.stacks) {
      const location = s.name ? `${s.name} (${s.path})` : s.path || '.';
      const fw = s.framework !== 'unknown' ? ` + ${s.framework}` : '';
      lines.push(`- **${location}**: ${s.language}${fw}, test: ${s.testFramework}, pkg: ${s.packageManager}`);
    }
  } else {
    // Single stack (original format)
    lines.push(`- **Language**: ${stack.language} ${stack.languageVersion || ''}`);
    lines.push(`- **Framework**: ${stack.framework}${stack.frameworkVersion ? ' ' + stack.frameworkVersion : ''}`);
    lines.push(`- **Test Framework**: ${stack.testFramework}`);
    lines.push(`- **Package Manager**: ${stack.packageManager}`);
  }

  // Common info
  lines.push(`- **Additional Tools**: ${stack.additionalTools.join(', ') || 'none'}`);

  return lines.join('\n');
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
  const prompt = buildAgentSuggestionPrompt(analysis, documents, options.lang || 'en');
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
  const prompt = buildClaudeMdPrompt(analysis, documents, options.lang || 'en');
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
  const prompt = buildAgentPrompt(agentName, agentDescription, analysis, documents, options.lang || 'en');
  return callClaude(prompt, options);
}

// ============================================
// Prompt Builders
// ============================================

function buildAgentSuggestionPrompt(analysis: AnalysisResult, documents: ProjectDocuments, lang: OutputLanguage): string {
  const existingRules = documents.claudeMd?.rules || [];
  const existingAgentsList = documents.existingAgents.filter(a => a.type === 'agent');
  const existingAgentNames = existingAgentsList.map(a => a.name);
  const existingAgentsStr = existingAgentNames.length > 0 ? existingAgentNames.join(', ') : 'none';
  const langName = LANGUAGE_NAMES[lang];
  const keyDirs = analysis.patterns.structure.keyDirectories || [];

  // Calculate how many agents to suggest based on existing count
  const existingCount = existingAgentNames.length;
  let suggestCount: number;
  let suggestNote: string;

  if (existingCount === 0) {
    suggestCount = 5;
    suggestNote = 'This project has no agents yet. Suggest 5 agents to provide good coverage.';
  } else if (existingCount <= 2) {
    suggestCount = 3;
    suggestNote = `This project has ${existingCount} agent(s). Suggest up to 3 MORE agents that complement the existing ones.`;
  } else if (existingCount <= 4) {
    suggestCount = 2;
    suggestNote = `This project has ${existingCount} agents. Only suggest 1-2 MORE agents if there are clear gaps.`;
  } else {
    suggestCount = 1;
    suggestNote = `This project already has ${existingCount} agents. Only suggest 0-1 agents if there's a critical gap. Return empty array [] if coverage is sufficient.`;
  }

  return `You are a project analysis expert. Based on the following project information, suggest Claude Code agents specifically tailored for this project.

**IMPORTANT: All output text (description, focus, reason) must be in ${langName}.**

## Suggestion Guidelines

${suggestNote}

**Maximum suggestions: ${suggestCount}**
**If existing agents already cover the project well, return an EMPTY array: []**

## Project Information

- **Name**: ${analysis.projectName}
- **Description**: ${analysis.description || 'Not specified'}
${formatStackInfo(analysis)}
- **Project Structure**: ${analysis.patterns.structure.type}
- **Source Directory**: ${analysis.patterns.structure.sourceDir}
- **Test Directory**: ${analysis.patterns.structure.testDir || 'same as source'}

## Key Directories
${keyDirs.length > 0 ? keyDirs.map(d => `- \`${d.path}\`: ${d.purpose}`).join('\n') : 'Not analyzed'}

## Commands
- Build: \`${analysis.commands.build || 'N/A'}\`
- Test: \`${analysis.commands.test || 'N/A'}\`
- Lint: \`${analysis.commands.lint || 'N/A'}\`

## Code Patterns
- Import Style: ${analysis.patterns.imports?.style || 'mixed'}
- Export Style: ${analysis.patterns.exports?.style || 'mixed'}
- Naming: functions=${analysis.patterns.naming.code.functions}, types=${analysis.patterns.naming.code.types || 'PascalCase'}

## Existing Rules/Conventions
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : 'None specified'}

## Existing Agents (NEVER duplicate these names)
${existingAgentsStr}

## Requirements

1. **NEVER suggest agents with same names as existing agents**
2. **HIGHLY PERSONALIZED**: Agents must be specific to THIS project, not generic
3. **Complementary**: New agents should fill gaps, not overlap with existing ones
4. **Practical focus**: Each agent should address a REAL need based on the project's stack
5. **Write all descriptions in ${langName}**
6. **Return empty array [] if existing agents are sufficient**

## What makes a GOOD agent suggestion:
- ✅ "nextjs-app-router-optimizer" for a Next.js 14 project
- ✅ "vitest-coverage-improver" for a project using Vitest
- ❌ "code-reviewer" (too generic)
- ❌ Anything that overlaps with existing agents

## Output Format (JSON)

\`\`\`json
[
  {
    "name": "specific-descriptive-name",
    "description": "One-line description in ${langName}",
    "focus": "The specific domain in ${langName}",
    "reason": "Why valuable for THIS project specifically in ${langName}"
  }
]
\`\`\`

Output ONLY the JSON. Return [] if no new agents needed.`;
}

function buildClaudeMdPrompt(analysis: AnalysisResult, documents: ProjectDocuments, lang: OutputLanguage): string {
  const existingContent = documents.claudeMd?.rawContent || '';
  const langName = LANGUAGE_NAMES[lang];

  return `You are a project documentation expert. Based on the following project information, generate a CLAUDE.md file (project description file for Claude Code).

**IMPORTANT: Write the entire document in ${langName}.**

## Project Information

- **Name**: ${analysis.projectName}
- **Description**: ${analysis.description || 'Unknown'}
${formatStackInfo(analysis)}

## Project Structure
- Type: ${analysis.patterns.structure.type}
- Source Directory: ${analysis.patterns.structure.sourceDir}
- Test Directory: ${analysis.patterns.structure.testDir || 'none'}

## Commands
- Development: ${analysis.commands.dev || 'none'}
- Build: ${analysis.commands.build || 'none'}
- Test: ${analysis.commands.test || 'none'}
- Lint: ${analysis.commands.lint || 'none'}

## Naming Conventions
- Component Files: ${analysis.patterns.naming.files.components || 'unknown'}
- Test Files: ${analysis.patterns.naming.files.tests || 'unknown'}
- Functions: ${analysis.patterns.naming.code.functions}
- Variables: ${analysis.patterns.naming.code.variables}

${existingContent ? `## Existing CLAUDE.md Content (for reference)\n${existingContent}` : ''}

## Requirements

1. Create content that helps Claude Code understand and work effectively with this project
2. Include important rules, conventions, and best practices
3. Output in clear, readable Markdown format
4. If existing content exists, improve upon it while preserving valuable information
5. **Write the entire document in ${langName}**

Output ONLY the Markdown content.`;
}

function buildAgentPrompt(
  agentName: string,
  agentDescription: string,
  analysis: AnalysisResult,
  documents: ProjectDocuments,
  lang: OutputLanguage
): string {
  const existingRules = documents.claudeMd?.rules || [];
  const conventions = documents.claudeMd?.conventions || [];
  const langName = LANGUAGE_NAMES[lang];
  const keyDirs = analysis.patterns.structure.keyDirectories || [];
  const existingAgentNames = documents.existingAgents.map(a => a.name);
  const claudeMdContent = documents.claudeMd?.rawContent || '';

  return `You are a Claude Code agent design expert. Generate a HIGHLY PERSONALIZED agent definition for this specific project.

**IMPORTANT: Write the entire agent definition in ${langName}.**

## Agent to Generate
- **Name**: ${agentName}
- **Description**: ${agentDescription}

## Project Context

### Basic Info
- **Project**: ${analysis.projectName}
- **Description**: ${analysis.description || 'Not specified'}
${formatStackInfo(analysis)}

### Project Structure
- **Type**: ${analysis.patterns.structure.type}
- **Source**: \`${analysis.patterns.structure.sourceDir}\`
- **Tests**: \`${analysis.patterns.structure.testDir || analysis.patterns.structure.sourceDir}\`

### Key Directories (IMPORTANT - reference these in the agent!)
${keyDirs.length > 0 ? keyDirs.map(d => `- \`${d.path}\`: ${d.purpose}`).join('\n') : '- Standard structure'}

### Commands
- Build: \`${analysis.commands.build || 'npm run build'}\`
- Test: \`${analysis.commands.test || 'npm test'}\`
- Lint: \`${analysis.commands.lint || 'npm run lint'}\`
- Typecheck: \`${analysis.commands.typecheck || 'npm run typecheck'}\`

### Code Conventions
- Functions: ${analysis.patterns.naming.code.functions}
- Variables: ${analysis.patterns.naming.code.variables}
- Constants: ${analysis.patterns.naming.code.constants}
- Types: ${analysis.patterns.naming.code.types || 'PascalCase'}
- Test files: ${analysis.patterns.naming.files.tests || '*.test.ts'}
- Import style: ${analysis.patterns.imports?.style || 'relative'}
- Export style: ${analysis.patterns.exports?.style || 'named'}

### Project Rules (from CLAUDE.md)
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : 'No explicit rules defined'}

### Project Practices
${conventions.length > 0 ? conventions.map(c => `- ${c}`).join('\n') : 'No explicit conventions defined'}

${claudeMdContent ? `### Full CLAUDE.md Content (for deep context)\n\`\`\`\n${claudeMdContent.slice(0, 2000)}${claudeMdContent.length > 2000 ? '\n...(truncated)' : ''}\n\`\`\`` : ''}

### Related Agents (for potential collaboration)
${existingAgentNames.length > 0 ? existingAgentNames.map(n => `- ${n}`).join('\n') : 'This is the first agent'}

## Generation Requirements

1. **Be EXTREMELY specific** to this project:
   - Reference actual directory paths (e.g., "when working in \`${analysis.patterns.structure.sourceDir}\`...")
   - Mention the specific framework/versions
   - Use the project's actual commands

2. **Include project-specific code examples**:
   - Show examples using the project's naming conventions
   - Use the project's test framework syntax
   - Follow the import/export style

3. **Reference other agents** if relevant:
   - Mention when to hand off to other agents
   - Describe complementary workflows

4. **Constraints must be actionable**:
   - Include verification commands (e.g., "Run \`${analysis.commands.test}\` after changes")
   - Reference project-specific limits or rules

5. **Usage Examples must be concrete**:
   - Use realistic file paths from this project
   - Show actual commands the user would run

## Output Format

\`\`\`markdown
# {Agent Name}

{One-line description connecting to ${analysis.projectName}}

## Role

{Role specific to this ${analysis.stack.language}/${analysis.stack.framework} project}

## Expertise

{Bulleted list of expertise areas, referencing project specifics}

## Instructions

{Step-by-step instructions with project-specific details}
{Include subsections for different scenarios}
{Reference actual paths like \`${analysis.patterns.structure.sourceDir}/...\`}

## Constraints

{Numbered constraints with verification steps}
{Include commands like \`${analysis.commands.test}\`, \`${analysis.commands.lint}\`}

## Usage Examples

{3+ concrete examples with:}
- Realistic prompts a user might give
- Expected behavior referencing project structure
\`\`\`

Output ONLY the Markdown content, no code fences around it.`;
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
