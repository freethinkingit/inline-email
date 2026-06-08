import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileEmailTemplate } from '../../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const template = readFileSync(join(rootDir, 'examples', 'auth', 'welcome-verify.html'), 'utf8');
const css = readFileSync(join(rootDir, 'examples', 'auth', 'shared.css'), 'utf8');

async function main() {
  const welcomeVerify = await compileEmailTemplate({
    subject: 'Verify your ACME email, {{firstName}}',
    html: template,
    css,
    text: 'Hi {{firstName}}, verify your email: {{verifyUrl}}'
  });

  const email = welcomeVerify.render({
    data: {
      appUrl: 'https://app.acme.example',
      brandUrl: 'https://acme.example',
      expiresIn: '30 minutes',
      firstName: 'Dan',
      verifyUrl: 'https://app.acme.example/auth/verify?token=welcome-token',
      welcomeImageUrl: 'https://images.acme.example/welcome.png?messageId=msg_123&recipient=dan'
    }
  });

  await sendEmail({
    to: 'dan@example.com',
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}

async function sendEmail(message) {
  console.log('Ready to send email:');
  console.log(JSON.stringify({
    to: message.to,
    subject: message.subject,
    htmlBytes: Buffer.byteLength(message.html),
    text: message.text
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
