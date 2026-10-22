import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main, parseArgs } from '../src/cli.ts';
import { AWKWARD_INPUTS, expectCleanOutcome } from './support/awkward-inputs.ts';
import { captureConsole } from './support/console.ts';
import { makeTempDir } from './support/temp-dir.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function writeTemplate(dir: string, template: string): string {
  const html = join(dir, 'in.html');
  writeFileSync(html, template, 'utf8');
  return html;
}

function writeImageTemplate(): string {
  const dir = makeTempDir('inline-email-cli-');
  copyFileSync(join(rootDir, 'docs', 'assets', 'upgrade-offer.png'), join(dir, 'pic.png'));
  return writeTemplate(dir, '<img src="pic.png">');
}

function writeDataTemplate(template: string, data?: string): { html: string; data: string } {
  const dir = makeTempDir('inline-email-cli-');
  const dataFile = join(dir, 'data.json');

  if (data !== undefined) {
    writeFileSync(dataFile, data, 'utf8');
  }

  return { html: writeTemplate(dir, template), data: dataFile };
}

describe('parseArgs', () => {
  it('takes the last file as the HTML input when every file follows --css', () => {
    expect(parseArgs(['--css', 'style.css', 'input.html'])).toMatchObject({
      css: ['style.css'],
      html: 'input.html'
    });
  });

  it('collects every file after --css when the HTML input comes first', () => {
    expect(parseArgs(['input.html', '--css', 'base.css', 'theme.css'])).toMatchObject({
      css: ['base.css', 'theme.css'],
      html: 'input.html'
    });
  });

  it('reads the HTML input from --html and takes every later positional file as CSS', () => {
    expect(parseArgs(['--html', 'input.html', 'base.css', 'theme.css'])).toMatchObject({
      css: ['base.css', 'theme.css'],
      html: 'input.html'
    });
  });

  it('refuses --css followed by no file', () => {
    expect(() => parseArgs(['input.html', '--css'])).toThrow('--css requires at least one file.');
  });

  it('refuses --data followed by another option instead of a file', () => {
    expect(() => parseArgs(['input.html', '--data', '--strict'])).toThrow('--data requires a value.');
  });

  it('keeps awkward text intact as a file name and refuses it as an option', async () => {
    for (const [name, input] of Object.entries(AWKWARD_INPUTS)) {
      const positional = await expectCleanOutcome(() => parseArgs([input]), name);
      expect(positional, name).toEqual({ outcome: 'returned', value: expect.objectContaining({ html: input }) });

      const css = await expectCleanOutcome(() => parseArgs(['input.html', '--css', input]), name);
      expect(css, name).toEqual({ outcome: 'returned', value: expect.objectContaining({ css: [input] }) });

      const flag = await expectCleanOutcome(() => parseArgs([`--${input}`]), name);
      expect(flag.outcome, name).toBe('threw');
      expect(flag.outcome === 'threw' && flag.error.message, name).toBe(`Unknown option: --${input}`);
    }
  });
});

describe('main', () => {
  it('prints the help text naming the options', async () => {
    const log = captureConsole('log');

    await main(['--help']);

    const help = String(log.mock.calls[0][0]);
    expect(help).toContain('--inlineImages');
    expect(help).toContain('--data <file>');
    expect(help).toContain('--strict');
  });

  it('refuses to run without an HTML file', async () => {
    await expect(main([])).rejects.toThrow('An HTML file is required.');
  });

  it('inlines the CSS files given with --css', async () => {
    const dir = makeTempDir('inline-email-cli-');
    const html = writeTemplate(dir, '<p class="a">Hi</p><p class="b">There</p>');
    const base = join(dir, 'base.css');
    const theme = join(dir, 'theme.css');
    writeFileSync(base, '.a { color: red; }', 'utf8');
    writeFileSync(theme, '.b { color: blue; }', 'utf8');
    const log = captureConsole('log');

    await main([html, '--css', base, theme]);

    const output = String(log.mock.calls[0][0]);
    expect(output).toContain('<p class="a" style="color: red;">Hi</p>');
    expect(output).toContain('<p class="b" style="color: blue;">There</p>');
  });

  it('inlines the HTML\'s <style> blocks when every --css file is empty', async () => {
    const dir = makeTempDir('inline-email-cli-');
    const html = writeTemplate(dir, '<style>p { color: red; }</style><p>Hi</p>');
    const first = join(dir, 'first.css');
    const second = join(dir, 'second.css');
    writeFileSync(first, '', 'utf8');
    writeFileSync(second, '', 'utf8');
    const log = captureConsole('log');

    await main([html, '--css', first, second]);

    expect(String(log.mock.calls[0][0])).toContain('<p style="color: red;">Hi</p>');
  });

  it('writes the output to the --out file instead of printing it', async () => {
    const dir = makeTempDir('inline-email-cli-');
    const html = writeTemplate(dir, '<p>Hi</p>');
    const out = join(dir, 'out.html');
    const log = captureConsole('log');

    await main([html, '--out', out]);

    expect(readFileSync(out, 'utf8')).toContain('<p>Hi</p>');
    expect(log).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an existing --out file unless --force or -f is given', async () => {
    const dir = makeTempDir('inline-email-cli-');
    const html = writeTemplate(dir, '<p>Hi</p>');
    const out = join(dir, 'out.html');
    writeFileSync(out, 'old', 'utf8');

    await expect(main([html, '-o', out])).rejects.toThrow('Out file path already exists. Use --force or -f to overwrite it.');
    expect(readFileSync(out, 'utf8')).toBe('old');

    for (const force of ['--force', '-f']) {
      writeFileSync(out, 'old', 'utf8');
      await main([html, '-o', out, force]);
      expect(readFileSync(out, 'utf8'), force).toContain('<p>Hi</p>');
    }
  });

  it('leaves local image references in place without an image flag', async () => {
    const html = writeImageTemplate();
    const log = captureConsole('log');
    const error = captureConsole('error');

    await main([html]);

    const output = String(log.mock.calls[0][0]);
    expect(output).toContain('src="pic.png"');
    expect(output).not.toContain('data:image');
    expect(error).not.toHaveBeenCalled();
  });

  it('embeds local images as data URIs with --inlineImages', async () => {
    const html = writeImageTemplate();
    const log = captureConsole('log');

    await main([html, '--inlineImages']);

    expect(String(log.mock.calls[0][0])).toContain('data:image');
  });

  it('prints one deprecation line for --noInlineImages and changes nothing', async () => {
    const html = writeImageTemplate();
    const log = captureConsole('log');
    const error = captureConsole('error');

    await main([html, '--noInlineImages']);

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('no longer inlined by default');
    expect(String(log.mock.calls[0][0])).toContain('src="pic.png"');
  });

  it('writes the HTML rendered with the --data file', async () => {
    const { html, data } = writeDataTemplate('<p>Hello {{name}}</p>', '{"name":"Ada"}');
    const log = captureConsole('log');

    await main([html, '--data', data]);

    expect(String(log.mock.calls[0][0])).toContain('<p>Hello Ada</p>');
  });

  it('fails on a malformed template instead of writing output', async () => {
    const dir = makeTempDir('inline-email-cli-');
    const html = writeTemplate(dir, '<p>{{/items}}</p>');
    const out = join(dir, 'out.html');

    await expect(main([html, '--out', out])).rejects.toThrow(/Parse error on line 1/);
    expect(existsSync(out)).toBe(false);
  });

  it('rejects a missing data file, naming the file', async () => {
    const { html, data } = writeDataTemplate('<p>Hello {{name}}</p>');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} does not exist.`);
  });

  it('rejects a malformed data file, naming the file', async () => {
    const { html, data } = writeDataTemplate('<p>Hello {{name}}</p>', '{"name":');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} could not be read as JSON:`);
  });

  it('rejects a data file that is not a JSON object, naming the file', async () => {
    const { html, data } = writeDataTemplate('<p>Hello {{name}}</p>', 'null');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} must contain a JSON object.`);
  });

  it('rejects a field missing from the data with --strict', async () => {
    const { html, data } = writeDataTemplate('<p>{{name}}</p>', '{}');

    await expect(main([html, '--data', data, '--strict'])).rejects.toThrow(/"name" not defined in/);
  });

  it('renders awkward text from a data value and refuses it as raw file content', async () => {
    for (const [name, input] of Object.entries(AWKWARD_INPUTS)) {
      const value = writeDataTemplate('<p>{{name}}</p>', JSON.stringify({ name: input }));
      const log = captureConsole('log');
      const rendered = await expectCleanOutcome(() => main([value.html, '--data', value.data]), name);
      expect(rendered.outcome, name).toBe('returned');
      expect(String(log.mock.calls[0][0]), name).toContain(`<p>${input}</p>`);
      log.mockRestore();

      const raw = writeDataTemplate('<p>{{name}}</p>', input);
      const refused = await expectCleanOutcome(() => main([raw.html, '--data', raw.data]), name);
      expect(refused.outcome, name).toBe('threw');
      expect(refused.outcome === 'threw' && refused.error.message, name).toContain(`Data file ${raw.data} could not be read as JSON:`);
    }
  });

  it('reads a data file that starts with a byte order mark', async () => {
    const { html, data } = writeDataTemplate('<p>Hello {{name}}</p>', '\uFEFF{"name":"Ada"}');
    const log = captureConsole('log');

    await main([html, '--data', data]);

    expect(String(log.mock.calls[0][0])).toContain('<p>Hello Ada</p>');
  });
});
