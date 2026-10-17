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
    expect(email.html).toBe('<p>O&#39;Brien</p>');
    expect(email.text).toBe("Hi O'Brien & welcome");
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
