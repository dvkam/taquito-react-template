import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, chmod, access } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const directory = resolve(fileURLToPath(new URL('../', import.meta.url)), '.cache/sapling');
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('This pinned Octez binary requires Linux x64');
await mkdir(resolve(directory, 'zcash-params'), { recursive: true });
const files = [
  [
    'octez-client',
    'https://gitlab.com/api/v4/projects/3836952/packages/generic/octez-binaries-25.3/25.3/x86_64-octez-client',
    '2e03901db6e0eab373e16ecf1d37055f6adf8a300a3cbed449eb61e45a511b63',
  ],
  [
    'zcash-params/sapling-spend.params',
    'https://sapling.taquito.io/params/groth16-mainnet-1/spend.params',
    '8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13',
  ],
  [
    'zcash-params/sapling-output.params',
    'https://sapling.taquito.io/params/groth16-mainnet-1/output.params',
    '2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4',
  ],
];
async function hash(path) {
  const h = createHash('sha256');
  for await (const bytes of createReadStream(path)) h.update(bytes);
  return h.digest('hex');
}
for (const [name, url, expected] of files) {
  const path = resolve(directory, name);
  let valid = false;
  try {
    valid = (await hash(path)) === expected;
  } catch {}
  if (!valid) {
    const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok || !response.body) throw new Error(`Download failed: ${name}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  }
  if ((await hash(path)) !== expected) throw new Error(`SHA-256 mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
const binary = resolve(directory, 'octez-client');
await chmod(binary, 0o755);
const state = resolve(directory, 'mockup');
let exists = true;
try {
  await access(resolve(state, 'mockup/context.json'));
} catch {
  exists = false;
}
if (!exists)
  await exec(
    binary,
    [
      '--base-dir',
      state,
      '--mode',
      'mockup',
      '--protocol',
      'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu',
      'create',
      'mockup',
    ],
    { timeout: 60000, maxBuffer: 1024 * 1024 },
  );
const contextArgs = ['--base-dir', state, '--mode', 'mockup', 'rpc', 'get'];
const checkedChain = JSON.parse(
  (await exec(binary, [...contextArgs, '/chains/main/chain_id'], { timeout: 60000 })).stdout,
);
const checkedProtocol = JSON.parse(
  (await exec(binary, [...contextArgs, '/chains/main/blocks/head/protocols'], { timeout: 60000 }))
    .stdout,
).next_protocol;
if (
  checkedChain !== 'NetXynUjJNZm7wi' ||
  checkedProtocol !== 'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu'
)
  throw new Error(
    'Existing mockup has a different chain or protocol; use a separate expected context',
  );
console.log((await exec(binary, ['--version'])).stdout.trim());
console.log('Ready for local SAPLING_VERIFY_UPDATE verification.');
