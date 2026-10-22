import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, '..');

const testFilesByModule = {
  cli: ['test/cli.test.ts'],
  compile: ['test/compile.test.ts'],
  engine: ['test/engine.test.ts', 'test/template.test.ts'],
  template: ['test/template.test.ts'],
  layout: ['test/layout.test.ts'],
  style: ['test/style.test.ts']
};

function moduleNameFromArgument(argument) {
  if (argument === undefined) {
    return '';
  }
  const withoutFolder = argument.replace(/^src\//, '');
  return withoutFolder.replace(/\.ts$/, '');
}

const moduleName = moduleNameFromArgument(process.argv[2]);

if (!Object.hasOwn(testFilesByModule, moduleName)) {
  console.error(`Usage: npm run coverage:module -- <module>, where <module> is one of: ${Object.keys(testFilesByModule).join(', ')}`);
  process.exit(1);
}

const testFiles = testFilesByModule[moduleName];

const result = spawnSync(
  process.execPath,
  [
    join(rootDir, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    ...testFiles,
    `--coverage.include=src/${moduleName}.ts`,
    '--coverage.reporter=text',
    '--coverage.thresholds.lines=0',
    '--coverage.thresholds.branches=0'
  ],
  { cwd: rootDir, stdio: 'inherit' }
);

process.exit(result.status ?? 1);
