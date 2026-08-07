/**
 * Tiny static server for local development.
 *
 * getUserMedia needs a secure context, and http://localhost counts as one, so
 * `npm run dev` then open http://localhost:8080/demo/.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // There is no page at the root, so send visitors to the one they want.
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/demo/' }).end();
    return;
  }

  let path = join(ROOT, normalize(decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    let info = await stat(path);
    if (info.isDirectory()) {
      path = join(path, 'index.html');
      info = await stat(path);
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-cache',
    });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Run it somewhere else, for example:\n` +
        `  PORT=8090 npm run serve`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Test page: http://localhost:${PORT}/demo/`);
});
