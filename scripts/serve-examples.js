import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, '..');
const outputDir = join(rootDir, 'examples', 'out');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

if (!existsSync(join(outputDir, 'index.html'))) {
  console.error('examples/out is missing. Run npm run examples first.');
  process.exit(1);
}

function isServableFile(filePath) {
  return filePath.startsWith(outputDir + sep) && existsSync(filePath) && statSync(filePath).isFile();
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://localhost:${port}`);
  const pathname = url.pathname === '/' ? '/index.html' : decodePathname(url.pathname);
  const filePath = pathname === undefined ? undefined : normalize(join(outputDir, pathname));

  if (filePath === undefined || !isServableFile(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`inline-email examples: http://localhost:${port}/`);
});
