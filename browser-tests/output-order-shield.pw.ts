import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import type { PoolSnapshot } from '../src/sapling/pool-protocol';
import type { OrderResponse } from '../src/sapling/order-protocol';
import { readOrderTransaction } from '../src/sapling/order-wire';

for (const variant of ['baseline', 'candidate-randomized'] as const) {
  test(`${variant}: multi-recipient shield preserves values and memos`, async ({
    page,
    request,
    baseURL,
  }, info) => {
    test.setTimeout(900_000);
    await page.goto('./experiments/output-order/index.html');
    const asset = (await readdir('dist/assets')).find((name) => /^order.worker-.*\.js$/.test(name));
    expect(asset).toBeDefined();
    const worker = await page.evaluateHandle(
      (url) => new Worker(url, { type: 'module' }),
      new URL('assets/' + asset, baseURL).href,
    );
    const created = await request.post('./__sapling/pool/create', { data: {} });
    expect(created.ok()).toBe(true);
    const session = (await created.json()) as { id: string; snapshot: PoolSnapshot };
    const act = async (action: 'multi-seed' | 'observe', snapshot: PoolSnapshot) =>
      worker.evaluate(
        (instance, input) =>
          new Promise<OrderResponse>((resolve, reject) => {
            instance.onmessage = ({ data }: MessageEvent<OrderResponse>) => {
              if (data.error) reject(new Error(data.error));
              else resolve(data);
            };
            instance.onerror = () => reject(new Error('Shield experiment worker failed'));
            instance.postMessage(input);
          }),
        { action, snapshot, variant, parameterBaseUrl: new URL('__sapling/params/', baseURL).href },
      );
    let proof = await act('multi-seed', session.snapshot);
    let attempts = 1;
    if (variant === 'candidate-randomized') {
      while (proof.preview!.notes[0]![0]!.position !== 1 && attempts < 32) {
        proof = await act('multi-seed', session.snapshot);
        attempts++;
      }
      expect(proof.preview!.notes[0]![0]!.position).toBe(1);
    } else expect(proof.preview!.notes[0]![0]!.position).toBe(0);
    const parsed = readOrderTransaction(proof.transactionHex!);
    expect(parsed.outputs).toHaveLength(2);
    expect(parsed.balance).toBe('-10000000');
    const applied = await request.post('./__sapling/pool/submit', {
      data: {
        id: session.id,
        version: session.snapshot.version,
        transactionHex: proof.transactionHex,
        amountMutez: '10000000',
      },
    });
    expect(applied.ok(), await applied.text()).toBe(true);
    const result = (await applied.json()) as { accepted: boolean; snapshot: PoolSnapshot };
    expect(result.accepted).toBe(true);
    const view = (await act('observe', result.snapshot)).view!;
    expect(view.balances).toEqual(['6000000', '4000000', '0']);
    expect(view.notes[0]![0]).toMatchObject({ value: '6000000', memo: 'seed A' });
    expect(view.notes[1]![0]).toMatchObject({ value: '4000000', memo: 'seed B' });
    expect(view.notes).toEqual(proof.preview!.notes);
    expect(result.snapshot.poolMutez).toBe('10000000');
    await worker.evaluate((instance) => instance.terminate());
    await writeFile(
      info.outputPath('shield-evidence.json'),
      JSON.stringify(
        {
          variant,
          attempts,
          view,
          snapshot: result.snapshot,
          transactionHex: proof.transactionHex,
        },
        null,
        2,
      ),
    );
  });
}
