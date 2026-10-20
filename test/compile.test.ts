import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { describe, expect, it, vi } from 'vitest';
import { compileEmailTemplate, inlineEmailHtml, renderEmail } from '../src/index.ts';

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

  it('renders subject and text without HTML escaping', async () => {
    const compiled = await compileEmailTemplate({
      subject: 'Hi {{name}}, Tom & Jerry',
      html: '<p>{{name}}</p>',
      text: 'Hi {{name}} & welcome'
    });

    const email = compiled.render({ name: "O'Brien" });
    expect(email.subject).toBe("Hi O'Brien, Tom & Jerry");
    expect(email.html).toBe('<p>O&#x27;Brien</p>');
    expect(email.text).toBe("Hi O'Brien & welcome");
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

  it('matches a tone name containing characters Handlebars escapes', async () => {
    const compiled = await compileEmailTemplate({
      html: '<panel tone="{{tone}}">{{message}}</panel>'
    });

    const email = compiled.render({
      data: { message: 'Ready', tone: "it's=`odd`" },
      style: { tones: { "it's=`odd`": { background: '#654321' } } }
    });
    expect(email.html).toContain('background:#654321;');
  });

  it('embeds local images as data URIs when webResources.images is on', async () => {
    const compiled = await compileEmailTemplate({
      html: '<img src="docs/assets/upgrade-offer.png">',
      juice: { webResources: { images: true, relativeTo: rootDir } }
    });

    expect(compiled.html).toContain('data:image/png;base64');
  });

  it('inlines linked stylesheets when only webResources.links is on', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'inline-email-links-'));
    try {
      await writeFile(join(dir, 'x.css'), '.note { color: blue; }');

      const html = await inlineEmailHtml(
        '<html><head><link rel="stylesheet" href="x.css"></head><body><p class="note">Hi</p></body></html>',
        '',
        { juice: { webResources: { links: true, relativeTo: dir } } }
      );

      expect(html).toContain('<p class="note" style="color: blue;">Hi</p>');
      expect(html).not.toContain('href="x.css"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the src of an unreachable image and still compiles by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const compiled = await compileEmailTemplate({
        html: '<p>Reset your password</p><img src="missing.png">',
        juice: { webResources: { images: true, relativeTo: rootDir } }
      });

      expect(compiled.html).toContain('src="missing.png"');
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
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

  it('supports one-shot rendering', async () => {
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
});

describe('inlineEmailHtml', () => {
  it('can run a caller-provided compile transform before inlining', async () => {
    const html = await inlineEmailHtml('<row>Hi</row>', '', {
      transform: (source) => source.replace('<row>', '<table class="row"><tr>').replace('</row>', '</tr></table>')
    });

    expect(html).toContain('class="row"');
    expect(html).toContain('Hi');
  });
});
