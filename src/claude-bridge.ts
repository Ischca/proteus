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
  const existingAgents = documents.existingAgents.map(a => a.name).join(', ') || 'none';

  return `You are a project analysis expert. Based on the following project information, suggest 5 optimal Claude Code agents specifically tailored for this project.

## Project Information

- **Name**: ${analysis.projectName}
- **Language**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **Framework**: ${analysis.stack.framework}
- **Test Framework**: ${analysis.stack.testFramework}
- **Additional Tools**: ${analysis.stack.additionalTools.join(', ') || 'none'}
- **Project Structure**: ${analysis.patterns.structure.type}
- **Existing Agents**: ${existingAgents}

## Existing Rules/Conventions
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : 'None specified'}

## Requirements

1. Suggest agents that are PERSONALIZED for this specific project
2. NOT generic agents - they must be specialized for this project's language, framework, and structure
3. Do not duplicate existing agents
4. Include a specific role and reason why each agent is valuable for THIS project

## Output Format (JSON)

Output in the following format:

\`\`\`json
[
  {
    "name": "agent-name-in-kebab-case",
    "description": "One-line description of what this agent does",
    "focus": "The specific domain this agent specializes in",
    "reason": "Why this agent is valuable for this specific project"
  }
]
\`\`\`

Output ONLY the JSON.`;
}

function buildClaudeMdPrompt(analysis: AnalysisResult, documents: ProjectDocuments): string {
  const existingContent = documents.claudeMd?.rawContent || '';

  return `You are a project documentation expert. Based on the following project information, generate a CLAUDE.md file (project description file for Claude Code).

## Project Information

- **Name**: ${analysis.projectName}
- **Description**: ${analysis.description || 'Unknown'}
- **Language**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **Framework**: ${analysis.stack.framework} ${analysis.stack.frameworkVersion || ''}
- **Test Framework**: ${analysis.stack.testFramework}
- **Package Manager**: ${analysis.stack.packageManager}
- **Additional Tools**: ${analysis.stack.additionalTools.join(', ') || 'none'}

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

Output ONLY the Markdown content.`;
}

function buildAgentPrompt(
  agentName: string,
  agentDescription: string,
  analysis: AnalysisResult,
  documents: ProjectDocuments
): string {
  const existingRules = documents.claudeMd?.rules || [];
  const conventions = documents.claudeMd?.conventions || [];

  return `You are a Claude Code agent design expert. Based on the following information, generate a project-specific agent definition in Markdown.

## Agent Information
- **Name**: ${agentName}
- **Description**: ${agentDescription}

## Project Information
- **Name**: ${analysis.projectName}
- **Language**: ${analysis.stack.language} ${analysis.stack.languageVersion || ''}
- **Framework**: ${analysis.stack.framework}
- **Test Framework**: ${analysis.stack.testFramework}
- **Project Structure**: ${analysis.patterns.structure.type}
- **Source Directory**: ${analysis.patterns.structure.sourceDir}

## Project Rules/Conventions
${existingRules.length > 0 ? existingRules.map(r => `- ${r}`).join('\n') : 'None specified'}

## Project Practices
${conventions.length > 0 ? conventions.map(c => `- ${c}`).join('\n') : 'None specified'}

## Requirements

1. Generate an agent PERSONALIZED for this specific project
2. Include specific instructions tailored to the project's language, framework, and structure
3. Include instructions to follow the project's rules and conventions
4. Clearly describe the agent's role, capabilities, and constraints
5. Include concrete use cases specific to this project, not generic examples

## Output Format

Output Markdown with the following structure:

\`\`\`markdown
# {Agent Name}

{One-line description}

## Role

{Specific role this agent handles}

## Expertise

{Detailed expertise in context of this project}

## Instructions

{Specific instructions for this agent, including project-specific rules}

## Constraints

{What this agent should NOT do}

## Usage Examples

{Concrete examples and prompts for using this agent}
\`\`\`

Output ONLY the Markdown content.`;
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
