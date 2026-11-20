import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProofClient, verifyProof } from './client';
import type { PreparedProof, WorkerRequest } from './protocol';

class FakeWorker extends EventTarget {
  sent: WorkerRequest[] = [];
  terminated = false;
  postMessage(request: WorkerRequest) {
    this.sent.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
const result: PreparedProof = {
  transactionHex: '00ab',
  recipient: 'zet-fixture',
  memo: 'é',
  memoBytes: 2,
  preloadMs: 1,
  proofMs: 2,
  warm: false,
};
const setup = () => {
  const workers: FakeWorker[] = [];
  const stages = vi.fn();
  const client = createProofClient(stages, () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers, stages };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('proof worker client', () => {
  it('starts lazily, reports stages, and reuses successful worker state', async () => {
    const { client, workers, stages } = setup();
    expect(workers).toHaveLength(0);
    const first = client.prepare('é');
    const worker = workers[0]!;
    const id = worker.sent[0]!.id;
    expect(worker.sent[0]).toEqual({
      id,
      memo: 'é',
      parameterBaseUrl: new URL('/__sapling/params/', location.origin).href,
    });
    worker.message({ id, type: 'stage', stage: 'loading' });
    worker.message({ id, type: 'stage', stage: 'proving' });
    worker.message({ id, type: 'result', result });
    await expect(first).resolves.toEqual(result);
    expect(stages.mock.calls).toEqual([['loading'], ['proving']]);
    const second = client.prepare('é');
    expect(workers).toHaveLength(1);
    const nextId = worker.sent[1]!.id;
    worker.message({ id, type: 'result', result });
    worker.message({ id: nextId, type: 'result', result: { ...result, warm: true } });
    await expect(second).resolves.toMatchObject({ warm: true });
    client.dispose();
  });

  it('uses the configured deployment base for parameter delivery', async () => {
    vi.stubEnv('BASE_URL', '/demo/');
    const { client, workers } = setup();
    const pending = client.prepare('é');
    expect(workers[0]!.sent[0]!.parameterBaseUrl).toBe(
      new URL('/demo/__sapling/params/', location.origin).href,
    );
    workers[0]!.message({ id: workers[0]!.sent[0]!.id, type: 'result', result });
    await expect(pending).resolves.toEqual(result);
    client.dispose();
  });

  it('can retry after worker construction fails', async () => {
    const worker = new FakeWorker();
    const factory = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('worker blocked');
      })
      .mockReturnValue(worker);
    const client = createProofClient(vi.fn(), factory);
    await expect(client.prepare('é')).rejects.toThrow('worker blocked');
    const retry = client.prepare('é');
    worker.message({ id: worker.sent[0]!.id, type: 'result', result });
    await expect(retry).resolves.toEqual(result);
    client.dispose();
  });

  it('rejects a failed message send and terminates the worker', async () => {
    const worker = new FakeWorker();
    vi.spyOn(worker, 'postMessage').mockImplementation(() => {
      throw new Error('message send failed');
    });
    const client = createProofClient(vi.fn(), () => worker);
    await expect(client.prepare('é')).rejects.toThrow('message send failed');
    expect(worker.terminated).toBe(true);
    client.dispose();
  });

  it('rejects a second active request without interrupting the first', async () => {
    const { client, workers } = setup();
    const first = client.prepare('é');
    await expect(client.prepare('other')).rejects.toThrow(/already/i);
    expect(workers[0]!.sent).toHaveLength(1);
    workers[0]!.message({ id: workers[0]!.sent[0]!.id, type: 'result', result });
    await expect(first).resolves.toEqual(result);
    client.dispose();
  });

  it.each(['stop', 'dispose'] as const)(
    '%s rejects pending work and terminates the worker',
    async (action) => {
      const { client, workers } = setup();
      const pending = client.prepare('é');
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      client[action]();
      await rejected;
      expect(workers[0]!.terminated).toBe(true);
      if (action === 'stop') {
        const retry = client.prepare('é');
        expect(workers).toHaveLength(2);
        workers[0]!.message({ id: workers[0]!.sent[0]!.id, type: 'result', result });
        workers[1]!.message({ id: workers[1]!.sent[0]!.id, type: 'result', result });
        await expect(retry).resolves.toEqual(result);
      } else {
        await expect(client.prepare('é')).rejects.toThrow(/disposed/i);
      }
      client.dispose();
    },
  );

  it.each([
    null,
    { type: 'stage', stage: 'unknown' },
    { type: 'result', result: { ...result, transactionHex: 'oops' } },
    { type: 'result', result: { ...result, memoBytes: 1 } },
    { type: 'result', result: { ...result, proofMs: Infinity } },
    { type: 'error', message: 12 },
  ])('rejects malformed incoming messages and permits retry: %j', async (data) => {
    const { client, workers } = setup();
    const pending = client.prepare('é');
    const rejected = expect(pending).rejects.toThrow(/invalid/i);
    workers[0]!.message(data === null ? null : { id: workers[0]!.sent[0]!.id, ...data });
    await rejected;
    expect(workers[0]!.terminated).toBe(true);
    const retry = client.prepare('é');
    workers[1]!.message({ id: workers[1]!.sent[0]!.id, type: 'result', result });
    await expect(retry).resolves.toEqual(result);
    client.dispose();
  });

  it.each(['error', 'messageerror'])('rejects a worker %s and can restart', async (event) => {
    const { client, workers } = setup();
    const pending = client.prepare('é');
    const rejected = expect(pending).rejects.toThrow(/worker/i);
    workers[0]!.dispatchEvent(new Event(event));
    await rejected;
    expect(workers[0]!.terminated).toBe(true);
    const retry = client.prepare('é');
    workers[1]!.message({ id: workers[1]!.sent[0]!.id, type: 'result', result });
    await expect(retry).resolves.toEqual(result);
    client.dispose();
  });

  it('returns a reported proof error and resets the worker', async () => {
    const { client, workers } = setup();
    const pending = client.prepare('é');
    const rejected = expect(pending).rejects.toThrow('parameter download failed');
    workers[0]!.message({
      id: workers[0]!.sent[0]!.id,
      type: 'error',
      message: 'parameter download failed',
    });
    await rejected;
    expect(workers[0]!.terminated).toBe(true);
  });
});

describe('independent proof verification client', () => {
  it('posts transaction bytes and returns a validated verification result', async () => {
    const value = { accepted: true, balance: '-1', protocol: 'Tallinn' };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(value)));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    await expect(verifyProof('00ab', controller.signal)).resolves.toEqual(value);
    expect(fetch).toHaveBeenCalledWith('/__sapling/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"transactionHex":"00ab"}',
      signal: controller.signal,
    });
  });
  it('uses the deployment base for the independent verifier', async () => {
    vi.stubEnv('BASE_URL', '/demo/');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accepted: false, balance: null, protocol: 'Tallinn' })),
      );
    vi.stubGlobal('fetch', fetch);
    await verifyProof('00ab');
    expect(fetch).toHaveBeenCalledWith('/demo/__sapling/verify', expect.any(Object));
  });

  it('preserves a rejected proof result', async () => {
    const value = { accepted: false, balance: null, protocol: 'Tallinn' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    await expect(verifyProof('00ab')).resolves.toEqual(value);
  });
  it.each([
    {},
    { accepted: 'yes', balance: null, protocol: 'Tallinn' },
    { accepted: true, balance: 1, protocol: 'Tallinn' },
  ])('rejects malformed verifier results: %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    await expect(verifyProof('00ab')).rejects.toThrow(/invalid/i);
  });
  it('reports a failed verification service response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(verifyProof('00ab')).rejects.toThrow(/503/);
  });
  it('preserves abort errors', async () => {
    const error = new DOMException('Stopped', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(verifyProof('00ab', AbortSignal.abort())).rejects.toBe(error);
  });
});
