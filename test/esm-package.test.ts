import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

describe('published ESM package shape', () => {
  it('imports the built package and renders through juice without CommonJS require', async () => {
    const packageUrl = pathToFileURL(join(process.cwd(), 'dist', 'index.js')).href;
    const { renderEmail } = await import(packageUrl);

    const email = await renderEmail({
      template: {
        subject: 'Hello {{name}}',
        html: '<p class="message">Hello {{name}}</p>',
        css: '.message { color: #246bfe; }'
      },
      data: {
        name: 'Dan'
      }
    });

    expect(email.subject).toBe('Hello Dan');
    expect(email.html).toContain('Hello Dan');
    expect(email.html).toContain('style="color: #246bfe;"');
  });
});
