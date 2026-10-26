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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const response = (body: unknown) => ({ ok: true, json: async () => body });
const states = [
  snapshot,
  { ...snapshot, version: 1 },
  { ...snapshot, version: 2 },
  { ...snapshot, version: 3, poolMutez: '8000000', recipientMutez: '2000000' },
];
const successfulView = {
  aliceMutez: '7000000',
  bobMutez: '1000000',
  unrelatedMutez: '0',
  unrelatedIncomingCount: 0,
  aliceMemos: ['PRIVATE_ALICE'],
  bobMemos: ['PRIVATE_BOB'],
};
function mockCycle(finalSubmit?: Promise<unknown>) {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ id: 'local', snapshot }));
  for (let i = 1; i <= 3; i++) {
    if (i === 3 && finalSubmit) fetchMock.mockReturnValueOnce(finalSubmit);
    else
      fetchMock.mockResolvedValueOnce(
        response({ accepted: true, snapshot: states[i], operationHash: `op-${i}` }),
      );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
it('does not prepare a proof after an inactive create reply', async () => {
  const pending = deferred<ReturnType<typeof response>>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending.promise));
  const worker = { act: vi.fn(), dispose: vi.fn() };
  let active = true;
  const running = runPoolCycle(worker, vi.fn(), () => active);
  active = false;
  pending.resolve(response({ id: 'local', snapshot }));
  await expect(running).resolves.toBeNull();
  expect(worker.act).not.toHaveBeenCalled();
});
it('does not observe after an inactive final submit reply', async () => {
  const pending = deferred<ReturnType<typeof response>>();
  const fetchMock = mockCycle(pending.promise);
  const worker = { act: vi.fn().mockResolvedValue({ transactionHex: 'abcd' }), dispose: vi.fn() };
  let active = true;
  const running = runPoolCycle(worker, vi.fn(), () => active);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  active = false;
  pending.resolve(response({ accepted: true, snapshot: states[3], operationHash: 'op-3' }));
  await expect(running).resolves.toBeNull();
  expect(worker.act.mock.calls.map(([action]) => action)).toEqual([
    'shield',
    'transfer',
    'unshield',
  ]);
});
it('discards a decrypted observation after the view becomes inactive', async () => {
  mockCycle();
  const pending = deferred<{ view: typeof successfulView }>();
  const worker = {
    act: vi
      .fn()
      .mockResolvedValue({ transactionHex: 'abcd' })
      .mockImplementationOnce(async () => ({ transactionHex: 'abcd' }))
      .mockImplementationOnce(async () => ({ transactionHex: 'abcd' }))
      .mockImplementationOnce(async () => ({ transactionHex: 'abcd' }))
      .mockReturnValueOnce(pending.promise),
    dispose: vi.fn(),
  };
  let active = true;
  const running = runPoolCycle(worker, vi.fn(), () => active);
  await vi.waitFor(() => expect(worker.act).toHaveBeenCalledTimes(4));
  active = false;
  pending.resolve({ view: successfulView });
  await expect(running).resolves.toBeNull();
});
it('retains only public checkpoints and uses public-safe progress throughout the cycle', async () => {
  mockCycle();
  const worker = {
    act: vi
      .fn()
      .mockResolvedValueOnce({ transactionHex: 'a' })
      .mockResolvedValueOnce({ transactionHex: 'b' })
      .mockResolvedValueOnce({ transactionHex: 'c' })
      .mockResolvedValueOnce({ view: successfulView }),
    dispose: vi.fn(),
  };
  const stage = vi.fn();
  const result = await runPoolCycle(worker, stage, () => true);
  expect(result!.publicHistory).toHaveLength(4);
  expect(result!.publicHistory[3]!.operationHash).toBe('op-3');
  expect(JSON.stringify(result!.publicHistory)).not.toMatch(/PRIVATE|aliceMutez|bobMutez/);
  expect(stage.mock.calls.flat().join(' ')).not.toMatch(/Alice|Bob|private 3|gift/);
});
it('retains the public receipt if an accepted snapshot belongs to a different pool', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(response({ id: 'local', snapshot }))
      .mockResolvedValueOnce(
        response({
          accepted: true,
          snapshot: { ...states[1], contractAddress: 'different' },
          operationHash: 'applied-public-receipt',
        }),
      ),
  );
  const worker = { act: vi.fn().mockResolvedValue({ transactionHex: 'abcd' }), dispose: vi.fn() };
  await expect(runPoolCycle(worker, vi.fn(), () => true)).rejects.toThrow(
    'Applied locally: applied-public-receipt',
  );
  expect(worker.act).toHaveBeenCalledOnce();
});
