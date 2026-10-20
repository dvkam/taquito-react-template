import { useEffect, useRef, useState } from 'react';
import { createProofClient, verifyProof } from './client';
import { MAX_MEMO_BYTES, type PreparedProof, type VerificationResult } from './protocol';
import './SaplingLab.css';
import PoolCycle from './PoolCycle';

type Phase =
  | 'idle'
  | 'ready'
  | 'loading'
  | 'proving'
  | 'prepared'
  | 'verifying'
  | 'verified'
  | 'rejected'
  | 'error'
  | 'stopped';
const messages: Record<Phase, string> = {
  idle: 'No proof parameters loaded.',
  ready: 'Ready to prepare a proof.',
  loading: 'Loading and checking proof parameters.',
  proving: 'Preparing a Sapling proof in the worker.',
  prepared: 'Proof prepared. Not yet verified.',
  verifying: 'Octez is checking the prepared transaction.',
  verified: 'Octez accepted this proof.',
  rejected: 'Octez rejected this proof.',
  error: 'The experiment could not finish.',
  stopped: 'Stopped. You can retry when ready.',
};

export default function SaplingLab() {
  const [memo, setMemo] = useState('é');
  const [phase, setPhase] = useState<Phase>('idle');
  const [proof, setProof] = useState<PreparedProof | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublic, setShowPublic] = useState(false);
  const client = useRef<ReturnType<typeof createProofClient> | null>(null);
  const lifecycle = useRef({
    generation: 0,
    running: false,
    preparing: false,
    verifier: null as AbortController | null,
  });
  const memoBytes = new TextEncoder().encode(memo).length;
  const oversized = memoBytes > MAX_MEMO_BYTES;
  const busy = phase === 'loading' || phase === 'proving' || phase === 'verifying';

  useEffect(() => {
    const operation = lifecycle.current;
    let active = true;
    const instance = createProofClient((stage) => {
      if (active && operation.preparing) setPhase(stage);
    });
    client.current = instance;
    return () => {
      active = false;
      operation.generation++;
      operation.running = false;
      operation.preparing = false;
      operation.verifier?.abort();
      instance.dispose();
      client.current = null;
    };
  }, []);

  const prepare = async () => {
    if (lifecycle.current.running || oversized || !client.current) return;
    const current = ++lifecycle.current.generation;
    lifecycle.current.running = true;
    lifecycle.current.preparing = true;
    setProof(null);
    setVerification(null);
    setError(null);
    setPhase('loading');
    try {
      const result = await client.current.prepare(memo);
      if (current !== lifecycle.current.generation) return;
      setProof(result);
      setPhase('prepared');
    } catch (cause) {
      if (current !== lifecycle.current.generation) return;
      setError(cause instanceof Error ? cause.message : 'Proof preparation failed. Try again.');
      setPhase('error');
    }
    if (current === lifecycle.current.generation) {
      lifecycle.current.running = false;
      lifecycle.current.preparing = false;
    }
  };

  const verify = async () => {
    if (lifecycle.current.running || !proof) return;
    const current = ++lifecycle.current.generation;
    const controller = new AbortController();
    lifecycle.current.verifier = controller;
    lifecycle.current.running = true;
    setError(null);
    setVerification(null);
    setPhase('verifying');
    try {
      const result = await verifyProof(proof.transactionHex, controller.signal);
      if (current !== lifecycle.current.generation) return;
      setVerification(result);
      setPhase(result.accepted ? 'verified' : 'rejected');
    } catch (cause) {
      if (current !== lifecycle.current.generation) return;
      setError(cause instanceof Error ? cause.message : 'Verification failed. Try again.');
      setPhase('error');
    }
    if (current === lifecycle.current.generation) {
      lifecycle.current.running = false;
      lifecycle.current.verifier = null;
    }
  };

  const stop = () => {
    lifecycle.current.generation++;
    lifecycle.current.running = false;
    lifecycle.current.preparing = false;
    lifecycle.current.verifier?.abort();
    lifecycle.current.verifier = null;
    client.current?.stop();
    setError(null);
    setPhase('stopped');
  };

  return (
    <section className="sapling-lab" aria-labelledby="sapling-heading">
      <p className="sapling-kicker">Local cryptography experiment</p>
      <h2 id="sapling-heading">Sapling proof lab</h2>
      <p>Prepare a real shielding proof in a worker, then check it independently with Octez.</p>
      <p className="sapling-fixture">
        This uses a public, disposable test account, an empty mock pool, and 1 mutez. Anyone can
        derive its keys. Do not send funds to it. This experiment sends no transaction to a chain.
      </p>
      <button
        className="sapling-disclosure"
        aria-expanded={showPublic}
        aria-controls="sapling-public"
        onClick={() => setShowPublic(!showPublic)}
      >
        What is public?
      </button>
      <div id="sapling-public" hidden={!showPublic} className="sapling-explanation">
        <p>
          The shielding amount is public. The recipient and memo are encrypted in the transaction,
          but this published test account provides no privacy. The local verifier receives the
          transaction bytes.
        </p>
        <p>
          Preparing a proof does not establish that the protocol accepts it. Octez performs that
          separate check.
        </p>
      </div>
      <form
        className="sapling-form"
        onSubmit={(event) => {
          event.preventDefault();
          void prepare();
        }}
      >
        <label htmlFor="sapling-memo">Private memo</label>
        <input
          id="sapling-memo"
          value={memo}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="sapling-memo-help"
          aria-invalid={oversized}
          onChange={(event) => {
            setMemo(event.target.value);
            setProof(null);
            setVerification(null);
            setError(null);
            if (phase !== 'idle') setPhase('ready');
          }}
        />
        <p id="sapling-memo-help" className={oversized ? 'sapling-invalid' : 'hint'}>
          {memoBytes} of {MAX_MEMO_BYTES} bytes
          {oversized ? '. Use a memo of eight UTF-8 bytes or fewer.' : ''}
        </p>
        <div className="sapling-actions">
          <button type="submit" disabled={busy || oversized}>
            {phase === 'error' || phase === 'stopped' ? 'Retry' : 'Prepare proof'}
          </button>
          {busy && (
            <button type="button" onClick={stop}>
              Stop
            </button>
          )}
          {proof && !busy && (
            <button
              type="button"
              onClick={() => {
                void verify();
              }}
            >
              {phase === 'error' || phase === 'rejected' || phase === 'stopped'
                ? 'Retry verification'
                : 'Verify with Octez'}
            </button>
          )}
        </div>
      </form>
      <div className="sapling-status" data-phase={phase}>
        <output aria-live="polite" aria-atomic="true">
          {messages[phase]}
        </output>
        {phase === 'idle' && (
          <p className="hint">
            The first run downloads and checks proving parameters. You can keep using the page while
            the worker runs.
          </p>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <PoolCycle />
      {proof && (
        <div className="sapling-result">
          <h3>Prepared transaction</h3>
          <dl>
            <div>
              <dt>Parameter load and checks</dt>
              <dd>{(proof.preloadMs / 1000).toFixed(2)} s</dd>
            </div>
            <div>
              <dt>Proof preparation</dt>
              <dd>{(proof.proofMs / 1000).toFixed(2)} s</dd>
            </div>
            <div>
              <dt>Worker parameters</dt>
              <dd>{proof.warm ? 'Already initialized' : 'Initialized for this run'}</dd>
            </div>
            <div>
              <dt>Memo size</dt>
              <dd>{proof.memoBytes} bytes</dd>
            </div>
            {verification && (
              <>
                <div>
                  <dt>Verifier protocol</dt>
                  <dd>{verification.protocol}</dd>
                </div>
                <div>
                  <dt>Verifier balance change</dt>
                  <dd>{verification.balance ?? 'Not available'}</dd>
                </div>
              </>
            )}
          </dl>
          <details>
            <summary>Inspect public transaction bytes</summary>
            <label htmlFor="sapling-transaction">Prepared transaction bytes</label>
            <textarea
              id="sapling-transaction"
              readOnly
              value={proof.transactionHex}
              rows={4}
              spellCheck={false}
            />
          </details>
        </div>
      )}
    </section>
  );
}
