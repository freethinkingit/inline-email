import { execFileSync } from 'node:child_process';
import { symlinkSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeTempDir } from './support/temp-dir.ts';

describe('the published ESM package', () => {
  it('imports from dist/ and inlines CSS through juice without a CommonJS require', async () => {
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

  it('runs the CLI when started through a symlink, as npm bin links start it', () => {
    const bin = join(makeTempDir('inline-email-bin-'), 'inline-email');
    symlinkSync(join(process.cwd(), 'dist', 'cli.js'), bin);

    const output = execFileSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });

    expect(output).toContain('Usage:');
  });
});
