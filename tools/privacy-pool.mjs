import { execFile } from 'node:child_process';
import { createPoolSession } from './pool-session.mjs';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const protocol = 'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu';
const payer = 'tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx';
const recipient = 'tz1gjaF81ZRRvdzjobyfVNsAeSC6PScjfQwN';
export async function createPool() {
  const binary = resolve(root, '.cache/sapling/octez-client');
  const hash = createHash('sha256')
    .update(await readFile(binary))
    .digest('hex');
  if (hash !== '2e03901db6e0eab373e16ecf1d37055f6adf8a300a3cbed449eb61e45a511b63')
    throw new Error('Unexpected Octez binary');
  const directory = await mkdtemp(resolve(root, '.cache/sapling/pool-'));
  const args = ['--base-dir', directory, '--mode', 'mockup'];
  const options = {
    env: { ...process.env, XDG_DATA_DIRS: resolve(root, '.cache/sapling') },
    timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  };
  const run = async (tail) => (await exec(binary, [...args, ...tail], options)).stdout;
  const rpc = async (path) => JSON.parse(await run(['rpc', 'get', path]));
  await run(['--protocol', protocol, 'create', 'mockup']);
  const actualProtocol = await rpc('/chains/main/blocks/head/protocols');
  if (actualProtocol.next_protocol !== protocol) throw new Error('Unexpected protocol');
  const origin = await run([
    'originate',
    'contract',
    'privacy-pool',
    'transferring',
    '0',
    'from',
    'bootstrap1',
    'running',
    resolve(root, 'tools/privacy-pool.tz'),
    '--init',
    '{}',
    '--burn-cap',
    '1',
  ]);
  const contractAddress = origin.match(/New contract (KT1\w+) originated/)?.[1];
  if (!contractAddress) throw new Error('Missing originated pool');
  const chainId = await rpc('/chains/main/chain_id');
  const prefix = '/chains/main/blocks/head/context/contracts/';
  const balance = (address) => rpc(prefix + address + '/balance');
  const initialPayer = BigInt(await balance(payer));
  const initialRecipient = BigInt(await balance(recipient));
  let deposited = 0n;
  async function snapshot() {
    // Session serialization keeps these reads coherent. Mockup has no external actors.
    const [diff, storage, poolMutez, recipientBalance, payerBalance] = await Promise.all([
      rpc(prefix + contractAddress + '/single_sapling_get_diff'),
      rpc(prefix + contractAddress + '/storage'),
      balance(contractAddress),
      balance(recipient),
      balance(payer),
    ]);
    const recipientMutez = (BigInt(recipientBalance) - initialRecipient).toString();
    const payerSpentMutez = (initialPayer - BigInt(payerBalance)).toString();
    return {
      chainId,
      contractAddress,
      protocol,
      diff,
      storage,
      poolMutez,
      recipient,
      recipientMutez,
      payer,
      payerSpentMutez,
      feesAndStorageMutez: (BigInt(payerSpentMutez) - deposited).toString(),
      depositedMutez: deposited.toString(),
    };
  }
  return createPoolSession(snapshot, async (input) => {
    const before = await snapshot();
    const amount = BigInt(input.amountMutez);
    const tez = `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, '0')}`;
    let output;
    try {
      output = await run([
        'transfer',
        tez,
        'from',
        'bootstrap1',
        'to',
        contractAddress,
        '--arg',
        '{ 0x' + input.transactionHex + ' }',
        '--burn-cap',
        '5',
      ]);
    } catch (error) {
      // Only protocol execution failures are expected rejections. Infrastructure errors escape.
      if (
        error.code !== 1 ||
        !/script reached FAILWITH instruction|invalid Sapling transaction|expected a valid Sapling transaction/i.test(
          String(error.stderr),
        )
      )
        throw error;
      const after = await snapshot();
      if (JSON.stringify(after) !== JSON.stringify(before))
        throw new Error('REJECTED_CALL_CHANGED_STATE');
      return { accepted: false, reason: 'protocol-rejected' };
    }
    if (!output.includes('This transaction was successfully applied'))
      throw new Error('Unexpected transfer result');
    deposited += amount;
    return {
      accepted: true,
      operationHash: output.match(/Operation hash is '(\w+)'/)?.[1],
    };
  });
}
