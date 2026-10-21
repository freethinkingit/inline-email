import { readFileSync } from 'node:fs';
import { compileEmailTemplate } from 'inline-email';

const html = readFileSync(new URL('./welcome.html', import.meta.url), 'utf8');
const css = '.headline { font-size: 24px; color: #111827; }';

const compiled = await compileEmailTemplate({
  subject: 'Welcome to ACME, {{firstName}}',
  html,
  css,
  text: 'Hi {{firstName}}, welcome to ACME. Open it at {{appUrl}}.'
});

const email = compiled.render({
  data: {
    firstName: 'Dan',
    appUrl: 'https://app.acme.example',
    items: ['Create a project', 'Invite a teammate', 'Connect your calendar'],
    slots: {
      summary: '<p>Your account is ready.</p>'
    }
  }
});

console.log(JSON.stringify(email, null, 2));
