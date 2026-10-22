import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { describe, expect, it } from 'vitest';
import { compileEmailTemplate, inlineEmailHtml, renderEmail } from '../src/index.ts';
import type { CompileEmailTemplateOptions } from '../src/index.ts';
import { captureConsole } from './support/console.ts';
import { makeTempDir } from './support/temp-dir.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

describe('compileEmailTemplate', () => {
  it('inlines CSS once and renders dynamic data later', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Welcome, {{firstName}}',
      html: '<html><body><p class="greeting">Hello {{firstName}}</p></body></html>',
      css: '.greeting { color: red; }',
      text: 'Hello {{firstName}}'
    });

    expect(compiled.html).toContain('style="color: red;"');

    const email = compiled.render({ firstName: '<Dan>' });
    expect(email.subject).toBe('Welcome, <Dan>');
    expect(email.html).toContain('Hello &lt;Dan&gt;');
    expect(email.text).toBe('Hello <Dan>');
  });

  it('renders html unescaped when escape is none', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{name}}',
      html: '<p>{{name}}</p>',
      text: 'Hi {{name}}',
      escape: 'none'
    });

    const email = compiled.render({ name: '<b>Dan</b>' });
    expect(email.subject).toBe('Hi <b>Dan</b>');
    expect(email.html).toBe('<p><b>Dan</b></p>');
    expect(email.text).toBe('Hi <b>Dan</b>');
  });

  it('throws from render on missing data when strict is on', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{name}}',
      html: '<p>{{name}} {{missing}}</p>',
      strict: true
    });

    expect(() => compiled.render({ name: 'Dan' })).toThrow('"missing" not defined in [object Object]');
    expect(compiled.render({ name: 'Dan', missing: null }).html).toBe('<p>Dan </p>');
  });

  it('throws from render on missing subject or text data when strict is on', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{name}}',
      html: '<p>Hello</p>',
      text: 'Hello {{other}}',
      strict: true
    });

    expect(() => compiled.render({ other: 'x' })).toThrow('"name" not defined in [object Object]');
    expect(() => compiled.render({ name: 'Dan' })).toThrow('"other" not defined in [object Object]');
  });

  it('passes handlebars helpers to every part of the template', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{shout name}}',
      html: '<p>{{shout name}} {{bold name}}</p>',
      text: 'Hi {{shout name}}',
      handlebars: {
        helpers: {
          shout: (text: string) => `<${text.toUpperCase()}>`,
          bold: (text: string) => new Handlebars.SafeString(`<b>${text}</b>`)
        }
      }
    });

    const email = compiled.render({ name: 'Dan' });
    expect(email.subject).toBe('Hi <DAN>');
    expect(email.html).toBe('<p>&lt;DAN&gt; <b>Dan</b></p>');
    expect(email.text).toBe('Hi <DAN>');
  });

  it('treats bare data with a string style key as template data', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{name}}',
      html: '<p>{{name}} prefers a {{style}} tone</p>'
    });

    const email = compiled.render({ name: 'Dan', style: 'casual' });
    expect(email.subject).toBe('Hi Dan');
    expect(email.html).toBe('<p>Dan prefers a casual tone</p>');
  });

  it('treats an object style key as a render context', async () => {
    const compiled = await compileEmailTemplate({
      html: '<panel tone="info">{{message}}</panel>'
    });

    const email = compiled.render({
      data: { message: 'Ready' },
      style: { tones: { info: { background: '#123456' } } }
    });
    expect(email.html).toContain('Ready');
    expect(email.html).toContain('background:#123456;');
  });

  it('refuses to compile a template with no HTML', async () => {
    await expect(compileEmailTemplate({ subject: 'Hi' } as CompileEmailTemplateOptions)).rejects.toThrow('HTML is required.');
  });

  it('renders layout only when responsive is true, and leaves layout tags alone when it is false', async () => {
    const plain = '<p>Hi</p>';
    const layout = '<section>Hi</section>';

    expect((await compileEmailTemplate({ html: plain })).html).not.toContain('data-ie-preserve-style');
    expect((await compileEmailTemplate({ html: plain, responsive: true })).html).toContain('data-ie-preserve-style');
    expect((await compileEmailTemplate({ html: layout, responsive: false })).html).toBe(layout);
  });

  it('reads responsive from an options object like a boolean, and detects layout tags when enabled is left out', async () => {
    const plain = '<p>Hi</p>';
    const layout = '<section>Hi</section>';

    expect((await compileEmailTemplate({ html: plain, responsive: { enabled: true } })).html).toContain('data-ie-preserve-style');
    expect((await compileEmailTemplate({ html: layout, responsive: { enabled: false } })).html).toBe(layout);
    expect((await compileEmailTemplate({ html: layout, responsive: {} })).html).toContain('class="ie-section"');
  });

  it('renders with empty data when render is given null instead of data', async () => {
    const compiled = await compileEmailTemplate({ html: '<p>Hi{{name}}</p>', subject: 'Hi{{name}}' });

    const email = compiled.render(null as never);
    expect(email.subject).toBe('Hi');
    expect(email.html).toContain('<p>Hi</p>');
  });

  it('renders with empty data when a render context has a style but no data', async () => {
    const compiled = await compileEmailTemplate({ html: '<panel tone="info">Hi{{name}}</panel>' });

    const email = compiled.render({ style: { tones: { info: { background: '#123456' } } } });
    expect(email.html).toContain('Hi</td>');
    expect(email.html).toContain('background:#123456;');
  });

  it('inlines linked stylesheets when only webResources.links is on', async () => {
    const dir = makeTempDir('inline-email-links-');
    await writeFile(join(dir, 'x.css'), '.note { color: blue; }');

    const html = await inlineEmailHtml(
      '<html><head><link rel="stylesheet" href="x.css"></head><body><p class="note">Hi</p></body></html>',
      '',
      { juice: { webResources: { links: true, relativeTo: dir } } }
    );

    expect(html).toContain('<p class="note" style="color: blue;">Hi</p>');
    expect(html).not.toContain('href="x.css"');
  });

  it('keeps the src of an unreachable image and still compiles by default', async () => {
    const warn = captureConsole('warn');

    const compiled = await compileEmailTemplate({
      html: '<p>Reset your password</p><img src="missing.png">',
      juice: { webResources: { images: true, relativeTo: rootDir } }
    });

    expect(compiled.html).toContain('src="missing.png"');
    expect(warn).toHaveBeenCalled();
  });

  it('rejects the compile for an unreachable image when webResources.strict is on', async () => {
    await expect(
      compileEmailTemplate({
        html: '<p>Big sale</p><img src="missing.png">',
        juice: { webResources: { images: true, strict: true, relativeTo: rootDir } }
      })
    ).rejects.toThrow(/missing\.png/);
  });

  it('keeps the responsive style element when resource inlining is on', async () => {
    const compiled = await compileEmailTemplate({
      html: '<email><container><section><p>Hi</p></section></container></email>',
      juice: { webResources: { images: true, relativeTo: rootDir } }
    });

    expect(compiled.html).toMatch(/<style(\s[^>]*)?>[^<]*@media/);
    expect(compiled.html).not.toContain('<style-');
  });

  it('keeps attributes that start with data-inline when resource inlining is on', async () => {
    const html = await inlineEmailHtml(
      '<p data-inline-note="keep me" data-INLINE-x="y">Hi</p><img data-inline src="docs/assets/upgrade-offer.png">',
      '',
      { juice: { webResources: { links: true, relativeTo: rootDir } } }
    );

    expect(html).toContain('<p data-inline-note="keep me" data-inline-x="y">');
    expect(html).toContain('data:image/png;base64');
  });
});

describe('renderEmail', () => {
  it('compiles and renders a template object in one call', async () => {
    const email = await renderEmail({
      template: {
        html: '<p>{{message}}</p>'
      },
      data: {
        message: 'Ready'
      }
    });

    expect(email.html).toBe('<p>Ready</p>');
  });

  it('renders a template given as an HTML string, with no data', async () => {
    const email = await renderEmail({ template: '<p>Hello{{name}}</p>' });

    expect(email).toEqual({ subject: '', html: '<p>Hello</p>', text: '' });
  });

  it('renders an already compiled template with the data and style given', async () => {
    const compiled = await compileEmailTemplate({ html: '<panel tone="info">{{message}}</panel>' });

    const email = await renderEmail({
      template: compiled,
      data: { message: 'Ready' },
      style: { tones: { info: { background: '#123456' } } }
    });

    expect(email.html).toContain('Ready');
    expect(email.html).toContain('background:#123456;');
  });
});

describe('inlineEmailHtml', () => {
  it('runs a caller-provided transform before inlining', async () => {
    const html = await inlineEmailHtml('<row>Hi</row>', '', {
      transform: (source) => source.replace('<row>', '<table class="row"><tr>').replace('</row>', '</tr></table>')
    });

    expect(html).toContain('class="row"');
    expect(html).toContain('Hi');
  });

  it.each(['\n', '  \n'])('inlines the HTML\'s <style> blocks when the CSS is whitespace only (%j)', async (css) => {
    const html = await inlineEmailHtml('<style>p { color: red; }</style><p>Hi</p>', css);

    expect(html).toContain('<p style="color: red;">Hi</p>');
  });

  it('keeps the @media rules of the given CSS in a <style> block in the head', async () => {
    const html = await inlineEmailHtml(
      '<html><head></head><body><p class="a">Hi</p></body></html>',
      '.a { color: red; } @media (max-width: 600px) { .a { color: blue; } }'
    );

    expect(html).toContain('<p class="a" style="color: red;">Hi</p>');
    expect(html).toMatch(/<head><style>[^<]*@media \(max-width: 600px\)[^<]*color: blue/);
  });

  it('keeps the @media rules of both the given CSS and the juice extraCss option', async () => {
    const html = await inlineEmailHtml('<p class="a">Hi</p>', '@media (max-width: 600px) { .a { color: blue; } }', {
      juice: { extraCss: '@media print { .a { display: none; } }' }
    });

    expect(html).toContain('@media (max-width: 600px)');
    expect(html).toContain('@media print');
  });
});
