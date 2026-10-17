import { useState } from 'react';
import { useWalletSession } from './useWalletSession';
import { network } from './network';
import './App.css';

function TransferForm({
  pending,
  send,
}: {
  pending: boolean;
  send: (receiver: string, amount: string) => Promise<boolean>;
}) {
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <form
      aria-labelledby="send-heading"
      onSubmit={(event) => {
        event.preventDefault();
        void send(receiver, amount).then((success) => {
          if (success) {
            setReceiver('');
            setAmount('');
          }
        });
      }}
    >
      <h2 id="send-heading">Send test XTZ</h2>
      <label htmlFor="receiver">Receiver address</label>
      <input
        id="receiver"
        value={receiver}
        onChange={(event) => setReceiver(event.target.value)}
        required
        disabled={pending}
        autoComplete="off"
        spellCheck={false}
      />
      <label htmlFor="amount">Amount in XTZ</label>
      <input
        id="amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
        disabled={pending}
        inputMode="decimal"
        autoComplete="off"
        aria-describedby="amount-help"
      />
      <p id="amount-help" className="hint">
        Use a positive amount with up to six decimal places.
      </p>
      <button disabled={pending} type="submit">
        Send test XTZ
      </button>
    </form>
  );
}

function App() {
  const session = useWalletSession();
  const [view, setView] = useState<'transfer' | 'counter'>('transfer');
  const busy = session.restoring || session.pending;
  return (
    <main className="wallet-app">
      <header>
        <p className="network">Shadownet test network</p>
        <h1>Taquito React template</h1>
        <p>Connect a wallet, send test XTZ, and update a counter contract.</p>
      </header>
      <div className="wallet-controls">
        <button
          disabled={busy}
          onClick={() => {
            void session.connect();
          }}
        >
          {session.restoring
            ? 'Restoring wallet…'
            : session.address
              ? 'Switch account'
              : 'Connect wallet'}
        </button>
        {session.address && (
          <button
            disabled={busy}
            onClick={() => {
              void session.disconnect();
            }}
          >
            Disconnect
          </button>
        )}
      </div>
      {session.error && <p role="alert">{session.error}</p>}
      <output aria-live="polite" aria-atomic="true" className="operation">
        {session.pending ? (
          'Waiting for wallet approval and network confirmation…'
        ) : session.operation ? (
          <>
            Confirmed operation:{' '}
            <a
              href={`${network.explorerUrl}/${session.operation}`}
              target="_blank"
              rel="noreferrer"
            >
              {session.operation}
            </a>
          </>
        ) : (
          ''
        )}
      </output>
      {session.address && (
        <>
          <section aria-labelledby="account-heading">
            <h2 id="account-heading">Your account</h2>
            <a
              className="address"
              href={`${network.explorerUrl}/${session.address}`}
              target="_blank"
              rel="noreferrer"
            >
              {session.address}
            </a>
            {session.balance?.error ? (
              <p role="alert">{session.balance.error}</p>
            ) : (
              <p>{session.balance ? `Balance: ${session.balance.value} ꜩ` : 'Loading balance…'}</p>
            )}
            <button disabled={busy} onClick={session.retryReads}>
              Refresh balance and counter
            </button>
          </section>
          <nav aria-label="Examples" className="example-controls">
            <button aria-pressed={view === 'transfer'} onClick={() => setView('transfer')}>
              Transfer
            </button>
            <button aria-pressed={view === 'counter'} onClick={() => setView('counter')}>
              Counter contract
            </button>
          </nav>
          <div hidden={view !== 'transfer'}>
            <TransferForm key={session.revision} pending={busy} send={session.transfer} />
          </div>
          <section hidden={view !== 'counter'} aria-labelledby="counter-heading">
            <h2 id="counter-heading">Counter contract</h2>
            <p>This is a shared demo. Other users can change its value.</p>
            <a
              className="address"
              href={`${network.explorerUrl}/${network.counterAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {network.counterAddress}
            </a>
            {session.counter?.error ? (
              <p role="alert">{session.counter.error}</p>
            ) : (
              <p>
                {session.counter ? `Current counter: ${session.counter.value}` : 'Loading counter…'}
              </p>
            )}
            <div className="wallet-controls">
              <button
                disabled={busy || !session.counter || session.counter.error !== null}
                onClick={() => {
                  void session.changeCounter('decrement');
                }}
              >
                Decrease by 1
              </button>
              <button
                disabled={busy || !session.counter || session.counter.error !== null}
                onClick={() => {
                  void session.changeCounter('increment');
                }}
              >
                Increase by 1
              </button>
            </div>
          </section>
        </>
      )}
      <footer>
        <a href="https://taquito.io/">Built with Taquito</a>
      </footer>
    </main>
  );
}

export default App;
