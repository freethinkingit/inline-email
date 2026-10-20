import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, parseArgs } from '../src/cli.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

describe('parseArgs', () => {
  it('supports legacy --css style.css input.html ordering', () => {
    expect(parseArgs(['--css', 'style.css', 'input.html'])).toMatchObject({
      css: ['style.css'],
      html: 'input.html'
    });
  });

  it('supports positional html before multiple css files', () => {
    expect(parseArgs(['input.html', '--css', 'base.css', 'theme.css'])).toMatchObject({
      css: ['base.css', 'theme.css'],
      html: 'input.html'
    });
  });

  it('leaves image inlining off when no image flag is given', () => {
    expect(parseArgs(['input.html'])).toMatchObject({ inlineImages: false, deprecatedFlag: false });
  });

  it('turns image inlining on with --inlineImages', () => {
    expect(parseArgs(['input.html', '--inlineImages'])).toMatchObject({ inlineImages: true, deprecatedFlag: false });
  });

  it('accepts the deprecated --noInlineImages flag and marks it', () => {
    expect(parseArgs(['input.html', '--noInlineImages'])).toMatchObject({ inlineImages: false, deprecatedFlag: true });
  });

  it('reads the data file path from --data', () => {
    expect(parseArgs(['input.html', '--data', 'data.json'])).toMatchObject({ html: 'input.html', data: 'data.json', strict: false });
  });

  it('turns strict mode on with --strict', () => {
    expect(parseArgs(['input.html', '--strict'])).toMatchObject({ html: 'input.html', strict: true });
  });
});

describe('main', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function writeDataFixture(template: string, data?: string): { html: string; data: string } {
    tempDir = mkdtempSync(join(tmpdir(), 'inline-email-cli-'));
    const html = join(tempDir, 'in.html');
    const dataFile = join(tempDir, 'data.json');
    writeFileSync(html, template, 'utf8');

    if (data !== undefined) {
      writeFileSync(dataFile, data, 'utf8');
    }

    return { html, data: dataFile };
  }

  function writeImageFixture(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'inline-email-cli-'));
    copyFileSync(join(rootDir, 'docs', 'assets', 'upgrade-offer.png'), join(tempDir, 'pic.png'));
    const html = join(tempDir, 'in.html');
    writeFileSync(html, '<img src="pic.png">', 'utf8');
    return html;
  }

  it('names both image flags in the help text', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main(['--help']);

    const help = String(log.mock.calls[0][0]);
    expect(help).toContain('--inlineImages');
    expect(help).toContain('--noInlineImages');
    expect(help).toContain('Off by default');
  });

  it('names --data and --strict in the help text', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main(['--help']);

    const help = String(log.mock.calls[0][0]);
    expect(help).toContain('--data <file>');
    expect(help).toContain('--strict');
  });

  it('leaves local image references in place without an image flag', async () => {
    const html = writeImageFixture();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await main([html]);

    const output = String(log.mock.calls[0][0]);
    expect(output).toContain('src="pic.png"');
    expect(output).not.toContain('data:image');
    expect(error).not.toHaveBeenCalled();
  });

  it('embeds local images as data URIs with --inlineImages', async () => {
    const html = writeImageFixture();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main([html, '--inlineImages']);

    expect(String(log.mock.calls[0][0])).toContain('data:image');
  });

  it('prints one deprecation line for --noInlineImages and changes nothing', async () => {
    const html = writeImageFixture();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await main([html, '--noInlineImages']);

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('--noInlineImages');
    expect(String(error.mock.calls[0][0])).toContain('no longer inlined by default');
    expect(String(log.mock.calls[0][0])).toContain('src="pic.png"');
  });

  it('rejects a data file that is not a JSON object, naming the file', async () => {
    const { html, data } = writeDataFixture('<p>Hello {{name}}</p>', 'null');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} must contain a JSON object.`);
  });

  it('rejects a malformed template with the Handlebars parse error', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'inline-email-cli-'));
    const html = join(tempDir, 'in.html');
    writeFileSync(html, '<p>{{/items}}</p>', 'utf8');

    await expect(main([html])).rejects.toThrow(/Parse error on line 1/);
  });

  it('writes the rendered HTML with --data', async () => {
    const { html, data } = writeDataFixture('<p>Hello {{name}}</p>', '{"name":"Ada"}');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main([html, '--data', data]);

    const output = String(log.mock.calls[0][0]);
    expect(output).toContain('Hello Ada');
    expect(output).not.toContain('{{name}}');
  });

  it('rejects a missing data file naming the file', async () => {
    const { html, data } = writeDataFixture('<p>Hello {{name}}</p>');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} does not exist.`);
  });

  it('rejects a malformed data file naming the file', async () => {
    const { html, data } = writeDataFixture('<p>Hello {{name}}</p>', '{"name":');

    await expect(main([html, '--data', data])).rejects.toThrow(`Data file ${data} could not be read as JSON:`);
  });

  it('rejects a field missing from the data with --strict', async () => {
    const { html, data } = writeDataFixture('<p>{{name}}</p>', '{}');

    await expect(main([html, '--data', data, '--strict'])).rejects.toThrow(/"name" not defined in/);
  });
});
