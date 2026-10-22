import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileEmailTemplate } from '../../dist/index.js';

const integrationsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(integrationsDir, '..', '..');
const authExamplesDir = join(rootDir, 'examples', 'auth');
const html = readFileSync(join(authExamplesDir, 'welcome-verify.html'), 'utf8');
const css = readFileSync(join(authExamplesDir, 'shared.css'), 'utf8');

const welcomeData = {
  appUrl: 'https://app.acme.example',
  brandUrl: 'https://acme.example',
  expiresIn: '30 minutes',
  firstName: 'Dan',
  verifyUrl: 'https://app.acme.example/auth/verify?token=welcome-token',
  welcomeImageUrl: 'https://images.acme.example/welcome.png?messageId=msg_123&recipient=dan'
};

async function main() {
  const welcomeVerify = await compileEmailTemplate({
    subject: 'Verify your ACME email, {{firstName}}',
    html,
    css,
    text: 'Hi {{firstName}}, verify your email: {{verifyUrl}}'
  });

  const email = welcomeVerify.render({ data: welcomeData });

  await sendEmail({
    to: 'dan@example.com',
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}

// Stands in for your email provider's send call; it prints a summary of the message instead of sending it.
async function sendEmail(message) {
  const summary = {
    to: message.to,
    subject: message.subject,
    htmlBytes: Buffer.byteLength(message.html),
    text: message.text
  };

  console.log('Ready to send email:');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
