import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, '..');

// Calling npm through Node, rather than as a command, works the same on every platform, where Windows would need npm.cmd.
const npmCli = process.env.npm_execpath;

const libraryCheck = `
  import { compileEmailTemplate } from 'inline-email';
  const compiled = await compileEmailTemplate({ subject: 'Hi {{name}}', html: '<p class="m">Hi {{name}}</p>', css: '.m { color: #246bfe; }' });
  process.stdout.write(compiled.render({ data: { name: 'Ada' } }).html);
`;

const missingInkyMessage = "responsive: 'inky' needs the inky package. Install it with npm install inky.";

const missingInkyCheck = `
  import { compileEmailTemplate } from 'inline-email';
  try {
    await compileEmailTemplate({ html: '<container>Hi</container>', responsive: 'inky' });
    process.stdout.write('The compile resolved.');
  } catch (error) {
    process.stdout.write(error.message);
  }
`;

function runNpm(npmArguments, workingDir) {
  return execFileSync(process.execPath, [npmCli, ...npmArguments], { cwd: workingDir, encoding: 'utf8' });
}

function packPackage(packDir) {
  runNpm(['pack', '--pack-destination', packDir], rootDir);
  const tarball = readdirSync(packDir).find((file) => file.endsWith('.tgz'));
  return join(packDir, tarball);
}

function installPackage(tarball, projectDir) {
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'inline-email-package-check', private: true }));
  runNpm(['install', '--no-audit', '--no-fund', tarball], projectDir);
}

function checkLibrary(projectDir) {
  const html = execFileSync(process.execPath, ['--input-type=module', '--eval', libraryCheck], { cwd: projectDir, encoding: 'utf8' });
  if (!html.includes('style="color: #246bfe;"')) {
    throw new Error(`The installed library did not inline the CSS. It rendered:\n${html}`);
  }
}

function checkCli(projectDir) {
  writeFileSync(join(projectDir, 'email.html'), '<p>Hello {{name}}</p>');
  writeFileSync(join(projectDir, 'data.json'), '{"name":"Ada"}');
  const output = runNpm(['exec', '--no', '--', 'inline-email', 'email.html', '--data', 'data.json', '--strict'], projectDir);
  if (!output.includes('Hello Ada')) {
    throw new Error(`The installed CLI did not render the template. It printed:\n${output}`);
  }
}

function checkMissingInky(projectDir) {
  const message = execFileSync(process.execPath, ['--input-type=module', '--eval', missingInkyCheck], { cwd: projectDir, encoding: 'utf8' });
  if (message !== missingInkyMessage) {
    throw new Error(`responsive: 'inky' without Inky installed did not reject with the install message. It gave:\n${message}`);
  }
}

function main() {
  if (npmCli === undefined) {
    console.error('Run this check through npm: npm run test:package');
    process.exit(1);
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'inline-email-package-'));
  const packDir = join(tempDir, 'pack');
  const projectDir = join(tempDir, 'project');
  mkdirSync(packDir);
  mkdirSync(projectDir);

  try {
    const tarball = packPackage(packDir);
    installPackage(tarball, projectDir);
    checkLibrary(projectDir);
    checkCli(projectDir);
    checkMissingInky(projectDir);
    console.log('The packed package installs without Inky, its library and CLI both run, and responsive: \'inky\' asks for Inky.');
  } catch (error) {
    console.error(`Packed package check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
