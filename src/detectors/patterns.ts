import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { 
  CodePatterns, 
  NamingConvention, 
  NamingPatterns, 
  DirectoryStructure,
  TechStack 
} from './types.js';

// ============================================
// Naming Convention Detection
// ============================================

function detectNamingConvention(samples: string[]): NamingConvention {
  if (samples.length === 0) return 'mixed';

  const patterns = {
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
    PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
    snake_case: /^[a-z][a-z0-9_]*$/,
    'kebab-case': /^[a-z][a-z0-9-]*$/,
    SCREAMING_SNAKE_CASE: /^[A-Z][A-Z0-9_]*$/,
  };

  const counts: Record<NamingConvention, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    'kebab-case': 0,
    SCREAMING_SNAKE_CASE: 0,
    mixed: 0,
  };

  for (const sample of samples) {
    const name = path.basename(sample).replace(/\.[^.]+$/, ''); // Remove extension
    let matched = false;
    
    for (const [convention, regex] of Object.entries(patterns)) {
      if (regex.test(name)) {
        counts[convention as NamingConvention]++;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      counts.mixed++;
    }
  }

  // Find dominant convention
  let maxCount = 0;
  let dominant: NamingConvention = 'mixed';
  
  for (const [convention, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = convention as NamingConvention;
    }
  }

  // If no clear winner (less than 60%), return mixed
  if (maxCount < samples.length * 0.6) {
    return 'mixed';
  }

  return dominant;
}

// ============================================
// Naming Patterns Detection
// ============================================

async function detectNamingPatterns(cwd: string, stack: TechStack): Promise<NamingPatterns> {
  const patterns: NamingPatterns = {
    files: {},
    code: {
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'SCREAMING_SNAKE_CASE',
    },
  };

  // Detect file naming patterns based on language/framework
  if (stack.language === 'typescript' || stack.language === 'javascript') {
    // Component files
    const componentFiles = await fg(['**/components/**/*.{tsx,jsx}', '**/Components/**/*.{tsx,jsx}'], {
      cwd,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });
    
    if (componentFiles.length > 0) {
      patterns.files.components = detectNamingConvention(componentFiles);
      patterns.code.components = 'PascalCase'; // React convention
    }

    // Utility files
    const utilFiles = await fg(['**/utils/**/*.{ts,js}', '**/lib/**/*.{ts,js}', '**/helpers/**/*.{ts,js}'], {
      cwd,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });
    
    if (utilFiles.length > 0) {
      patterns.files.utilities = detectNamingConvention(utilFiles);
    }

    // Test files
    const testFiles = await fg(['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'], {
      cwd,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });
    
    if (testFiles.length > 0) {
      const hasSpec = testFiles.some(f => f.includes('.spec.'));
      const hasTest = testFiles.some(f => f.includes('.test.'));
      patterns.files.tests = hasSpec && !hasTest ? '*.spec.ts' : '*.test.ts';
    }

    // TypeScript specific
    if (stack.language === 'typescript') {
      patterns.code.types = 'PascalCase';
    }
  }

  // Go naming conventions
  if (stack.language === 'go') {
    patterns.code.functions = 'camelCase'; // unexported: camelCase, exported: PascalCase
    patterns.code.variables = 'camelCase';
    patterns.code.constants = 'PascalCase'; // Go uses PascalCase for exported constants
    patterns.files.utilities = 'snake_case';
  }

  // Python naming conventions
  if (stack.language === 'python') {
    patterns.code.functions = 'snake_case';
    patterns.code.variables = 'snake_case';
    patterns.code.constants = 'SCREAMING_SNAKE_CASE';
    patterns.files.utilities = 'snake_case';
  }

  return patterns;
}

// ============================================
// Directory Structure Detection
// ============================================

async function detectDirectoryStructure(cwd: string, stack: TechStack): Promise<DirectoryStructure> {
  const structure: DirectoryStructure = {
    type: 'unknown',
    sourceDir: '.',
    keyDirectories: [],
  };

  // Detect source directory
  const sourceDirs = ['src', 'app', 'lib', 'pkg', 'internal', 'cmd'];
  for (const dir of sourceDirs) {
    try {
      const stat = await fs.stat(path.join(cwd, dir));
      if (stat.isDirectory()) {
        structure.sourceDir = dir;
        break;
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Detect test directory
  const testDirs = ['test', 'tests', '__tests__', 'spec'];
  for (const dir of testDirs) {
    try {
      const stat = await fs.stat(path.join(cwd, dir));
      if (stat.isDirectory()) {
        structure.testDir = dir;
        break;
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Analyze structure type
  const dirs = await fg(['**/'], {
    cwd: path.join(cwd, structure.sourceDir),
    onlyDirectories: true,
    deep: 2,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  // Check for common patterns
  const hasComponents = dirs.some(d => d.includes('components'));
  const hasFeatures = dirs.some(d => d.includes('features'));
  const hasModules = dirs.some(d => d.includes('modules'));
  const hasServices = dirs.some(d => d.includes('services'));
  const hasControllers = dirs.some(d => d.includes('controllers'));
  const hasRepositories = dirs.some(d => d.includes('repositories'));
  const hasHandlers = dirs.some(d => d.includes('handlers'));

  // Determine structure type
  if (hasFeatures || hasModules) {
    structure.type = 'feature-based';
  } else if ((hasControllers || hasHandlers) && (hasServices || hasRepositories)) {
    structure.type = 'layer-based';
  } else if (hasComponents && !hasServices) {
    structure.type = 'flat';
  } else if (hasComponents && hasServices) {
    structure.type = 'hybrid';
  }

  // Detect key directories with purposes
  const keyDirPatterns: Array<{ pattern: string; purpose: string }> = [
    { pattern: 'components', purpose: 'UI Components' },
    { pattern: 'features', purpose: 'Feature modules' },
    { pattern: 'services', purpose: 'Business logic' },
    { pattern: 'hooks', purpose: 'Custom React hooks' },
    { pattern: 'utils', purpose: 'Utility functions' },
    { pattern: 'lib', purpose: 'Library code' },
    { pattern: 'api', purpose: 'API routes/handlers' },
    { pattern: 'pages', purpose: 'Page components (Pages Router)' },
    { pattern: 'app', purpose: 'App Router pages' },
    { pattern: 'controllers', purpose: 'Request handlers' },
    { pattern: 'models', purpose: 'Data models' },
    { pattern: 'repositories', purpose: 'Data access layer' },
    { pattern: 'handlers', purpose: 'HTTP handlers' },
    { pattern: 'middleware', purpose: 'Middleware functions' },
    { pattern: 'types', purpose: 'Type definitions' },
    { pattern: 'config', purpose: 'Configuration' },
    { pattern: 'constants', purpose: 'Constants and enums' },
  ];

  for (const { pattern, purpose } of keyDirPatterns) {
    const matches = dirs.filter(d => d.includes(pattern));
    if (matches.length > 0) {
      structure.keyDirectories.push({
        path: matches[0],
        purpose,
      });
    }
  }

  return structure;
}

// ============================================
// Additional Pattern Detection
// ============================================

async function detectAdditionalPatterns(cwd: string, stack: TechStack): Promise<Partial<CodePatterns>> {
  const additional: Partial<CodePatterns> = {};

  if (stack.language === 'typescript' || stack.language === 'javascript') {
    // Check tsconfig for path aliases
    try {
      const tsconfig = await fs.readFile(path.join(cwd, 'tsconfig.json'), 'utf-8');
      const config = JSON.parse(tsconfig);
      
      if (config.compilerOptions?.paths) {
        additional.imports = {
          style: 'absolute',
          aliases: config.compilerOptions.paths,
        };
      } else if (config.compilerOptions?.baseUrl) {
        additional.imports = { style: 'absolute' };
      } else {
        additional.imports = { style: 'relative' };
      }
    } catch {
      additional.imports = { style: 'relative' };
    }

    // Detect export style by sampling files
    const sampleFiles = await fg(['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'], {
      cwd,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });

    let defaultExports = 0;
    let namedExports = 0;

    for (const file of sampleFiles.slice(0, 10)) {
      try {
        const content = await fs.readFile(path.join(cwd, file), 'utf-8');
        if (content.includes('export default')) defaultExports++;
        if (content.match(/export\s+(const|function|class|interface|type)\s+/)) namedExports++;
      } catch {
        // Skip unreadable files
      }
    }

    if (defaultExports > namedExports * 2) {
      additional.exports = { style: 'default' };
    } else if (namedExports > defaultExports * 2) {
      additional.exports = { style: 'named' };
    } else {
      additional.exports = { style: 'mixed' };
    }
  }

  return additional;
}

// ============================================
// Main Pattern Detection Function
// ============================================

export async function detectPatterns(cwd: string, stack: TechStack): Promise<CodePatterns> {
  const naming = await detectNamingPatterns(cwd, stack);
  const structure = await detectDirectoryStructure(cwd, stack);
  const additional = await detectAdditionalPatterns(cwd, stack);

  return {
    naming,
    structure,
    ...additional,
  };
}
