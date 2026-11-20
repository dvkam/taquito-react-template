import { useEffect, useRef, useState } from 'react';
import { createPoolWorker, PoolReceiptError, runPoolCycle } from './pool-client';
import PoolPerspectives from './PoolPerspectives';

export default function PoolCycle() {
  const [status, setStatus] = useState('No local pool created.');
  const [result, setResult] = useState<Awaited<ReturnType<typeof runPoolCycle>>>(null);
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
          setError(
            cause instanceof PoolReceiptError
              ? cause.message
              : 'The local cycle could not finish. Inspect the local verifier output before starting a fresh pool.',
          );
          setStatus('Local cycle stopped. Check the local verifier before starting a fresh pool.');
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
        Create a local pool, make a private transfer, then withdraw to a public recipient. Octez
        checks each transition. This uses published disposable identities, no public network, and no
        real funds.
      </p>
      <button
        disabled={running}
        onClick={() => {
          run();
        }}
      >
        Run local payment cycle
      </button>
      <div className="sapling-pool-status">
        <output aria-live="polite">{status}</output>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && <PoolPerspectives publicHistory={result.publicHistory} view={result.view} />}
    </section>
  );
}
