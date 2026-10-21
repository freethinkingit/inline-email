import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileEmailTemplate } from 'inline-email';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

const compiled = await compileEmailTemplate({
  subject: 'Welcome to ACME, {{firstName}}',
  html: read('./welcome.html'),
  css: read('./shared.css'),
  text: 'Hi {{firstName}}, your workspace is ready: {{dashboardUrl}}',
  strict: true
});

const data = {
  firstName: 'Ada',
  dashboardUrl: 'https://app.acme.example/dashboard',
  slots: { summary: '<p>You have <strong>3</strong> projects waiting.</p>' }
};

describe('welcome email', () => {
  it('renders the name and the summary slot', () => {
    const email = compiled.render({ data });

    expect(email.subject).toBe('Welcome to ACME, Ada');
    expect(email.html).toContain('Hi Ada, your workspace is ready.');
    expect(email.html).toContain('<strong>3</strong> projects waiting');
  });

  it('throws when firstName is missing', () => {
    const { firstName, ...missingName } = data;

    expect(() => compiled.render({ data: missingName })).toThrow(/"firstName" not defined/);
  });

  it('inserts the slot raw and escapes variables', () => {
    const email = compiled.render({ data: { ...data, firstName: '<b>Ada</b>' } });

    expect(email.html).toContain('<p>You have <strong>3</strong> projects waiting.</p>');
    expect(email.html).toContain('&lt;b&gt;Ada&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Ada</b>');
  });
});
