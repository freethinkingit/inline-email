import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileEmailTemplate } from 'inline-email';
import { main } from '../src/cli.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const guidesDir = join(rootDir, 'examples', 'guides');

const placeholderLeak = /{{[#/]?[\w.:-]+}}/;
const layoutTagLeak = /<\/?(email|container|section|columns|column|button|spacer|divider|hero-image|alert|panel|brand|footer)\b/i;

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
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  await main(args);
  return String(log.mock.calls[0][0]);
}

const cliDir = join(guidesDir, 'cli-preview');

// The CLI tests run the command the guide shows, read from the page, so a flag or path changed there is changed here too.
const guideCommand = readFileSync(join(rootDir, 'docs', 'guides', 'cli-preview.md'), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('node dist/cli.js '));
if (!guideCommand?.includes(' --data ') || !guideCommand.includes(' --out ')) {
  throw new Error('docs/guides/cli-preview.md has no "node dist/cli.js" command with --data and --out');
}
const guideArgs = guideCommand.split(' ').slice(2);

function cliArgs(dataFile: string, outFile?: string): string[] {
  const args = guideArgs.map((arg) => (arg.startsWith('examples/') ? join(rootDir, arg) : arg));
  args[args.indexOf('--data') + 1] = dataFile;
  const out = args.indexOf('--out');
  if (outFile === undefined) args.splice(out, 2);
  else args[out + 1] = outFile;
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
  let tempDir: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('quickstart renders the name and the slot HTML', () => {
    const email = runGuide('quickstart');

    expect(email.subject).toBe('Welcome to ACME, Dan');
    expect(email.html).toContain('Hi Dan');
    expect(email.html).toContain('<p>Your account is ready.</p>');
    expect(email.html).toContain('Invite a teammate');
    expect(typeof email.text).toBe('string');
  });

  it('transactional renders one email per recipient with the slot HTML raw', () => {
    const emails = runTransactional();

    expect(emails).toHaveLength(2);
    expect(emails.map((email) => email.subject)).toEqual(['Welcome to ACME, Ada', 'Welcome to ACME, Grace']);
    expect(emails[0].html).toContain('Ada');
    expect(emails[1].html).toContain('Grace');

    for (const email of emails) {
      expect(email.html).toMatch(/<strong>[^<]+<\/strong>/);
    }
  });

  it('marketing embeds the image, shouts, keeps the raw badge and renders the partial', () => {
    const { html } = runGuide('marketing');

    expect(html).toContain('data:image/png;base64');
    expect(html).toContain('ACME LAUNCH WEEK IS HERE');
    expect(html).toMatch(/<span style="background:#246BFE[^"]*">Pro<\/span>/);
    expect(html).toContain('The ACME team');
  });

  it('digest renders at least ten rows, the formatted total and no empty state', () => {
    const { html } = runGuide('digest');

    expect(html.match(/<td>\d+<\/td>/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(html).toContain('<td>12</td>');
    expect(html).toContain('Total: 18,432');
    expect(html).not.toContain('Nothing moved in');
    expect(html).toContain('background:#ecfdf3');
    expect(html).toContain('background:#eff8ff');
  });

  it('digest shows the empty state when there are no rows', async () => {
    const html = await renderEmptyDigest();

    expect(html).toContain('Nothing moved in Product Operations this week.');
    expect(html).not.toMatch(/<td>\d+<\/td>/);
  });

  it('cli-preview renders the order with the commands the guide shows', async () => {
    const output = await runCli(cliArgs(join(cliDir, 'data.json')));

    expect(output).toContain('Thanks for your order, Maya');
    expect(output).toContain('Linen notebook');
    expect(output).toContain('Brass pen');
    expect(output).toContain('Desk tray');
    expect(output).toContain('Total: $73.35');

    tempDir = mkdtempSync(join(tmpdir(), 'inline-email-guides-'));
    const outFile = join(tempDir, 'preview.html');
    const outArgs = cliArgs(join(cliDir, 'data.json'), outFile);

    await main(outArgs);
    expect(existsSync(outFile)).toBe(true);
    expect(readFileSync(outFile, 'utf8')).toContain('Total: $73.35');

    await expect(main(outArgs)).rejects.toThrow('Out file path already exists. Use --force or -f to overwrite it.');
    await expect(main([...outArgs, '--force'])).resolves.toBeUndefined();
  });

  it('cli-preview rejects a strict run with a field removed', async () => {
    const data = JSON.parse(readFileSync(join(cliDir, 'data.json'), 'utf8')) as Record<string, unknown>;
    delete data.total;
    tempDir = mkdtempSync(join(tmpdir(), 'inline-email-guides-'));
    const dataFile = join(tempDir, 'data.json');
    writeFileSync(dataFile, JSON.stringify(data), 'utf8');

    await expect(main(cliArgs(dataFile))).rejects.toThrow(/"total" not defined/);
  });
});

describe('Property 2: Guide examples render clean', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['quickstart', 'marketing', 'digest'])('%s leaks no placeholders or layout tags', (guide) => {
    const { html } = runGuide(guide);

    expect(html).not.toMatch(placeholderLeak);
    expect(html).not.toMatch(layoutTagLeak);
  });

  it('transactional leaks no placeholders or layout tags', () => {
    for (const { html } of runTransactional()) {
      expect(html).not.toMatch(placeholderLeak);
      expect(html).not.toMatch(layoutTagLeak);
    }
  });

  it('the empty digest leaks no placeholders or layout tags', async () => {
    const html = await renderEmptyDigest();

    expect(html).not.toMatch(placeholderLeak);
    expect(html).not.toMatch(layoutTagLeak);
  });

  it('cli-preview leaks no placeholders or layout tags', async () => {
    const output = await runCli(cliArgs(join(cliDir, 'data.json')));

    expect(output).not.toMatch(placeholderLeak);
    expect(output).not.toMatch(layoutTagLeak);
  });
});
