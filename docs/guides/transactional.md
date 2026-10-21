# Send a transactional email

This guide builds a welcome email with a slot for trusted HTML, renders it per user, and locks it with a strict-mode test; it takes about 15 minutes.

In your own project, install the library and, for the test, vitest:

```sh
npm install inline-email
npm install -D vitest
```

Save the files below as `welcome.html`, `shared.css`, `send.mjs` and `welcome.test.ts` in one folder.

## The template

The template is HTML built from layout tags such as `<section>`, `<spacer>` and `<button>`. `{{firstName}}` and `{{dashboardUrl}}` are variables. A variable is HTML-escaped, so a name like `<b>Ada</b>` shows as text. `{{slot:summary}}` is a slot. A slot inserts trusted HTML from `data.slots` raw, without escaping. Put only HTML your own code built in a slot, never user input.

```html file=examples/guides/transactional/welcome.html
<email>
  <preview>Welcome to ACME, {{firstName}}. Here is what is ready for you.</preview>
  <container>
    <section padding="36" background="#ffffff">
      <p class="eyebrow">Welcome to ACME</p>
      <h1 class="headline">Hi {{firstName}}, your workspace is ready.</h1>
      <spacer size="18" />
      <div class="summary">{{slot:summary}}</div>
      <spacer size="28" />
      <button href="{{dashboardUrl}}" background="#246BFE">Open your dashboard</button>
    </section>
    <footer padding="24" background="#f7f9fc">
      <p class="muted">You are receiving this because you signed up for ACME.</p>
    </footer>
  </container>
</email>
```

## The styles

The CSS is plain classes. The library inlines it into `style` attributes when the template compiles, not on every send.

```css file=examples/guides/transactional/shared.css
body {
  font-family: Arial, Helvetica, sans-serif;
}

.eyebrow {
  color: #516070;
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 10px;
  text-transform: uppercase;
}

.headline {
  color: #17202a;
  font-size: 28px;
  font-weight: 800;
  margin: 0;
}

.summary {
  color: #344054;
  font-size: 16px;
  line-height: 1.58;
}

.muted {
  color: #667085;
  font-size: 14px;
  margin: 0;
}
```

## Compile once, render per send

`compileEmailTemplate` does the expensive work: layout, CSS inlining and template parsing. Call it once at startup and keep the result. `render` is cheap; call it once per email with that user's data. It returns `{ subject, html, text }`.

```js file=examples/guides/transactional/send.mjs
import { readFileSync } from 'node:fs';
import { compileEmailTemplate } from 'inline-email';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

const compiled = await compileEmailTemplate({
  subject: 'Welcome to ACME, {{firstName}}',
  html: read('./welcome.html'),
  css: read('./shared.css'),
  text: 'Hi {{firstName}}, your workspace is ready: {{dashboardUrl}}',
  strict: true
});

const users = [
  { firstName: 'Ada', projects: 3 },
  { firstName: 'Grace', projects: 2 }
];

const emails = users.map((user) =>
  compiled.render({
    data: {
      firstName: user.firstName,
      dashboardUrl: 'https://app.acme.example/dashboard',
      slots: {
        summary: `<p>You have <strong>${user.projects}</strong> projects waiting.</p>`
      }
    }
  })
);

console.log(JSON.stringify(emails, null, 2));
```

Run it:

```sh
node send.mjs
```

It prints one object per user. This is Ada's, with the HTML trimmed to the lines that carry her data:

```text
subject: Welcome to ACME, Ada
text:    Hi Ada, your workspace is ready: https://app.acme.example/dashboard
html (trimmed):
  <h1 class="headline" style="color: #17202a; font-size: 28px; font-weight: 800; margin: 0;">Hi Ada, your workspace is ready.</h1>
  <div class="summary" style="color: #344054; font-size: 16px; line-height: 1.58;"><p>You have <strong>3</strong> projects waiting.</p></div>
  <a href="https://app.acme.example/dashboard" style="display:inline-block;padding:14px 20px;color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px;">Open your dashboard</a>
```

Grace's email is the same with her name and `2` projects.

## Lock it with strict mode in a test

Both files compile with `strict: true`. Without it, a missing field renders as an empty string, and a typo such as `{{fristName}}` sends "Hi ," to a customer. With it, `render` throws when a variable has no value in the data. The error message starts with `"firstName" not defined`, naming the missing field, and the test below matches that text.

A test that renders the template turns that error into a failing test, so the typo fails in tests, not in a customer's inbox.

```ts file=examples/guides/transactional/welcome.test.ts
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
```

The first test checks the happy path. The second removes `firstName` and expects the throw. The third checks that the slot is raw and the variable is escaped.

Run it with the verbose reporter. The output below has the timings and the `RUN` header line removed, and the test path shortened from `examples/guides/transactional/welcome.test.ts` to `welcome.test.ts` as it would be in your own project:

```sh
npx vitest run welcome.test.ts --reporter=verbose
```

```text
 ✓ welcome.test.ts > welcome email > renders the name and the summary slot
 ✓ welcome.test.ts > welcome email > throws when firstName is missing
 ✓ welcome.test.ts > welcome email > inserts the slot raw and escapes variables

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Two rules of strict mode matter as the template grows:

- A field present as `null` renders empty; only a missing field throws.
- Inside a block such as `{{#each}}`, a name is looked up in the current item only. Reach a value outside it with `{{../name}}` or `{{@root.name}}`.

A missing slot does not throw: `{{slot:summary}}` renders empty, in strict mode too.

Next: [Preview a template from the command line](cli-preview.md), or read [Strict Mode](../reference.md#strict-mode) in the reference.
