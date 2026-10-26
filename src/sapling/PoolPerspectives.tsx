import { useState } from 'react';
import type { PublicPoolState } from './pool-observer';
import { publicPoolTimeline, xtz } from './pool-observer';
import type { PoolView } from './pool-protocol';

type Role = 'Public observer' | 'Alice' | 'Bob';
const roles: Role[] = ['Public observer', 'Alice', 'Bob'];

function PublicReport({ history }: { history: PublicPoolState[] }) {
  const latest = history[history.length - 1]!;
  return (
    <section aria-label="Public chain report" className="pool-perspective">
      <h4>What the chain reveals</h4>
      <p>
        Amounts entering or leaving the pool are public. A private update does not reveal its
        recipients or note values directly.
      </p>
      <dl>
        <div>
          <dt>Public contract backing</dt>
          <dd>
            {xtz(latest.poolMutez)}
            <small>{latest.poolMutez} mutez</small>
          </dd>
        </div>
        <div>
          <dt>Public recipient payout</dt>
          <dd>
            {xtz(latest.recipientMutez)}
            <small>{latest.recipientMutez} mutez</small>
          </dd>
        </div>
        <div>
          <dt>Separate payer fees and storage costs</dt>
          <dd>
            {xtz(latest.feesAndStorageMutez)}
            <small>{latest.feesAndStorageMutez} mutez</small>
          </dd>
        </div>
        <div>
          <dt>Encrypted outputs recorded</dt>
          <dd>{latest.outputCount}</dd>
        </div>
        <div>
          <dt>Spent-note nullifiers recorded</dt>
          <dd>{latest.spentCount}</dd>
        </div>
      </dl>
      <h4>Public pool history</h4>
      <ol className="pool-timeline">
        {publicPoolTimeline(history).map((step) => (
          <li key={step.version}>
            <strong>{step.label}</strong>
            <span>
              Backing change: {step.backingChange}. New encrypted outputs: {step.newOutputs}. New
              nullifiers: {step.newNullifiers}.
            </span>
            {step.operationHash && <small>Local operation: {step.operationHash}</small>}
          </li>
        ))}
      </ol>
      <details>
        <summary>Inspect public identifiers</summary>
        <dl>
          <div>
            <dt>Contract</dt>
            <dd>{latest.contractAddress}</dd>
          </div>
          <div>
            <dt>Chain</dt>
            <dd>{latest.chainId}</dd>
          </div>
          <div>
            <dt>Latest Sapling root</dt>
            <dd>{latest.root}</dd>
          </div>
          <div>
            <dt>Public payout recipient</dt>
            <dd>{latest.recipient}</dd>
          </div>
          <div>
            <dt>Public fee payer</dt>
            <dd>{latest.payer}</dd>
          </div>
        </dl>
      </details>
      <p className="hint">
        Public data does not directly label change. Timing, counts, the public payer, and builder
        patterns may still reveal information. This view is not a proof of anonymity.
      </p>
    </section>
  );
}

function PrivateReport({
  owner,
  balance,
  memos,
}: {
  owner: 'Alice' | 'Bob';
  balance: string;
  memos: string[];
}) {
  const readableMemos = [...new Set(memos.filter((memo) => memo.length > 0))];
  return (
    <section aria-label={`${owner} viewing key report`} className="pool-perspective">
      <h4>What {owner}'s viewing key reveals</h4>
      <p>
        The worker decrypted these values with {owner}'s demo key. A viewing key can inspect notes.
        It does not authorize spending.
      </p>
      <dl>
        <div>
          <dt>{owner}, decrypted</dt>
          <dd>
            {xtz(balance)}
            <small>{balance} mutez</small>
          </dd>
        </div>
      </dl>
      <h4>Recovered incoming memos</h4>
      {readableMemos.length ? (
        <ul>
          {readableMemos.map((memo) => (
            <li key={memo}>{memo}</li>
          ))}
        </ul>
      ) : (
        <p>No nonempty incoming memos recovered.</p>
      )}
      <p className="hint">
        These are historical incoming memos. Their notes may already be spent. The balance counts
        unspent notes.
      </p>
    </section>
  );
}

export default function PoolPerspectives({
  publicHistory,
  view,
}: {
  publicHistory: PublicPoolState[];
  view: PoolView;
}) {
  const [role, setRole] = useState<Role>('Public observer');
  return (
    <div className="sapling-result pool-perspectives">
      <fieldset className="pool-role-picker">
        <legend>Inspect the completed cycle as</legend>
        <div>
          {roles.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={role === name}
              onClick={() => setRole(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="pool-demo-notice">
        This selector changes the explanation, not access rights. All demo keys are published.
        Anyone with those keys can inspect the fixture. This app provides no secret identities.
      </p>
      {role === 'Public observer' ? (
        <PublicReport history={publicHistory} />
      ) : (
        <PrivateReport
          owner={role}
          balance={role === 'Alice' ? view.aliceMutez : view.bobMutez}
          memos={role === 'Alice' ? view.aliceMemos : view.bobMemos}
        />
      )}
    </div>
  );
}
