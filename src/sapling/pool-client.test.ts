import { afterEach, expect, it, vi } from 'vitest';
import { createPoolWorker, runPoolCycle } from './pool-client';
import type { PoolSnapshot } from './pool-protocol';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
const snapshot: PoolSnapshot = {
  version: 0,
  contractAddress: 'local-pool',
  chainId: 'local-chain',
  diff: { root: '', commitments_and_ciphertexts: [], nullifiers: [] },
  poolMutez: '0',
  recipient: 'local-recipient',
  recipientMutez: '0',
  payer: 'local-payer',
  payerSpentMutez: '0',
  feesAndStorageMutez: '0',
};
afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

it('settles pending work and forbids reuse after disposal', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const worker = createPoolWorker();
  const pending = worker.act('observe', snapshot);
  worker.dispose();
  await expect(pending).rejects.toThrow('Pool worker stopped');
  await expect(worker.act('observe', snapshot)).rejects.toThrow('Pool worker stopped');
  expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
});

it('rejects overlapping requests and recovers after a failed message send', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const worker = createPoolWorker();
  const instance = FakeWorker.instances[0]!;
  instance.postMessage.mockImplementationOnce(() => {
    throw new Error('send failed');
  });
  await expect(worker.act('observe', snapshot)).rejects.toThrow('send failed');
  const retry = worker.act('observe', snapshot);
  await expect(worker.act('shield', snapshot)).rejects.toThrow('Worker busy');
  instance.onmessage!(new MessageEvent('message', { data: { transactionHex: 'abcd' } }));
  await expect(retry).resolves.toEqual({ transactionHex: 'abcd' });
  worker.dispose();
});

it('retains the confirmed operation receipt when state refresh fails', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'local-session', snapshot }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accepted: true,
        snapshot: null,
        operationHash: 'known-local-operation',
      }),
    });
  vi.stubGlobal('fetch', fetchMock);
  const worker = { act: vi.fn().mockResolvedValue({ transactionHex: 'abcd' }), dispose: vi.fn() };
  await expect(runPoolCycle(worker, vi.fn(), () => true)).rejects.toThrow(
    'Applied locally: known-local-operation. State refresh failed. Do not resubmit.',
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(worker.act).toHaveBeenCalledTimes(1);
});
