import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';
import { makeTempDir } from './support/temp-dir.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serveScript = join(__dirname, '..', 'scripts', 'serve-examples.js');

type Reply = { status: number; body: string };

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

// The script serves the examples/out folder next to its own scripts folder, so a copy of it in a
// temp project serves that project's output and can sit beside a sibling examples/out2 folder.
async function startServer(): Promise<number> {
  const projectDir = makeTempDir('inline-email-serve-');
  const scriptsDir = join(projectDir, 'scripts');
  const outputDir = join(projectDir, 'examples', 'out');
  const siblingDir = join(projectDir, 'examples', 'out2');
  mkdirSync(scriptsDir);
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(siblingDir);
  copyFileSync(serveScript, join(scriptsDir, 'serve-examples.js'));
  writeFileSync(join(outputDir, 'index.html'), '<h1>examples</h1>', 'utf8');
  writeFileSync(join(siblingDir, 'secret.html'), 'not an example', 'utf8');

  const port = await findFreePort();
  const server = spawn(process.execPath, [join(scriptsDir, 'serve-examples.js')], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  onTestFinished(() => {
    server.kill();
  });

  await new Promise<void>((resolve, reject) => {
    server.stdout.once('data', () => resolve());
    server.once('exit', (code) => reject(new Error(`serve-examples exited with code ${code} before listening`)));
  });
  return port;
}

function request(port: number, path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

describe('serve-examples', () => {
  it('serves the examples index at the root', async () => {
    const port = await startServer();

    expect(await request(port, '/')).toEqual({ status: 200, body: '<h1>examples</h1>' });
  });

  it('answers a malformed URL with 404 and keeps serving', async () => {
    const port = await startServer();

    expect(await request(port, '/%E0')).toEqual({ status: 404, body: 'Not found' });
    expect((await request(port, '/index.html')).status).toBe(200);
  });

  it('refuses a file in a sibling folder whose name starts with out', async () => {
    const port = await startServer();

    expect(await request(port, '/..%2fout2/secret.html')).toEqual({ status: 404, body: 'Not found' });
  });
});
