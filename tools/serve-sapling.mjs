import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTransaction } from './sapling-verify.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const params = resolve(
  process.env.SAPLING_PARAMS_PARENT || resolve(root, '.cache/sapling'),
  'zcash-params',
);
const port = Number(process.env.PORT || 4180);
const basePath = process.env.PAGES_BASE_PATH || '/';
if (!basePath.startsWith('/') || !basePath.endsWith('/') || basePath.includes('..'))
  throw new Error('PAGES_BASE_PATH must start and end with /.');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
let verifying = false;

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (
      request.headers.host !== `127.0.0.1:${port}` &&
      request.headers.host !== `localhost:${port}`
    ) {
      return json(response, 403, { error: 'Use the local experiment address.' });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/__sapling/verify')) {
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        return json(response, 403, { error: 'Use the local experiment page.' });
      }
      if (verifying) return json(response, 409, { error: 'A proof is already being checked.' });
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 24_000)
          return json(response, 413, { error: 'Transaction is too large.' });
      }
      const input = JSON.parse(body);
      if (
        !input ||
        typeof input.transactionHex !== 'string' ||
        !/^(?:[0-9a-f]{2})+$/i.test(input.transactionHex) ||
        input.transactionHex.length > 20_000
      ) {
        return json(response, 400, { error: 'Expected hexadecimal transaction bytes.' });
      }
      if (verifying) return json(response, 409, { error: 'A proof is already being checked.' });
      verifying = true;
      try {
        const result = await verifyTransaction({ transactionHex: input.transactionHex });
        return json(response, 200, {
          accepted: result.accepted,
          balance: result.balance ?? null,
          boundData: result.boundData ?? null,
          reason: result.reason ?? null,
          protocol: result.protocol,
        });
      } finally {
        verifying = false;
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return json(response, 405, { error: 'Method not supported.' });
    const parameter = url.pathname.match(/\/__sapling\/params\/(spend|output)\.params$/);
    let path;
    if (parameter) {
      path = resolve(params, `sapling-${parameter[1]}.params`);
    } else {
      if (!url.pathname.startsWith(basePath))
        return json(response, 404, { error: 'File not found.' });
      const relative = '/' + url.pathname.slice(basePath.length);
      path = resolve(dist, '.' + decodeURIComponent(relative === '/' ? '/index.html' : relative));
      if (!path.startsWith(dist + sep)) return json(response, 403, { error: 'Invalid path.' });
    }
    let size;
    try {
      size = (await stat(path)).size;
    } catch {
      return json(response, 404, {
        error: parameter ? 'Run pnpm sapling:setup first.' : 'File not found.',
      });
    }
    response.writeHead(200, {
      'content-type': parameter
        ? 'application/octet-stream'
        : mime[extname(path)] || 'application/octet-stream',
      'content-length': size,
      'cache-control': parameter ? 'public, max-age=3600' : 'no-cache',
    });
    if (request.method === 'HEAD') response.end();
    else
      createReadStream(path)
        .on('error', () => response.destroy())
        .pipe(response);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Experiment server failed.');
    if (!response.headersSent)
      json(response, 500, { error: 'Local verification failed. Check the experiment server.' });
    else response.destroy();
  }
}

await readFile(resolve(dist, 'index.html'));
const server = createServer((request, response) => {
  void handleRequest(request, response);
});
server.listen(port, '127.0.0.1', () => console.log(`Sapling experiment: http://127.0.0.1:${port}`));
process.on('SIGTERM', () => {
  server.close();
  server.closeAllConnections();
});
