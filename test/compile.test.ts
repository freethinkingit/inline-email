import { describe, expect, it } from 'vitest';
import { compileEmailTemplate, inlineEmailHtml, renderEmail } from '../src/index.ts';

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
    expect(email.subject).toBe('Welcome, &lt;Dan&gt;');
    expect(email.html).toContain('Hello &lt;Dan&gt;');
    expect(email.text).toBe('Hello &lt;Dan&gt;');
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
