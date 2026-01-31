#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

import { detectStack } from './detectors/stack.js';
import { detectPatterns } from './detectors/patterns.js';
import { detectCommands } from './detectors/commands.js';
import { detectProjectDocuments } from './detectors/documents.js';
import { generateClaudeMd } from './generator.js';
import { generateAgents, selectRecommendedAgents } from './agent-generator.js';
import type { AnalysisResult, CLIOptions, GeneratorOptions, AgentType, TransformOptions } from './types.js';

// Read version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
const VERSION = pkg.version;

// ============================================
// ASCII Art Logo
// ============================================

const LOGO = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('🔱 PROTEUS')}                            ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Shape-shifting project intelligence')}   ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

// ============================================
// Main Analysis Function
// ============================================

async function analyze(cwd: string): Promise<AnalysisResult> {
  const spinner = ora('Detecting tech stack...').start();

  // Detect stack
  const stack = await detectStack(cwd);
  spinner.text = `Found: ${chalk.cyan(stack.language)} / ${chalk.cyan(stack.framework)}`;
  spinner.succeed();

  // Detect patterns
  spinner.start('Analyzing code patterns...');
  const patterns = await detectPatterns(cwd, stack);
  spinner.succeed('Code patterns analyzed');

  // Detect commands
  spinner.start('Detecting commands...');
  const commands = await detectCommands(cwd, stack);
  spinner.succeed('Commands detected');

  // Get project name
  const projectName = await getProjectName(cwd);

  // Calculate confidence
  const confidence = calculateConfidence(stack, patterns);

  return {
    projectName,
    projectPath: cwd,
    stack,
    patterns,
    commands,
    confidence,
  };
}

async function getProjectName(cwd: string): Promise<string> {
  // Try package.json
  try {
    const pkg = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
    const { name } = JSON.parse(pkg);
    if (name) return name;
  } catch {}

  // Try go.mod
  try {
    const goMod = await fs.readFile(path.join(cwd, 'go.mod'), 'utf-8');
    const match = goMod.match(/^module\s+(.+)$/m);
    if (match) {
      const parts = match[1].split('/');
      return parts[parts.length - 1];
    }
  } catch {}

  // Try Cargo.toml
  try {
    const cargo = await fs.readFile(path.join(cwd, 'Cargo.toml'), 'utf-8');
    const match = cargo.match(/^name\s*=\s*"(.+)"/m);
    if (match) return match[1];
  } catch {}

  // Fallback to directory name
  return path.basename(cwd);
}

function calculateConfidence(stack: any, patterns: any): { stack: number; patterns: number; overall: number } {
  let stackScore = 0;

  if (stack.language !== 'unknown') stackScore += 0.4;
  if (stack.framework !== 'unknown') stackScore += 0.3;
  if (stack.testFramework !== 'unknown') stackScore += 0.2;
  if (stack.packageManager !== 'unknown') stackScore += 0.1;

  let patternsScore = 0;

  if (patterns.structure.type !== 'unknown') patternsScore += 0.4;
  if (patterns.structure.keyDirectories.length > 0) patternsScore += 0.3;
  if (patterns.naming.files.components || patterns.naming.files.utilities) patternsScore += 0.3;

  return {
    stack: stackScore,
    patterns: patternsScore,
    overall: (stackScore + patternsScore) / 2,
  };
}

// ============================================
// Transform Command (Default)
// ============================================

async function runTransform(options: TransformOptions) {
  console.log(LOGO);

  const cwd = process.cwd();

  console.log(chalk.gray(`\nAnalyzing ${cwd}...\n`));

  // Step 1: Analyze project
  const analysis = await analyze(cwd);

  // Step 2: Detect existing documents
  const spinner = ora('Reading existing documents...').start();
  const docs = await detectProjectDocuments(cwd);

  if (docs.claudeMd) {
    spinner.succeed(`Found CLAUDE.md with ${docs.claudeMd.rules.length} rules`);
  } else {
    spinner.succeed('No existing CLAUDE.md found');
  }

  if (docs.existingAgents.length > 0) {
    console.log(chalk.gray(`  Found ${docs.existingAgents.length} existing agents in ${docs.agentDirectory}/`));
  }

  // Print summary
  printSummary(analysis);

  // Step 3: Select agents to generate
  let agentTypes: AgentType[] = options.agents;

  if (agentTypes.length === 0) {
    // Auto-select based on project
    agentTypes = selectRecommendedAgents(analysis);
  }

  console.log(chalk.cyan('\nAgents to generate:'));
  for (const type of agentTypes) {
    console.log(`  - ${chalk.white(type)}`);
  }

  // Step 4: Determine output directory
  const outputDir = options.outputDir || docs.agentDirectory || '.agents';
  console.log(chalk.gray(`\nOutput directory: ${outputDir}/`));

  // Step 5: Generate agents
  const agents = generateAgents(agentTypes, analysis, docs);

  // Dry run - just print
  if (options.dryRun) {
    console.log(chalk.gray('\n--- Generated Agents (dry run) ---\n'));
    for (const agent of agents) {
      console.log(chalk.bold.cyan(`\n=== ${agent.name}.md ===\n`));
      console.log(agent.content);
    }
    console.log(chalk.gray('\n--- End of preview ---\n'));
    return;
  }

  // Interactive confirmation
  if (options.interactive && !options.force) {
    console.log(chalk.gray('\n--- Preview ---\n'));
    for (const agent of agents) {
      console.log(chalk.bold(`${agent.name}.md`));
      console.log(agent.content.split('\n').slice(0, 10).join('\n'));
      console.log(chalk.gray('...\n'));
    }

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Generate ${agents.length} agents in ${outputDir}/?`,
      initial: true,
    });

    if (!confirm) {
      console.log(chalk.gray('Cancelled'));
      return;
    }
  }

  // Create output directory
  const fullOutputDir = path.join(cwd, outputDir);
  await fs.mkdir(fullOutputDir, { recursive: true });

  // Save agents
  for (const agent of agents) {
    const filePath = path.join(fullOutputDir, agent.path);
    await fs.writeFile(filePath, agent.content);
    console.log(chalk.green(`✅ Created ${outputDir}/${agent.path}`));
  }

  // Optionally generate CLAUDE.md
  if (options.includeClaudeMd && !docs.claudeMd) {
    const generatorOptions: GeneratorOptions = {
      template: 'full',
      includeExamples: true,
      includeComments: true,
      version: VERSION,
    };
    const claudeContent = generateClaudeMd(analysis, generatorOptions);
    await fs.writeFile(path.join(cwd, 'CLAUDE.md'), claudeContent);
    console.log(chalk.green('✅ Created CLAUDE.md'));
  }

  // Print next steps
  console.log(chalk.gray('\n🔱 Transformation complete!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray(`  1. Review agents in ${outputDir}/`));
  console.log(chalk.gray('  2. Customize based on your needs'));
  console.log(chalk.gray('  3. Use with Claude Code'));
}

// ============================================
// Init Command (Legacy - CLAUDE.md only)
// ============================================

async function runInit(options: CLIOptions) {
  console.log(LOGO);

  const cwd = process.cwd();

  // Check if CLAUDE.md already exists
  const claudeMdPath = path.join(cwd, options.output || 'CLAUDE.md');
  let existingContent: string | null = null;

  try {
    existingContent = await fs.readFile(claudeMdPath, 'utf-8');
  } catch {}

  if (existingContent && !options.force) {
    console.log(chalk.yellow('⚠️  CLAUDE.md already exists'));

    if (options.interactive) {
      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: 'Overwrite', value: 'overwrite' },
          { title: 'Run transform instead', value: 'transform' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (action === 'cancel') {
        console.log(chalk.gray('Cancelled'));
        return;
      }

      if (action === 'transform') {
        await runTransform({
          agents: [],
          dryRun: options.dryRun,
          force: options.force,
          interactive: options.interactive,
          includeClaudeMd: false,
        });
        return;
      }
    } else {
      console.log(chalk.gray('Use --force to overwrite, or run `proteus transform`'));
      return;
    }
  }

  // Run analysis
  console.log(chalk.gray(`\nAnalyzing ${cwd}...\n`));

  const result = await analyze(cwd);

  // Print summary
  printSummary(result);

  // Generate CLAUDE.md
  const generatorOptions: GeneratorOptions = {
    template: options.template,
    includeExamples: true,
    includeComments: true,
    version: VERSION,
  };

  const content = generateClaudeMd(result, generatorOptions);

  // Dry run - just print
  if (options.dryRun) {
    console.log(chalk.gray('\n--- Generated CLAUDE.md (dry run) ---\n'));
    console.log(content);
    console.log(chalk.gray('\n--- End of preview ---\n'));
    return;
  }

  // Interactive confirmation
  if (options.interactive && !options.force) {
    console.log(chalk.gray('\n--- Preview ---\n'));
    console.log(content.split('\n').slice(0, 30).join('\n'));
    console.log(chalk.gray('...\n'));

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Save CLAUDE.md?',
      initial: true,
    });

    if (!confirm) {
      console.log(chalk.gray('Cancelled'));
      return;
    }
  }

  // Save file
  await fs.writeFile(claudeMdPath, content);
  console.log(chalk.green(`\n✅ Saved ${claudeMdPath}`));

  // Suggest transform
  console.log(chalk.gray('\nTip: Run `proteus transform` to generate project-specific agents!'));
}

function printSummary(result: AnalysisResult) {
  const { stack, patterns, confidence } = result;

  console.log(chalk.bold('\n📊 Analysis Summary\n'));

  // Stack
  console.log(chalk.cyan('Tech Stack:'));
  console.log(`  Language:    ${chalk.white(stack.language)}${stack.languageVersion ? ` (${stack.languageVersion})` : ''}`);
  console.log(`  Framework:   ${chalk.white(stack.framework)}${stack.frameworkVersion ? ` (${stack.frameworkVersion})` : ''}`);
  console.log(`  Testing:     ${chalk.white(stack.testFramework)}`);
  console.log(`  Package Mgr: ${chalk.white(stack.packageManager)}`);

  if (stack.styling) {
    console.log(`  Styling:     ${chalk.white(stack.styling)}`);
  }
  if (stack.additionalTools.length > 0) {
    console.log(`  Tools:       ${chalk.white(stack.additionalTools.join(', '))}`);
  }

  // Structure
  console.log(chalk.cyan('\nProject Structure:'));
  console.log(`  Type:        ${chalk.white(patterns.structure.type)}`);
  console.log(`  Source:      ${chalk.white(patterns.structure.sourceDir + '/')}`);
  if (patterns.structure.keyDirectories.length > 0) {
    console.log(`  Key dirs:    ${chalk.white(patterns.structure.keyDirectories.map(d => d.path).join(', '))}`);
  }

  // Confidence
  const confidenceColor = confidence.overall > 0.7 ? chalk.green :
                          confidence.overall > 0.4 ? chalk.yellow : chalk.red;
  console.log(chalk.cyan('\nConfidence:'));
  console.log(`  Overall:     ${confidenceColor(Math.round(confidence.overall * 100) + '%')}`);
}

// ============================================
// CLI Setup
// ============================================

const program = new Command();

program
  .name('proteus')
  .description('🔱 Shape-shifting project intelligence - Generate project-specific agents')
  .version(VERSION);

// Transform command (default)
program
  .command('transform', { isDefault: true })
  .description('Analyze project and generate specialized agents')
  .option('-o, --output <dir>', 'Output directory for agents', '.agents')
  .option('-a, --agents <types...>', 'Agent types to generate (code-reviewer, test-writer, refactorer, docs-writer)')
  .option('-d, --dry-run', 'Preview without saving', false)
  .option('-f, --force', 'Overwrite existing files without confirmation', false)
  .option('-i, --interactive', 'Interactive mode with confirmations', true)
  .option('--include-claude-md', 'Also generate CLAUDE.md if not exists', false)
  .action(async (opts) => {
    try {
      await runTransform({
        agents: (opts.agents || []) as AgentType[],
        outputDir: opts.output,
        dryRun: opts.dryRun,
        force: opts.force,
        interactive: opts.interactive,
        includeClaudeMd: opts.includeClaudeMd,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Init command (legacy - CLAUDE.md only)
program
  .command('init')
  .description('Generate CLAUDE.md only (legacy)')
  .option('-o, --output <path>', 'Output file path', 'CLAUDE.md')
  .option('-t, --template <type>', 'Template type (minimal|full)', 'full')
  .option('-d, --dry-run', 'Preview without saving', false)
  .option('-i, --interactive', 'Interactive mode with confirmations', true)
  .option('-f, --force', 'Overwrite existing file without confirmation', false)
  .action(async (opts) => {
    try {
      await runInit(opts as CLIOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List available agent types')
  .action(() => {
    console.log(LOGO);
    console.log(chalk.bold('Available Agent Types:\n'));
    console.log(`  ${chalk.cyan('code-reviewer')}   - コードレビュー専門`);
    console.log(`  ${chalk.cyan('test-writer')}     - テスト作成専門`);
    console.log(`  ${chalk.cyan('refactorer')}      - リファクタリング専門`);
    console.log(`  ${chalk.cyan('docs-writer')}     - ドキュメント作成専門`);
    console.log('');
    console.log(chalk.gray('Usage: proteus transform -a code-reviewer test-writer'));
  });

program.parse();
