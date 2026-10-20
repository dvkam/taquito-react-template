import { useEffect, useRef, useState } from 'react';
import { createPoolWorker, runPoolCycle } from './pool-client';
import type { PoolSnapshot, PoolView } from './pool-protocol';
export default function PoolCycle() {
  const [status, setStatus] = useState('No local pool created.');
  const [result, setResult] = useState<{ snapshot: PoolSnapshot; view: PoolView } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<{ worker: ReturnType<typeof createPoolWorker> | null; active: boolean }>(
    { worker: null, active: true },
  );
  useEffect(() => {
    const current = operation.current;
    current.active = true;
    return () => {
      current.active = false;
      current.worker?.dispose();
    };
  }, []);
  const run = () => {
    if (operation.current.worker) return;
    const worker = createPoolWorker();
    operation.current.worker = worker;
    setRunning(true);
    setError(null);
    setResult(null);
    void runPoolCycle(worker, setStatus, () => operation.current.active)
      .then((completed) => {
        if (completed && operation.current.active) {
          setResult(completed);
          setStatus('Local payment cycle verified.');
        }
      })
      .catch((cause: unknown) => {
        if (operation.current.active) {
          setError(cause instanceof Error ? cause.message : 'Local cycle failed');
          setStatus('Local cycle stopped. Start a fresh pool to retry.');
        }
      })
      .finally(() => {
        worker.dispose();
        if (operation.current.active) {
          operation.current.worker = null;
          setRunning(false);
        }
      });
  };

  return (
    <section aria-labelledby="pool-heading">
      <h3 id="pool-heading">Funded local payment cycle</h3>
      <p>
        Shield 10 test XTZ, send 3 privately to Bob, then withdraw 2. This creates a fresh local
        Octez contract with public disposable identities. It uses no public network or real funds.
      </p>
      <button
        disabled={running}
        onClick={() => {
          run();
        }}
      >
        Run local payment cycle
      </button>
      <output aria-live="polite">{status}</output>
      {error && <p role="alert">{error}</p>}
      {result && (
        <dl className="sapling-result">
          <div>
            <dt>Alice, decrypted</dt>
            <dd>{result.view.aliceMutez} mutez</dd>
          </div>
          <div>
            <dt>Bob, decrypted</dt>
            <dd>{result.view.bobMutez} mutez</dd>
          </div>
          <div>
            <dt>Public contract backing</dt>
            <dd>{result.snapshot.poolMutez} mutez</dd>
          </div>
          <div>
            <dt>Public recipient payout</dt>
            <dd>{result.snapshot.recipientMutez} mutez</dd>
          </div>
          <div>
            <dt>Separate payer fees and storage costs</dt>
            <dd>{result.snapshot.feesAndStorageMutez} mutez</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
