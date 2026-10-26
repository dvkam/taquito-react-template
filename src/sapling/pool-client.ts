import { publicPoolState } from './pool-observer';
import type { PoolAction, PoolResponse, PoolSnapshot } from './pool-protocol';
export async function poolPost(action: string, input: unknown): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}__sapling/pool/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result === 'object' && result !== null && 'error' in result
        ? String(result.error)
        : 'Local pool request failed',
    );
  return result;
}
export function createPoolWorker() {
  const worker = new Worker(new URL('./pool.worker.ts', import.meta.url), { type: 'module' });
  let running = false;
  let disposed = false;
  let rejectPending: ((error: Error) => void) | null = null;
  return {
    act: (action: PoolAction, snapshot: PoolSnapshot): Promise<PoolResponse> => {
      if (disposed) return Promise.reject(new Error('Pool worker stopped'));
      if (running) return Promise.reject(new Error('Worker busy'));
      running = true;
      return new Promise((resolve, reject) => {
        rejectPending = reject;
        worker.onmessage = ({ data }: MessageEvent<PoolResponse>) => {
          running = false;
          rejectPending = null;
          if (data.error) reject(new Error(data.error));
          else resolve(data);
        };
        worker.onerror = () => {
          running = false;
          rejectPending = null;
          reject(new Error('Pool worker failed'));
        };
        try {
          worker.postMessage({
            action,
            snapshot,
            parameterBaseUrl: new URL(
              `${import.meta.env.BASE_URL}__sapling/params/`,
              location.origin,
            ).href,
          });
        } catch (error) {
          running = false;
          rejectPending = null;
          reject(error instanceof Error ? error : new Error('Could not send worker request'));
        }
      });
    },
    dispose: () => {
      disposed = true;
      worker.terminate();
      rejectPending?.(new Error('Pool worker stopped'));
      rejectPending = null;
      running = false;
    },
  };
}

export class PoolReceiptError extends Error {
  constructor(operationHash: string | undefined) {
    super(
      `Applied locally: ${operationHash ?? 'receipt unavailable'}. State refresh failed. Do not resubmit. Inspect this local operation before starting a new pool.`,
    );
    this.name = 'PoolReceiptError';
  }
}

export async function runPoolCycle(
  worker: ReturnType<typeof createPoolWorker>,
  stage: (message: string) => void,
  active: () => boolean,
) {
  stage('Creating a funded local contract.');
  const session = (await poolPost('create', {})) as { id: string; snapshot: PoolSnapshot };
  let snapshot = session.snapshot;
  const publicHistory = [publicPoolState(snapshot)];
  for (const action of ['shield', 'transfer', 'unshield'] as const) {
    if (!active()) return null;
    stage(
      action === 'shield'
        ? 'Preparing the 10 XTZ deposit.'
        : action === 'transfer'
          ? 'Preparing a private update.'
          : 'Preparing the 2 XTZ withdrawal.',
    );
    const proof = await worker.act(action, snapshot);
    if (!active()) return null;
    const applied = (await poolPost('submit', {
      id: session.id,
      version: snapshot.version,
      transactionHex: proof.transactionHex,
      amountMutez: action === 'shield' ? '10000000' : '0',
    })) as { accepted: boolean; snapshot: PoolSnapshot | null; operationHash?: string };
    if (!applied.accepted) throw new Error('The local protocol rejected the transaction.');
    if (!applied.snapshot) throw new PoolReceiptError(applied.operationHash);
    if (
      applied.snapshot.version !== snapshot.version + 1 ||
      applied.snapshot.contractAddress !== snapshot.contractAddress ||
      applied.snapshot.chainId !== snapshot.chainId ||
      applied.snapshot.payer !== snapshot.payer ||
      applied.snapshot.recipient !== snapshot.recipient
    )
      throw new PoolReceiptError(applied.operationHash);
    snapshot = applied.snapshot;
    publicHistory.push(publicPoolState(snapshot, applied.operationHash));
  }
  if (!active()) return null;
  const { view } = await worker.act('observe', snapshot);
  if (!active()) return null;
  if (!view) throw new Error('Missing decrypted balances');
  if (
    view.aliceMutez !== '7000000' ||
    view.bobMutez !== '1000000' ||
    snapshot.poolMutez !== '8000000' ||
    snapshot.recipientMutez !== '2000000'
  )
    throw new Error('The local balances did not reconcile.');
  return { snapshot, view, publicHistory };
}
