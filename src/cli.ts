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
import { suggestAgents, generateAgent, type AgentSuggestion, type GeneratedAgent } from './agent-generator.js';
import { isClaudeAvailable, type OutputLanguage } from './claude-bridge.js';
import { updateAgentRegistry, scanExistingAgents } from './agent-registry.js';
import { generateProteusSkill, saveProteusSkill } from './skill-generator.js';

const REASON_LABEL: Record<OutputLanguage, string> = {
  en: 'Reason',
  ja: '理由',
  zh: '原因',
  ko: '이유',
  es: 'Razón',
  fr: 'Raison',
  de: 'Grund',
};
import type { AnalysisResult, CLIOptions, GeneratorOptions } from './types.js';

// Read version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
const VERSION = pkg.version;

// ============================================
// Types
// ============================================

interface TransformOptions {
  outputDir?: string;
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  includeClaudeMd: boolean;
  verbose: boolean;
  lang?: OutputLanguage;
}

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

  // Check Claude Code availability
  const claudeAvailable = isClaudeAvailable();
  if (claudeAvailable) {
    console.log(chalk.green('✓ Claude Code detected - using AI-powered generation\n'));
  } else {
    console.log(chalk.yellow('⚠ Claude Code not found - using fallback templates\n'));
    console.log(chalk.gray('  Install Claude Code for better results: https://claude.ai/code\n'));
  }

  // Ask for output language
  let lang: OutputLanguage = options.lang || 'en';
  if (!options.lang && options.interactive && !options.force) {
    const { selectedLang } = await prompts({
      type: 'select',
      name: 'selectedLang',
      message: 'Output language for generated files?',
      choices: [
        { title: 'English', value: 'en' },
        { title: '日本語 (Japanese)', value: 'ja' },
        { title: '中文 (Chinese)', value: 'zh' },
        { title: '한국어 (Korean)', value: 'ko' },
        { title: 'Español (Spanish)', value: 'es' },
        { title: 'Français (French)', value: 'fr' },
        { title: 'Deutsch (German)', value: 'de' },
      ],
      initial: 0,
    });
    lang = selectedLang || 'en';
  }

  console.log(chalk.gray(`\nAnalyzing ${cwd}...\n`));

  // Step 1: Analyze project
  const analysis = await analyze(cwd);

  // Step 2: Detect existing documents
  const spinner = ora('Reading existing documents...').start();
  let docs = await detectProjectDocuments(cwd);

  if (docs.claudeMd) {
    spinner.succeed(`Found CLAUDE.md with ${docs.claudeMd.rules.length} rules`);
  } else {
    spinner.succeed('No existing CLAUDE.md found');
  }

  // Show existing agents and skills
  const existingAgentCount = docs.existingAgents.filter(a => a.type === 'agent').length;
  const existingSkillCount = docs.existingAgents.filter(a => a.type === 'skill').length;

  if (existingAgentCount > 0 && docs.agentDirectory) {
    console.log(chalk.gray(`  Found ${existingAgentCount} existing agent(s) in ${docs.agentDirectory}/`));
  }
  if (existingSkillCount > 0 && docs.skillDirectory) {
    console.log(chalk.gray(`  Found ${existingSkillCount} existing skill(s) in ${docs.skillDirectory}/`));
  }

  // Print summary
  printSummary(analysis);

  // Step 3: Generate CLAUDE.md first if it doesn't exist
  if (!docs.claudeMd) {
    let shouldGenerateClaudeMd = options.includeClaudeMd;

    if (!shouldGenerateClaudeMd && options.interactive && !options.force) {
      const { generateClaudeMd: userChoice } = await prompts({
        type: 'confirm',
        name: 'generateClaudeMd',
        message: 'No CLAUDE.md found. Generate one first? (Recommended for better agent generation)',
        initial: true,
      });
      shouldGenerateClaudeMd = userChoice;
    }

    if (shouldGenerateClaudeMd) {
      console.log(chalk.cyan('\n📄 Generating CLAUDE.md...\n'));
      const generatorOptions: GeneratorOptions = {
        template: 'full',
        includeExamples: true,
        includeComments: true,
        version: VERSION,
      };
      const claudeContent = generateClaudeMd(analysis, { ...generatorOptions, documents: docs, verbose: options.verbose, lang });
      await fs.writeFile(path.join(cwd, 'CLAUDE.md'), claudeContent);
      console.log(chalk.green('✅ Created CLAUDE.md\n'));

      // Re-read documents to include the new CLAUDE.md
      docs = await detectProjectDocuments(cwd);
    }
  }

  // Step 4: Get agent suggestions from Claude Code
  console.log(chalk.cyan('\n🤖 Generating agent suggestions...\n'));

  const suggestions = suggestAgents(analysis, docs, { verbose: options.verbose, lang });

  // Handle case where no new agents are needed
  if (suggestions.length === 0) {
    if (existingAgentCount > 0) {
      console.log(chalk.green(`✓ Project already has ${existingAgentCount} agent(s) with good coverage.`));
      console.log(chalk.gray('  No additional agents recommended.\n'));

      // Still offer to generate proteus skill if agents exist
      if (options.interactive && !options.force) {
        const { generateSkillOnly } = await prompts({
          type: 'confirm',
          name: 'generateSkillOnly',
          message: 'Generate /proteus skill to use existing agents?',
          initial: true,
        });

        if (generateSkillOnly) {
          const skillSpinner = ora('Generating proteus skill...').start();
          try {
            const existingAgentsForSkill = docs.existingAgents.filter(a => a.type === 'agent');
            const skill = generateProteusSkill({
              projectName: analysis.projectName,
              agents: existingAgentsForSkill,
              lang,
              outputDir: '.claude/skills',
            });
            saveProteusSkill(skill, cwd);
            skillSpinner.succeed('Created .claude/skills/proteus/SKILL.md');
          } catch (error) {
            skillSpinner.fail('Failed to generate proteus skill');
          }
        }
      }
      return;
    } else {
      console.log(chalk.yellow('No agent suggestions available. Try running with --verbose for details.'));
      return;
    }
  }

  // Step 4b: Check for duplicates with existing agents
  const existingAgentNames = docs.existingAgents.filter(a => a.type === 'agent').map(a => a.name);
  const duplicates = suggestions.filter(s => existingAgentNames.includes(s.name));

  if (duplicates.length > 0) {
    console.log(chalk.yellow(`⚠ Warning: ${duplicates.length} suggested agent(s) already exist:`));
    for (const d of duplicates) {
      console.log(chalk.yellow(`  - ${d.name}`));
    }
    console.log('');
  }

  // Step 5: Interactive selection
  let selectedSuggestions: AgentSuggestion[];
  const reasonLabel = REASON_LABEL[lang];

  if (options.interactive && !options.force) {
    console.log(chalk.bold('Recommended agents for this project:\n'));

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const isDuplicate = existingAgentNames.includes(s.name);
      const nameDisplay = isDuplicate
        ? `${chalk.bold(s.name)} ${chalk.yellow('(exists)')}`
        : chalk.bold(s.name);

      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${nameDisplay}`);
      console.log(`     ${chalk.white(s.description)}`);
      console.log(`     ${chalk.gray(`${reasonLabel}: ${s.reason}`)}`);
      console.log('');
    }

    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Select agents to generate',
      choices: suggestions.map((s, i) => {
        const isDuplicate = existingAgentNames.includes(s.name);
        return {
          title: isDuplicate
            ? `${s.name} (overwrite) - ${s.description}`
            : `${s.name} - ${s.description}`,
          value: i,
          selected: !isDuplicate, // Don't select duplicates by default
        };
      }),
      hint: '- Space to toggle, Enter to confirm',
    });

    if (!selected || selected.length === 0) {
      console.log(chalk.gray('No agents selected. Cancelled.'));
      return;
    }

    selectedSuggestions = selected.map((i: number) => suggestions[i]);

    // Confirm overwrite for duplicates
    const selectedDuplicates = selectedSuggestions.filter(s => existingAgentNames.includes(s.name));
    if (selectedDuplicates.length > 0) {
      const { confirmOverwrite } = await prompts({
        type: 'confirm',
        name: 'confirmOverwrite',
        message: `Overwrite ${selectedDuplicates.length} existing agent(s)?`,
        initial: false,
      });

      if (!confirmOverwrite) {
        selectedSuggestions = selectedSuggestions.filter(s => !existingAgentNames.includes(s.name));
        if (selectedSuggestions.length === 0) {
          console.log(chalk.gray('No new agents to generate. Cancelled.'));
          return;
        }
      }
    }
  } else {
    // Non-interactive: use all suggestions (skip duplicates unless --force)
    selectedSuggestions = options.force
      ? suggestions
      : suggestions.filter(s => !existingAgentNames.includes(s.name));

    if (selectedSuggestions.length === 0) {
      console.log(chalk.yellow('All suggested agents already exist. Use --force to overwrite.'));
      return;
    }

    console.log(chalk.cyan('Agents to generate:'));
    for (const s of selectedSuggestions) {
      console.log(`  - ${chalk.white(s.name)}: ${s.description}`);
    }
  }

  // Step 5: Determine output directory (always .claude/agents for agents)
  const outputDir = options.outputDir || '.claude/agents';
  console.log(chalk.gray(`\nOutput directory: ${outputDir}/`));

  // Step 6: Generate agents with progress
  console.log(chalk.cyan('\n🔱 Generating agents...\n'));

  const agents: GeneratedAgent[] = [];
  const total = selectedSuggestions.length;

  for (let i = 0; i < total; i++) {
    const suggestion = selectedSuggestions[i];
    const progress = `[${i + 1}/${total}]`;
    const agentSpinner = ora(`${progress} Generating ${chalk.cyan(suggestion.name)}...`).start();

    try {
      const agent = generateAgent(suggestion, analysis, docs, {
        outputDir,
        verbose: false, // Suppress verbose output during spinner
        lang,
      });
      agents.push(agent);
      agentSpinner.succeed(`${progress} ${chalk.cyan(suggestion.name)} generated`);
    } catch (error) {
      agentSpinner.fail(`${progress} Failed to generate ${suggestion.name}`);
      if (options.verbose && error instanceof Error) {
        console.warn(chalk.gray(`  ${error.message}`));
      }
    }
  }

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

  // Confirmation
  if (options.interactive && !options.force) {
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
    const filePath = path.join(fullOutputDir, `${agent.name}.md`);
    await fs.writeFile(filePath, agent.content);
    console.log(chalk.green(`✅ Created ${outputDir}/${agent.name}.md`));
  }

  // Step 7: Prompt to update agent registry
  let registryUpdated = false;
  if (options.interactive && !options.force) {
    const { updateRegistry } = await prompts({
      type: 'confirm',
      name: 'updateRegistry',
      message: 'Update agent list in CLAUDE.md or agents.md?',
      initial: true,
    });

    if (updateRegistry) {
      const registrySpinner = ora('Updating agent registry...').start();
      try {
        const result = updateAgentRegistry({
          projectPath: cwd,
          agentDir: outputDir,
          lang,
        }, selectedSuggestions);

        if (result) {
          registrySpinner.succeed(`Agent list ${result.action} in ${result.file} (${result.agentCount} agents)`);
          registryUpdated = true;
        } else {
          registrySpinner.warn('Could not update agent registry');
        }
      } catch (error) {
        registrySpinner.fail('Failed to update agent registry');
        if (options.verbose && error instanceof Error) {
          console.warn(chalk.gray(`  ${error.message}`));
        }
      }
    }
  }

  // Step 8: Prompt to generate proteus skill (agent router)
  let skillGenerated = false;
  if (options.interactive && !options.force) {
    const { generateSkill } = await prompts({
      type: 'confirm',
      name: 'generateSkill',
      message: 'Generate /proteus skill to easily use these agents?',
      initial: true,
    });

    if (generateSkill) {
      const skillSpinner = ora('Generating proteus skill...').start();
      try {
        // Re-scan agents to include newly created ones
        const allAgents = scanExistingAgents(fullOutputDir);

        const skill = generateProteusSkill({
          projectName: analysis.projectName,
          agents: allAgents.map(a => ({ ...a, type: 'agent' as const, path: a.path, content: '' })),
          lang,
          outputDir: '.claude/skills',
        });

        // Read actual content for each agent
        const agentsWithContent = await Promise.all(
          allAgents.map(async (a) => {
            const content = await fs.readFile(path.join(fullOutputDir, a.path), 'utf-8');
            return { ...a, type: 'agent' as const, content };
          })
        );

        const skillWithContent = generateProteusSkill({
          projectName: analysis.projectName,
          agents: agentsWithContent,
          lang,
          outputDir: '.claude/skills',
        });

        saveProteusSkill(skillWithContent, cwd);
        skillSpinner.succeed(`Created .claude/skills/proteus/SKILL.md`);
        skillGenerated = true;
      } catch (error) {
        skillSpinner.fail('Failed to generate proteus skill');
        if (options.verbose && error instanceof Error) {
          console.warn(chalk.gray(`  ${error.message}`));
        }
      }
    }
  }

  // Print next steps
  console.log(chalk.gray('\n🔱 Transformation complete!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray(`  1. Review agents in ${outputDir}/`));
  if (skillGenerated) {
    console.log(chalk.gray('  2. Use /proteus to route tasks to the right agent'));
  }
  console.log(chalk.gray(`  ${skillGenerated ? '3' : '2'}. Customize based on your needs`));
  if (!registryUpdated) {
    console.log(chalk.gray(`  ${skillGenerated ? '4' : '3'}. Run \`proteus registry\` to update agent list in docs`));
  }
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
          dryRun: options.dryRun,
          force: options.force,
          interactive: options.interactive,
          includeClaudeMd: false,
          verbose: false,
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
  const docs = await detectProjectDocuments(cwd);

  // Print summary
  printSummary(result);

  // Generate CLAUDE.md
  const generatorOptions: GeneratorOptions = {
    template: options.template,
    includeExamples: true,
    includeComments: true,
    version: VERSION,
  };

  const content = generateClaudeMd(result, { ...generatorOptions, documents: docs });

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
  console.log(chalk.gray('\nTip: Run `proteus` to generate project-specific agents!'));
}

function printSummary(result: AnalysisResult) {
  const { stack, patterns, confidence } = result;

  console.log(chalk.bold('\n📊 Analysis Summary\n'));

  // Monorepo info
  if (stack.monorepo) {
    console.log(chalk.cyan('📦 Monorepo:'));
    console.log(`  Type:        ${chalk.white(stack.monorepo.type)}`);
    console.log(`  Workspaces:  ${chalk.white(stack.monorepo.workspaces.join(', '))}`);
    console.log('');
  }

  // Multiple stacks
  if (stack.stacks.length > 1) {
    console.log(chalk.cyan('Tech Stacks:'));
    for (const s of stack.stacks) {
      const location = s.name ? `${s.name} (${s.path})` : s.path || '.';
      const fw = s.framework !== 'unknown' ? ` + ${s.framework}` : '';
      console.log(`  ${chalk.white(location)}: ${chalk.yellow(s.language)}${fw}`);
    }
    console.log('');
    console.log(chalk.cyan('Languages:   ') + chalk.white(stack.allLanguages.join(', ')));
    console.log(chalk.cyan('Frameworks:  ') + chalk.white(stack.allFrameworks.filter(f => f !== 'unknown').join(', ') || 'none'));
  } else {
    // Single stack (original display)
    console.log(chalk.cyan('Tech Stack:'));
    console.log(`  Language:    ${chalk.white(stack.language)}${stack.languageVersion ? ` (${stack.languageVersion})` : ''}`);
    console.log(`  Framework:   ${chalk.white(stack.framework)}${stack.frameworkVersion ? ` (${stack.frameworkVersion})` : ''}`);
    console.log(`  Testing:     ${chalk.white(stack.testFramework)}`);
    console.log(`  Package Mgr: ${chalk.white(stack.packageManager)}`);
  }

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
  .description('Analyze project and generate specialized agents (powered by Claude Code)')
  .option('-o, --output <dir>', 'Output directory for agents')
  .option('-l, --lang <code>', 'Output language (en, ja, zh, ko, es, fr, de)')
  .option('-d, --dry-run', 'Preview without saving', false)
  .option('-f, --force', 'Skip confirmations', false)
  .option('-i, --interactive', 'Interactive mode with confirmations', true)
  .option('--include-claude-md', 'Also generate CLAUDE.md if not exists', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    try {
      await runTransform({
        outputDir: opts.output,
        dryRun: opts.dryRun,
        force: opts.force,
        interactive: opts.interactive,
        includeClaudeMd: opts.includeClaudeMd,
        verbose: opts.verbose,
        lang: opts.lang as OutputLanguage | undefined,
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

// Analyze command (just show analysis without generating)
program
  .command('analyze')
  .description('Analyze project without generating anything')
  .action(async () => {
    try {
      console.log(LOGO);
      const cwd = process.cwd();
      console.log(chalk.gray(`Analyzing ${cwd}...\n`));
      const result = await analyze(cwd);
      const docs = await detectProjectDocuments(cwd);

      printSummary(result);

      if (docs.claudeMd) {
        console.log(chalk.cyan('\nExisting CLAUDE.md:'));
        console.log(`  Rules:       ${docs.claudeMd.rules.length}`);
        console.log(`  Conventions: ${docs.claudeMd.conventions.length}`);
      }

      if (docs.existingAgents.length > 0) {
        console.log(chalk.cyan('\nExisting Agents:'));
        for (const agent of docs.existingAgents) {
          console.log(`  - ${agent.name}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Registry command (update agent list in CLAUDE.md or agents.md)
program
  .command('registry')
  .description('Update agent list in CLAUDE.md or agents.md')
  .option('-a, --agent-dir <dir>', 'Agent directory', '.claude/agents')
  .option('-f, --format <type>', 'Output format (table|list)', 'table')
  .option('-l, --lang <code>', 'Output language (en, ja, zh, ko, es, fr, de)', 'en')
  .option('--dry-run', 'Preview without saving', false)
  .action(async (opts) => {
    try {
      console.log(LOGO);
      const cwd = process.cwd();

      // Scan existing agents
      const agentDir = opts.agentDir || '.claude/agents';
      const fullAgentDir = path.join(cwd, agentDir);

      const spinner = ora('Scanning agents...').start();
      const agents = scanExistingAgents(fullAgentDir);

      if (agents.length === 0) {
        spinner.warn(`No agents found in ${agentDir}/`);
        console.log(chalk.gray('\nRun `proteus` to generate agents first.'));
        return;
      }

      spinner.succeed(`Found ${agents.length} agent(s)`);

      // List agents
      console.log(chalk.cyan('\nAgents found:'));
      for (const agent of agents) {
        console.log(`  - ${chalk.white(agent.name)}`);
        if (agent.description) {
          console.log(`    ${chalk.gray(agent.description)}`);
        }
      }

      if (opts.dryRun) {
        console.log(chalk.gray('\n--- Preview (dry run) ---'));
        const { generateAgentListSection } = await import('./agent-registry.js');
        console.log(generateAgentListSection(agents, agentDir, opts.format, opts.lang));
        return;
      }

      // Update registry
      const updateSpinner = ora('Updating registry...').start();
      const result = updateAgentRegistry({
        projectPath: cwd,
        agentDir,
        format: opts.format,
        lang: opts.lang,
      });

      if (result) {
        updateSpinner.succeed(`Agent list ${result.action} in ${result.file} (${result.agentCount} agents)`);
      } else {
        updateSpinner.fail('Failed to update registry');
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
