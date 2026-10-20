import { randomUUID } from 'node:crypto';
import { createPool } from './privacy-pool.mjs';
const sessions = new Map();
let creating = false;
export async function poolRequest(request, response, url) {
  if (!url.pathname.includes('/__sapling/pool/')) return false;
  const send = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    send(403, { error: 'Use the local page.' });
    return true;
  }
  if (request.method !== 'POST') {
    send(405, { error: 'Use POST.' });
    return true;
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 48_000) {
      send(413, { error: 'Request too large.' });
      return true;
    }
  }
  try {
    const input = JSON.parse(body || '{}');
    const action = url.pathname.split('/').at(-1);
    if (action === 'create') {
      if (creating || sessions.size >= 12) {
        send(409, { error: 'Local session limit reached. Restart the server.' });
        return true;
      }
      creating = true;
      try {
        const pool = await createPool();
        const id = randomUUID();
        sessions.set(id, pool);
        send(200, { id, snapshot: await pool.snapshot() });
      } finally {
        creating = false;
      }
    } else {
      const pool = sessions.get(input.id);
      if (!pool) {
        send(404, { error: 'Unknown local pool.' });
        return true;
      }
      if (action === 'submit') send(200, await pool.submit(input));
      else if (action === 'snapshot') send(200, await pool.snapshot());
      else send(404, { error: 'Unknown action.' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pool failed';
    console.error(message);
    send(/POOL_BUSY|STALE_POOL_STATE/.test(message) ? 409 : 500, { error: message });
  }
  return true;
}
