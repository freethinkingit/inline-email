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
