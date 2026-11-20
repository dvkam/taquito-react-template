import type { PreparedProof, ProofStage, VerificationResult, WorkerRequest } from './protocol';

type WorkerPort = Pick<
  Worker,
  'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'
>;
type Pending = {
  id: number;
  memo: string;
  resolve: (result: PreparedProof) => void;
  reject: (error: Error) => void;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isProof = (value: unknown): value is PreparedProof =>
  record(value) &&
  typeof value['transactionHex'] === 'string' &&
  /^(?:[0-9a-f]{2})+$/i.test(value['transactionHex']) &&
  typeof value['recipient'] === 'string' &&
  value['recipient'].length > 0 &&
  typeof value['memo'] === 'string' &&
  Number.isSafeInteger(value['memoBytes']) &&
  value['memoBytes'] === new TextEncoder().encode(value['memo']).length &&
  nonnegative(value['preloadMs']) &&
  nonnegative(value['proofMs']) &&
  typeof value['warm'] === 'boolean';

/** Own one worker operation at a time. Stop discards the worker's cached proving state. */
export function createProofClient(
  onStage: (stage: ProofStage) => void,
  createWorker: () => WorkerPort = () =>
    new Worker(new URL('./proof.worker.ts', import.meta.url), { type: 'module' }),
) {
  let worker: WorkerPort | undefined;
  let pending: Pending | undefined;
  let nextId = 0;
  let disposed = false;
  let detach: (() => void) | undefined;

  const terminate = () => {
    detach?.();
    detach = undefined;
    worker?.terminate();
    worker = undefined;
  };
  const fail = (error: Error) => {
    const active = pending;
    pending = undefined;
    terminate();
    active?.reject(error);
  };
  const start = () => {
    const instance = createWorker();
    worker = instance;
    const message: EventListener = (event) => {
      if (worker !== instance || !pending) return;
      const data: unknown = (event as MessageEvent<unknown>).data;
      if (record(data) && Number.isSafeInteger(data['id']) && data['id'] !== pending.id) return;
      if (!record(data) || data['id'] !== pending.id) {
        fail(new Error('Invalid proof worker message'));
        return;
      }
      if (
        data['type'] === 'stage' &&
        (data['stage'] === 'loading' || data['stage'] === 'proving')
      ) {
        try {
          onStage(data['stage']);
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Proof stage update failed'));
        }
      } else if (
        data['type'] === 'result' &&
        isProof(data['result']) &&
        data['result'].memo === pending.memo
      ) {
        const active = pending;
        pending = undefined;
        active.resolve(data['result']);
      } else if (
        data['type'] === 'error' &&
        typeof data['message'] === 'string' &&
        data['message'].length > 0
      ) {
        fail(new Error(data['message']));
      } else {
        fail(new Error('Invalid proof worker message'));
      }
    };
    const crash = () => {
      if (worker === instance) fail(new Error('Proof worker failed. Try again.'));
    };
    instance.addEventListener('message', message);
    instance.addEventListener('error', crash);
    instance.addEventListener('messageerror', crash);
    detach = () => {
      instance.removeEventListener('message', message);
      instance.removeEventListener('error', crash);
      instance.removeEventListener('messageerror', crash);
    };
    return instance;
  };

  return {
    async prepare(memo: string): Promise<PreparedProof> {
      if (disposed) throw new Error('Proof client is disposed');
      if (pending) throw new Error('A proof is already being prepared');
      return new Promise<PreparedProof>((resolve, reject) => {
        pending = { id: ++nextId, memo, resolve, reject };
        try {
          const instance = worker ?? start();
          const request: WorkerRequest = {
            id: pending.id,
            memo,
            parameterBaseUrl: new URL(
              '__sapling/params/',
              new URL(import.meta.env.BASE_URL, location.origin),
            ).href,
          };
          instance.postMessage(request);
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Could not start proof worker'));
        }
      });
    },
    stop() {
      fail(new DOMException('Proof preparation stopped', 'AbortError'));
    },
    dispose() {
      disposed = true;
      fail(new DOMException('Proof preparation stopped', 'AbortError'));
    },
  };
}

/** Ask the local independent verifier to check prepared transaction bytes. */
export async function verifyProof(
  transactionHex: string,
  signal?: AbortSignal,
): Promise<VerificationResult> {
  const response = await fetch(`${import.meta.env.BASE_URL}__sapling/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionHex }),
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`Proof verification service failed (${response.status})`);
  const value: unknown = await response.json();
  if (
    !record(value) ||
    typeof value['accepted'] !== 'boolean' ||
    !(value['balance'] === null || typeof value['balance'] === 'string') ||
    typeof value['protocol'] !== 'string' ||
    value['protocol'].length === 0
  )
    throw new Error('Invalid proof verification response');
  return { accepted: value['accepted'], balance: value['balance'], protocol: value['protocol'] };
}
