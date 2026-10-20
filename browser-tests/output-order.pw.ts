import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'buffer';
import type { PoolSnapshot } from '../src/sapling/pool-protocol';
import type { OrderAction, OrderResponse, OrderVariant } from '../src/sapling/order-protocol';
import { readOrderTransaction } from '../src/sapling/order-wire';

for (const variant of ['baseline', 'candidate-default', 'candidate-randomized'] as const) {
  test(`${variant}: preserves public SDK payment behavior and validates moved outputs with Octez`, async ({
    page,
    request,
    baseURL,
  }, info) => {
    test.setTimeout(900_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('./experiments/output-order/index.html');
    const workerAsset = (await readdir('dist/assets')).find((name) =>
      /^order.worker-.*\.js$/.test(name),
    );
    expect(workerAsset).toBeDefined();
    const worker = await page.evaluateHandle(
      (url) => new Worker(url, { type: 'module' }),
      new URL('assets/' + workerAsset, baseURL).href,
    );
    const act = async (action: OrderAction, snapshot: PoolSnapshot) =>
      worker.evaluate(
        (instance, input) =>
          new Promise<OrderResponse>((resolve, reject) => {
            instance.onmessage = ({ data }: MessageEvent<OrderResponse>) => {
              if (data.error) reject(new Error(data.error));
              else resolve(data);
            };
            instance.onerror = () => reject(new Error('Experiment worker failed'));
            instance.postMessage(input);
          }),
        {
          action,
          snapshot,
          variant: variant as OrderVariant,
          parameterBaseUrl: new URL('__sapling/params/', baseURL).href,
        },
      );
    const creation = await request.post('./__sapling/pool/create', { data: {} });
    expect(creation.ok(), await creation.text()).toBe(true);
    const session = (await creation.json()) as { id: string; snapshot: PoolSnapshot };
    let snapshot = session.snapshot;
    const evidence: unknown[] = [];
    const submit = async (transactionHex: string, amountMutez: string, accepted = true) => {
      const before = snapshot;
      const response = await request.post('./__sapling/pool/submit', {
        data: { id: session.id, version: snapshot.version, transactionHex, amountMutez },
      });
      expect(response.ok(), await response.text()).toBe(true);
      const result = (await response.json()) as {
        accepted: boolean;
        snapshot: PoolSnapshot;
        operationHash?: string;
      };
      expect(result.accepted).toBe(accepted);
      if (!accepted) expect(result.snapshot).toEqual(before);
      else expect(result.operationHash).toMatch(/^o[1-9A-HJ-NP-Za-km-z]+$/);
      snapshot = result.snapshot;
      return result;
    };
    const expectedBalances: Record<Exclude<OrderAction, 'observe'>, string[]> = {
      seed: ['10000000', '0', '0'],
      'multi-seed': ['6000000', '4000000', '0'],
      transfer: ['7000000', '3000000', '0'],
      'change-spend': ['0', '3000000', '7000000'],
      withdraw:
        variant === 'candidate-default' ? ['7000000', '1000000', '0'] : ['0', '1000000', '7000000'],
      'exact-multi': ['2000000', '6000000', '0'],
      multi: ['3000000', '4000000', '1000000'],
    };
    const actions: Exclude<OrderAction, 'observe'>[] =
      variant === 'candidate-default'
        ? ['seed', 'transfer', 'withdraw']
        : ['seed', 'transfer', 'change-spend', 'withdraw', 'exact-multi', 'multi'];
    for (const action of actions) {
      const beforeCount = snapshot.diff.commitments_and_ciphertexts.length;
      let prepared = await act(action, snapshot);
      let attempts = 1;
      if (variant === 'candidate-randomized' && action === 'transfer') {
        // Select a real moved-change case for compatibility, never for the unbiased privacy corpus.
        while (prepared.preview!.notes[0]![0]!.position !== beforeCount && attempts < 32) {
          prepared = await act(action, snapshot);
          attempts++;
        }
        expect(prepared.preview!.notes[0]![0]!.position).toBe(beforeCount);
      }
      const transactionHex = prepared.transactionHex!;
      const parsed = readOrderTransaction(transactionHex);
      expect(parsed.root).toBe(snapshot.diff.root);
      expect(parsed.balance).toBe(
        action === 'seed' ? '-10000000' : action === 'withdraw' ? '2000000' : '0',
      );
      if (action === 'seed' || action === 'change-spend') expect(parsed.outputs).toHaveLength(1);
      if (action === 'exact-multi' || action === 'transfer') expect(parsed.outputs).toHaveLength(2);
      if (action === 'multi') expect(parsed.outputs).toHaveLength(3);
      if (action === 'withdraw')
        expect(parsed.boundData).toBe('050a0000001500e7670f32038107a59a2b9cfefae36ea21f5aa63c');
      if (action === 'transfer') {
        const first = parsed.slices[0]!;
        const second = parsed.slices[1]!;
        const bytes = Buffer.from(transactionHex, 'hex');
        const permutedAfterSigning = Buffer.concat([
          bytes.subarray(0, first.start),
          bytes.subarray(second.start, second.end),
          bytes.subarray(first.start, first.end),
          bytes.subarray(second.end),
        ]).toString('hex');
        await submit(permutedAfterSigning, '0', false);
      }
      if (action === 'withdraw') {
        const changedRecipient = Buffer.from(transactionHex, 'hex');
        changedRecipient[changedRecipient.length - 1]! ^= 1;
        await submit(changedRecipient.toString('hex'), '0', false);
      }
      const applied = await submit(transactionHex, action === 'seed' ? '10000000' : '0');
      const view = (await act('observe', snapshot)).view!;
      expect(view.balances).toEqual(expectedBalances[action]);
      expect(snapshot.poolMutez).toBe(
        actions.indexOf(action) >= actions.indexOf('withdraw') ? '8000000' : '10000000',
      );
      const actualNewNotes = view.notes.map((notes) =>
        notes.filter((note) => note.position >= beforeCount),
      );
      expect(actualNewNotes).toEqual(prepared.preview!.notes);
      if (action === 'transfer')
        expect(actualNewNotes[1]![0]).toMatchObject({ value: '3000000', memo: 'pay é' });
      if (action === 'exact-multi') {
        expect(actualNewNotes[0]![0]).toMatchObject({ value: '2000000', memo: 'exact A' });
        expect(actualNewNotes[1]![0]).toMatchObject({ value: '5000000', memo: 'exact B' });
      }
      if (action === 'multi') {
        expect(actualNewNotes[0]![0]).toMatchObject({ value: '1000000', memo: 'multi A' });
        expect(actualNewNotes[2]![0]).toMatchObject({ value: '1000000', memo: 'multi C' });
      }
      evidence.push({
        action,
        attempts,
        accepted: applied.accepted,
        operationHash: applied.operationHash,
        transactionHex,
        view,
        public: snapshot,
      });
      console.log(`${variant}: ${action} accepted with balances ${view.balances.join('/')}`);
    }
    expect(snapshot.recipientMutez).toBe('2000000');
    expect(pageErrors).toEqual([]);
    await worker.evaluate((instance) => instance.terminate());
    await writeFile(
      info.outputPath('output-order-evidence.json'),
      JSON.stringify({ variant, evidence }, null, 2),
    );
  });
}
