import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileEmailTemplate } from 'inline-email';
import { main } from '../src/cli.ts';
import { captureConsole } from './support/console.ts';
import { expectNoPlaceholdersOrLayoutTags } from './support/leaks.ts';
import { makeTempDir } from './support/temp-dir.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const guidesDir = join(rootDir, 'examples', 'guides');

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// The scripts import 'inline-email', which resolves by package self-reference to dist/, so the suite needs a build first.
function runScript<T>(guide: string): T {
  const stdout = execFileSync(process.execPath, [join(guidesDir, guide, 'send.mjs')], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  return JSON.parse(stdout) as T;
}

const runGuide = (guide: string) => runScript<RenderedEmail>(guide);
const runTransactional = () => runScript<RenderedEmail[]>('transactional');

async function runCli(args: string[]): Promise<string> {
  const log = captureConsole('log');
  await main(args);
  return String(log.mock.calls[0][0]);
}

const cliDir = join(guidesDir, 'cli-preview');

// The CLI tests run the command the guide shows, read from the page, so a flag or path changed there is changed here too.
const guideCommand = readFileSync(join(rootDir, 'docs', 'guides', 'cli-preview.md'), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('node dist/cli.js '));
if (guideCommand === undefined || !guideCommand.includes(' --data ') || !guideCommand.includes(' --out ')) {
  throw new Error('docs/guides/cli-preview.md has no "node dist/cli.js" command with --data and --out');
}
const guideArgs = guideCommand.split(' ').slice(2);

function cliArgs(dataFile: string, outFile?: string): string[] {
  const args = guideArgs.map((arg) => (arg.startsWith('examples/') ? join(rootDir, arg) : arg));
  args[args.indexOf('--data') + 1] = dataFile;
  const outIndex = args.indexOf('--out');
  if (outFile === undefined) {
    args.splice(outIndex, 2);
  } else {
    args[outIndex + 1] = outFile;
  }
  return args;
}

async function renderEmptyDigest(): Promise<string> {
  const numberFormat = new Intl.NumberFormat('en-US');
  const compiled = await compileEmailTemplate({
    subject: 'Weekly digest for {{workspaceName}}',
    html: readFileSync(join(guidesDir, 'digest', 'digest.html'), 'utf8'),
    css: readFileSync(join(guidesDir, 'digest', 'digest.css'), 'utf8'),
    handlebars: {
      helpers: {
        formatNumber: (value: number) => numberFormat.format(value),
        position: (index: number) => index + 1
      }
    }
  });

  return compiled.render({
    data: { workspaceName: 'Product Operations', periodLabel: 'Week of October 12, 2026', total: 0, rows: [] }
  }).html;
}

describe('guide examples', () => {
  it('the quickstart script renders the name, the slot HTML and a text part, with no placeholders or layout tags left', () => {
    const email = runGuide('quickstart');

    expect(email.subject).toBe('Welcome to ACME, Dan');
    expect(email.html).toContain('Hi Dan');
    expect(email.html).toContain('<p>Your account is ready.</p>');
    expect(email.html).toContain('Invite a teammate');
    expect(typeof email.text).toBe('string');
    expectNoPlaceholdersOrLayoutTags(email.html);
  });

  it('the transactional script renders one email per recipient with the slot HTML raw and no placeholders or layout tags left', () => {
    const emails = runTransactional();

    expect(emails).toHaveLength(2);
    expect(emails.map((email) => email.subject)).toEqual(['Welcome to ACME, Ada', 'Welcome to ACME, Grace']);
    expect(emails[0].html).toContain('Ada');
    expect(emails[1].html).toContain('Grace');

    for (const email of emails) {
      expect(email.html).toMatch(/<strong>[^<]+<\/strong>/);
      expectNoPlaceholdersOrLayoutTags(email.html);
    }
  });

  it('the marketing script embeds the image, shouts, keeps the raw badge and renders the partial, with no placeholders or layout tags left', () => {
    const { html } = runGuide('marketing');

    expect(html).toContain('data:image/png;base64');
    expect(html).toContain('ACME LAUNCH WEEK IS HERE');
    expect(html).toMatch(/<span style="background:#246BFE[^"]*">Pro<\/span>/);
    expect(html).toContain('The ACME team');
    expectNoPlaceholdersOrLayoutTags(html);
  });

  it('the digest script renders at least ten rows and the formatted total without the empty state or leftover placeholders and layout tags', () => {
    const { html } = runGuide('digest');

    expect(html.match(/<td>\d+<\/td>/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(html).toContain('<td>12</td>');
    expect(html).toContain('Total: 18,432');
    expect(html).not.toContain('Nothing moved in');
    expect(html).toContain('background:#ecfdf3');
    expect(html).toContain('background:#eff8ff');
    expectNoPlaceholdersOrLayoutTags(html);
  });

  it('the digest template shows the empty state when there are no rows, with no placeholders or layout tags left', async () => {
    const html = await renderEmptyDigest();

    expect(html).toContain('Nothing moved in Product Operations this week.');
    expect(html).not.toMatch(/<td>\d+<\/td>/);
    expectNoPlaceholdersOrLayoutTags(html);
  });

  it('the cli-preview command from the guide prints the order, writes it with --out and overwrites only with --force', async () => {
    const output = await runCli(cliArgs(join(cliDir, 'data.json')));

    expect(output).toContain('Thanks for your order, Maya');
    expect(output).toContain('Linen notebook');
    expect(output).toContain('Brass pen');
    expect(output).toContain('Desk tray');
    expect(output).toContain('Total: $73.35');
    expectNoPlaceholdersOrLayoutTags(output);

    const outFile = join(makeTempDir('inline-email-guides-'), 'preview.html');
    const outArgs = cliArgs(join(cliDir, 'data.json'), outFile);

    await main(outArgs);
    expect(existsSync(outFile)).toBe(true);
    expect(readFileSync(outFile, 'utf8')).toContain('Total: $73.35');

    await expect(main(outArgs)).rejects.toThrow('Out file path already exists. Use --force or -f to overwrite it.');
    await expect(main([...outArgs, '--force'])).resolves.toBeUndefined();
  });

  it('the cli-preview command from the guide fails a strict run when the data lacks a field', async () => {
    const data = JSON.parse(readFileSync(join(cliDir, 'data.json'), 'utf8')) as Record<string, unknown>;
    delete data.total;
    const dataFile = join(makeTempDir('inline-email-guides-'), 'data.json');
    writeFileSync(dataFile, JSON.stringify(data), 'utf8');

    await expect(main(cliArgs(dataFile))).rejects.toThrow(/"total" not defined/);
  });
});
