import { useEffect, useRef, useState } from 'react';
import * as wallet from './Wallet';

type ReadResult = { value: string; error: null } | { value: null; error: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'The request failed. Please try again.';

export function useWalletSession() {
  const revision = useRef(0);
  const mounted = useRef(false);
  const locked = useRef(false);
  const [session, setSession] = useState<{ address: string | undefined; revision: number }>({
    address: undefined,
    revision: 0,
  });
  const [restoring, setRestoring] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [balance, setBalance] = useState<ReadResult | null>(null);
  const [counter, setCounter] = useState<ReadResult | null>(null);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = wallet.subscribeAccount((address, cause) => {
      revision.current += 1;
      setSession({ address, revision: revision.current });
      setRestoring(false);
      setError(cause === undefined ? null : message(cause));
      setOperation(null);
      setBalance(null);
      setCounter(null);
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session.address) return;
    let active = true;
    const current = () => active && revision.current === session.revision;
    void wallet.getBalance(session.address).then(
      (value) => {
        if (current()) setBalance({ value, error: null });
      },
      (cause: unknown) => {
        if (current()) setBalance({ value: null, error: message(cause) });
      },
    );
    void wallet.getCounter().then(
      (value) => {
        if (current()) setCounter({ value, error: null });
      },
      (cause: unknown) => {
        if (current()) setCounter({ value: null, error: message(cause) });
      },
    );
    return () => {
      active = false;
    };
  }, [session, refresh]);

  async function run(action: () => Promise<string | void>) {
    if (locked.current) return false;
    locked.current = true;
    const started = revision.current;
    setPending(true);
    setError(null);
    setOperation(null);
    return Promise.resolve()
      .then(action)
      .then(
        (receipt) => {
          if (!mounted.current || revision.current !== started) return false;
          if (receipt) {
            setBalance(null);
            setCounter(null);
            setOperation(receipt);
            setRefresh((value) => value + 1);
          }
          return true;
        },
        (cause: unknown) => {
          if (mounted.current && revision.current === started) setError(message(cause));
          return false;
        },
      )
      .finally(() => {
        locked.current = false;
        if (mounted.current) setPending(false);
      });
  }

  return {
    ...session,
    restoring,
    pending,
    error,
    operation,
    balance,
    counter,
    connect: () => run(wallet.connectWallet),
    disconnect: () => run(wallet.disconnectWallet),
    retryReads: () => {
      setBalance(null);
      setCounter(null);
      setRefresh((value) => value + 1);
    },
    transfer: (receiver: string, amount: string) =>
      run(async () => {
        if (!session.address) throw new Error('Connect a wallet first.');
        return wallet.sendTezos(receiver, amount, session.address);
      }),
    changeCounter: (direction: 'increment' | 'decrement') =>
      run(async () => {
        if (!session.address) throw new Error('Connect a wallet first.');
        return wallet.changeCounter(direction, session.address);
      }),
  };
}
