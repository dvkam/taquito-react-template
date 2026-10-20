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
  return {
    act: (action: PoolAction, snapshot: PoolSnapshot): Promise<PoolResponse> => {
      if (running) return Promise.reject(new Error('Worker busy'));
      running = true;
      return new Promise((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<PoolResponse>) => {
          running = false;
          if (data.error) reject(new Error(data.error));
          else resolve(data);
        };
        worker.onerror = () => {
          running = false;
          reject(new Error('Pool worker failed'));
        };
        worker.postMessage({
          action,
          snapshot,
          parameterBaseUrl: new URL(`${import.meta.env.BASE_URL}__sapling/params/`, location.origin)
            .href,
        });
      });
    },
    dispose: () => worker.terminate(),
  };
}

export async function runPoolCycle(
  worker: ReturnType<typeof createPoolWorker>,
  stage: (message: string) => void,
  active: () => boolean,
) {
  stage('Creating a funded local contract.');
  const session = (await poolPost('create', {})) as { id: string; snapshot: PoolSnapshot };
  let snapshot = session.snapshot;
  for (const action of ['shield', 'transfer', 'unshield'] as const) {
    if (!active()) return null;
    stage(
      action === 'shield'
        ? 'Preparing the 10 XTZ deposit.'
        : action === 'transfer'
          ? 'Preparing the private 3 XTZ transfer.'
          : 'Preparing the 2 XTZ withdrawal.',
    );
    const proof = await worker.act(action, snapshot);
    if (!active()) return null;
    const applied = (await poolPost('submit', {
      id: session.id,
      version: snapshot.version,
      transactionHex: proof.transactionHex,
      amountMutez: action === 'shield' ? '10000000' : '0',
    })) as { accepted: boolean; snapshot: PoolSnapshot };
    if (!applied.accepted) throw new Error('The local protocol rejected the transaction.');
    snapshot = applied.snapshot;
  }
  const { view } = await worker.act('observe', snapshot);
  if (!view) throw new Error('Missing decrypted balances');
  if (
    view.aliceMutez !== '7000000' ||
    view.bobMutez !== '1000000' ||
    snapshot.poolMutez !== '8000000' ||
    snapshot.recipientMutez !== '2000000'
  )
    throw new Error('The local balances did not reconcile.');
  return { snapshot, view };
}
