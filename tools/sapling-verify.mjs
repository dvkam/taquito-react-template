import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const contract = fileURLToPath(new URL('./verify-shield.tz', import.meta.url));
const expectedBinaryHash = '2e03901db6e0eab373e16ecf1d37055f6adf8a300a3cbed449eb61e45a511b63';
const expectedProtocol = 'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu';
const defaultChain = 'NetXynUjJNZm7wi';
const defaultContract = 'KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC';
export async function verifyTransaction({
  transactionHex,
  contractAddress = defaultContract,
  chainId = defaultChain,
}) {
  if (
    typeof transactionHex !== 'string' ||
    !/^(?:[0-9a-fA-F]{2})+$/.test(transactionHex) ||
    transactionHex.length > 20000
  )
    throw new Error('Expected a small hexadecimal shield transaction');
  if (!/^KT1[1-9A-HJ-NP-Za-km-z]{33}$/.test(contractAddress))
    throw new Error('Invalid contract address');
  const binary = process.env.SAPLING_OCTEZ_CLIENT || resolve(root, '.cache/sapling/octez-client');
  const state = process.env.SAPLING_MOCKUP_DIR || resolve(root, '.cache/sapling/mockup');
  const env = {
    ...process.env,
    XDG_DATA_DIRS: process.env.SAPLING_PARAMS_PARENT || resolve(root, '.cache/sapling'),
  };
  const options = { env, timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true };
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(binary)) digest.update(bytes);
  if (digest.digest('hex') !== expectedBinaryHash)
    throw new Error('Octez binary SHA-256 does not match the pinned release');
  const args = ['--base-dir', state, '--mode', 'mockup'];
  const { stdout: actualChain } = await exec(
    binary,
    [...args, 'rpc', 'get', '/chains/main/chain_id'],
    options,
  );
  if (JSON.parse(actualChain.trim()) !== chainId)
    throw new Error('Requested chain differs from mockup chain');
  const { stdout: protocols } = await exec(
    binary,
    [...args, 'rpc', 'get', '/chains/main/blocks/head/protocols'],
    options,
  );
  const protocol = JSON.parse(protocols).next_protocol;
  if (protocol !== expectedProtocol)
    throw new Error('Mockup protocol does not match pinned Tallinn');
  try {
    const { stdout } = await exec(
      binary,
      [
        ...args,
        'run',
        'script',
        contract,
        'on',
        'storage',
        'Pair 0x (Pair 0 {})',
        'and',
        'input',
        '0x' + transactionHex,
        '--self-address',
        contractAddress,
        '--amount',
        '0.000001',
        '--balance',
        '0',
      ],
      options,
    );
    const match = stdout.match(/storage\s+\(Pair (0x[0-9a-fA-F]*) (-?\d+) \d+\)/);
    if (!match)
      throw new Error('Octez returned an unexpected storage result: ' + stdout.slice(0, 500));
    return { accepted: true, protocol, boundData: match[1].slice(2), balance: match[2] };
  } catch (error) {
    if (error.code === 1 && String(error.stderr).includes('INVALID_SAPLING_PROOF'))
      return { accepted: false, protocol, reason: 'verification-failed' };
    if (error.code === 1 && String(error.stderr).includes('expected a valid Sapling transaction'))
      return { accepted: false, protocol, reason: 'invalid-encoding' };
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  console.log(
    JSON.stringify(
      await verifyTransaction({
        ...input,
        transactionHex: input.transactionHex ?? input.transaction,
      }),
    ),
  );
}
