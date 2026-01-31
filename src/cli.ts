#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

import { detectStack } from './detectors/stack.js';
import { detectPatterns } from './detectors/patterns.js';
import { detectCommands } from './detectors/commands.js';
import { generateClaudeMd } from './generator.js';
import type { AnalysisResult, CLIOptions, GeneratorOptions } from './types.js';

const VERSION = '0.1.0';

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
// CLI Commands
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
          { title: 'Show diff (update)', value: 'diff' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (action === 'cancel') {
        console.log(chalk.gray('Cancelled'));
        return;
      }

      if (action === 'diff') {
        // TODO: Implement diff view
        console.log(chalk.gray('Diff view coming soon. Use --force to overwrite.'));
        return;
      }
    } else {
      console.log(chalk.gray('Use --force to overwrite, or run `proteus update` to see changes'));
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

  // Print next steps
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray('  1. Review and customize CLAUDE.md'));
  console.log(chalk.gray('  2. Add project-specific rules'));
  console.log(chalk.gray('  3. Run `proteus update` after major changes'));
}

async function runUpdate(options: CLIOptions) {
  console.log(LOGO);
  
  const cwd = process.cwd();
  const claudeMdPath = path.join(cwd, options.output || 'CLAUDE.md');

  // Check if CLAUDE.md exists
  try {
    await fs.access(claudeMdPath);
  } catch {
    console.log(chalk.yellow('⚠️  No CLAUDE.md found. Run `proteus` to create one.'));
    return;
  }

  console.log(chalk.gray(`\nRe-analyzing ${cwd}...\n`));
  
  const result = await analyze(cwd);
  printSummary(result);

  // TODO: Implement diff and merge logic
  console.log(chalk.gray('\nDiff and merge coming soon!'));
  console.log(chalk.gray('For now, use `proteus --force` to regenerate.'));
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
  .description('Auto-generate CLAUDE.md by analyzing your project')
  .version(VERSION);

program
  .command('init', { isDefault: true })
  .description('Analyze project and generate CLAUDE.md')
  .option('-o, --output <path>', 'Output file path', 'CLAUDE.md')
  .option('-t, --template <type>', 'Template type (minimal|full)', 'full')
  .option('-d, --dry-run', 'Preview without saving', false)
  .option('-i, --interactive', 'Interactive mode with confirmations', true)
  .option('-f, --force', 'Overwrite existing file without confirmation', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    try {
      await runInit(opts as CLIOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update existing CLAUDE.md with detected changes')
  .option('-o, --output <path>', 'Output file path', 'CLAUDE.md')
  .option('-d, --dry-run', 'Preview without saving', false)
  .action(async (opts) => {
    try {
      await runUpdate(opts as CLIOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
