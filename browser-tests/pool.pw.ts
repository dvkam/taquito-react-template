import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import type { PoolAction, PoolResponse, PoolSnapshot } from '../src/sapling/pool-protocol';

test('funded pool preserves backing and atomically rejects invalid calls', async ({
  page,
  request,
  baseURL,
}, info) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  const params: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (item) => {
    if (item.url().endsWith('.params')) params.push(item.url());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click();
  const assets = await readdir('dist/assets');
  const asset = assets.find((name) => /^pool.worker-.*\.js$/.test(name));
  expect(asset).toBeDefined();
  const worker = await page.evaluateHandle(
    (url) => new Worker(url, { type: 'module' }),
    new URL('assets/' + asset, baseURL).href,
  );
  const act = async (action: PoolAction, snapshot: PoolSnapshot) =>
    worker.evaluate(
      (instance, input) =>
        new Promise<PoolResponse>((resolve, reject) => {
          instance.onmessage = ({ data }: MessageEvent<PoolResponse>) => {
            if (data.error) reject(new Error(data.error));
            else resolve(data);
          };
          instance.onerror = () => reject(new Error('Worker crashed'));
          instance.postMessage(input);
        }),
      { action, snapshot, parameterBaseUrl: new URL('__sapling/params/', baseURL).href },
    );
  const created = await request.post('./__sapling/pool/create', { data: {} });
  expect(created.ok()).toBe(true);
  const session = (await created.json()) as { id: string; snapshot: PoolSnapshot };
  let snapshot = session.snapshot;
  const initial = await act('observe', snapshot);
  expect(initial.view).toMatchObject({
    aliceMutez: '0',
    bobMutez: '0',
    unrelatedMutez: '0',
    unrelatedIncomingCount: 0,
  });
  expect(params).toEqual([]);
  const evidence: unknown[] = [];
  const submit = async (transactionHex: string, amountMutez: string, accepted: boolean) => {
    const before = snapshot;
    const response = await request.post('./__sapling/pool/submit', {
      data: { id: session.id, version: snapshot.version, transactionHex, amountMutez },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const result = (await response.json()) as { accepted: boolean; snapshot: PoolSnapshot };
    expect(result.accepted).toBe(accepted);
    if (!accepted) expect(result.snapshot).toEqual(before);
    snapshot = result.snapshot;
    evidence.push({ amountMutez, accepted, snapshot });
  };
  console.log('Viewing-only state checked without parameter downloads.');
  const shield = (await act('shield', snapshot)).transactionHex!;
  const shieldBytes = Buffer.from(shield, 'hex');
  // Protocol layout fixtures: empty spends, one memo-8 output, signed -10M mutez.
  expect(shieldBytes.subarray(0, 8).toString('hex')).toBe('00000000000001f3');
  expect(shieldBytes.subarray(-44, -36).toString('hex')).toBe('ffffffffff676980');
  await submit(shield, '9999999', false);
  await submit(shield, '10000001', false);
  const corrupted = Buffer.from(shieldBytes);
  corrupted.fill(0, 40, 232);
  await submit(corrupted.toString('hex'), '10000000', false);
  await submit(shield, '10000000', true);
  expect(snapshot.poolMutez).toBe('10000000');
  expect((await act('observe', snapshot)).view).toMatchObject({
    aliceMutez: '10000000',
    bobMutez: '0',
    unrelatedMutez: '0',
    unrelatedIncomingCount: 0,
  });
  console.log('Funded shield accepted; invalid deposits preserved state.');
  const transfer = (await act('transfer', snapshot)).transactionHex!;
  expect(Buffer.from(transfer, 'hex').subarray(-44, -36).toString('hex')).toBe('0000000000000000');
  await submit(transfer, '1', false);
  const staleVersion = snapshot.version;
  await submit(transfer, '0', true);
  expect(snapshot.poolMutez).toBe('10000000');
  const viewAfterTransfer = (await act('observe', snapshot)).view;
  expect(viewAfterTransfer).toMatchObject({
    aliceMutez: '7000000',
    bobMutez: '3000000',
    unrelatedMutez: '0',
    unrelatedIncomingCount: 0,
  });
  expect(viewAfterTransfer!.bobMemos).toContain('gift é');
  // Current version makes this a protocol replay check, not just the local stale guard.
  await submit(transfer, '0', false);
  const stale = await request.post('./__sapling/pool/submit', {
    data: { id: session.id, version: staleVersion, transactionHex: transfer, amountMutez: '0' },
  });
  expect(stale.status()).toBe(409);
  console.log('Private transfer accepted; duplicate spend rejected.');
  const unshield = (await act('unshield', snapshot)).transactionHex!;
  const unshieldBytes = Buffer.from(unshield, 'hex');
  // Independent fixture from Octez hash data of type key_hash, not the SDK packer.
  expect(unshieldBytes.subarray(-31, -27).toString('hex')).toBe('0000001b');
  expect(unshieldBytes.subarray(-27).toString('hex')).toBe(
    '050a0000001500e7670f32038107a59a2b9cfefae36ea21f5aa63c',
  );
  expect(unshieldBytes.subarray(-71, -63).toString('hex')).toBe('00000000001e8480');
  const changedRecipient = Buffer.from(unshieldBytes);
  changedRecipient[changedRecipient.length - 1]! ^= 1;
  await submit(changedRecipient.toString('hex'), '0', false);
  await submit(unshield, '1', false);
  await submit(unshield, '0', true);
  await submit(unshield, '0', false);
  const finalView = (await act('observe', snapshot)).view;
  expect(finalView).toMatchObject({
    aliceMutez: '7000000',
    bobMutez: '1000000',
    unrelatedMutez: '0',
    unrelatedIncomingCount: 0,
  });
  expect(snapshot.poolMutez).toBe('8000000');
  expect(snapshot.recipientMutez).toBe('2000000');
  expect(snapshot.diff.nullifiers).toHaveLength(2);
  expect(snapshot.payer).not.toBe(snapshot.recipient);
  expect(
    evidence.filter(
      (row) =>
        typeof row === 'object' && row !== null && 'accepted' in row && row.accepted === true,
    ),
  ).toHaveLength(3);
  expect(BigInt(snapshot.payerSpentMutez) - 10_000_000n).toBe(BigInt(snapshot.feesAndStorageMutez));
  expect(BigInt(snapshot.feesAndStorageMutez)).toBeGreaterThan(0n);
  expect(errors).toEqual([]);
  await worker.evaluate((instance) => instance.terminate());
  await writeFile(
    info.outputPath('pool-evidence.json'),
    JSON.stringify({ initial, finalView, evidence }, null, 2),
  );
});

test('the local payment control completes the funded cycle', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Sapling lab' }).click();
  await page.getByRole('button', { name: 'Run local payment cycle' }).click();
  await expect(page.getByRole('button', { name: 'Run local payment cycle' })).toBeDisabled();
  await expect(page.getByText('Local payment cycle verified.')).toBeVisible({ timeout: 240_000 });
  await expect(page.getByText('7000000 mutez', { exact: true })).toBeVisible();
  await expect(page.getByText('1000000 mutez', { exact: true })).toBeVisible();
  await expect(page.getByText('8000000 mutez', { exact: true })).toBeVisible();
  await expect(page.getByText('2000000 mutez', { exact: true })).toBeVisible();
});
