import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { compileEmailTemplate } from 'inline-email';

const html = readFileSync(new URL('./launch.html', import.meta.url), 'utf8');
const css = 'body { font-family: Arial, Helvetica, sans-serif; } .headline { font-size: 24px; color: #111827; }';

const compiled = await compileEmailTemplate({
  subject: '{{headline}}',
  html,
  css,
  text: '{{headline}}. See what is new at {{launchUrl}}.',
  juice: {
    webResources: {
      images: true,
      strict: true,
      relativeTo: fileURLToPath(new URL('.', import.meta.url))
    }
  },
  handlebars: {
    helpers: {
      shout: (value) => String(value).toUpperCase(),
      badge: (value) => {
        const label = Handlebars.escapeExpression(value);
        return new Handlebars.SafeString(
          `<span style="background:#246BFE;color:#ffffff;padding:2px 8px;border-radius:4px;">${label}</span>`
        );
      }
    },
    partials: {
      signature: '<p style="color:#6b7280;">The ACME team</p>'
    }
  }
});

const email = compiled.render({
  data: {
    headline: 'ACME Launch Week is here',
    plan: 'Pro',
    body: 'Five new features land this week, one each day.',
    launchUrl: 'https://acme.example/launch'
  }
});

console.log(JSON.stringify(email, null, 2));
