import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileEmailTemplate } from '../../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4174);

async function main() {
  const css = readFileSync(join(rootDir, 'examples', 'auth', 'shared.css'), 'utf8');
  const html = readFileSync(join(rootDir, 'examples', 'marketing', 'feature-roundup.html'), 'utf8');
  const template = await compileEmailTemplate({
    subject: 'Three ACME upgrades for {{teamName}}',
    html,
    css
  });

  const server = createServer((request, response) => {
    if (request.url !== '/' && request.url !== '/feature-roundup') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const email = template.render({
      data: {
        appUrl: 'https://app.acme.example',
        brandUrl: 'https://acme.example',
        featureCount: 3,
        featuresUrl: 'https://app.acme.example/features',
        preferencesUrl: 'https://app.acme.example/settings/email',
        teamName: 'Product Operations',
        features: [
          {
            tone: 'info',
            title: 'Shared decision trails',
            description: 'Keep the context behind each decision close to the work it affects.'
          },
          {
            tone: 'success',
            title: 'Reusable handoff checklists',
            description: 'Turn strong workflows into repeatable team habits.'
          },
          {
            tone: 'warning',
            title: 'Attention summaries',
            description: 'Surface stalled work before it becomes a missed deadline.'
          }
        ]
      }
    });

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(email.html);
  });

  server.listen(port, host, () => {
    console.log(`Preview server: http://localhost:${port}/feature-roundup`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
