import type { TzReadProvider } from '@taquito/taquito';
import { fixture } from './fixture';
import type { PoolRequest, PoolResponse } from './pool-protocol';
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PoolRequest>) => void) | null;
  postMessage: (result: PoolResponse) => void;
};
let busy = false;
async function act({ action, snapshot, parameterBaseUrl }: PoolRequest): Promise<PoolResponse> {
  const { InMemorySpendingKey, SaplingToolkit, preloadSaplingParams, initSapling } =
    await import('@taquito/sapling');
  const alice = await InMemorySpendingKey.fromMnemonic(fixture.mnemonic);
  // Published disposable fixtures, never user secrets.
  const bob = await InMemorySpendingKey.fromMnemonic(
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
  );
  const unrelated = await InMemorySpendingKey.fromMnemonic(
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  );
  const provider = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'getChainId') return async () => snapshot.chainId;
        if (property === 'getSaplingDiffByContract')
          return async () => structuredClone(snapshot.diff);
        throw new Error(`Unexpected pool read: ${String(property)}`);
      },
    },
  ) as TzReadProvider;
  const details = { contractAddress: snapshot.contractAddress, memoSize: 8 };
  const toolkit = (key: InstanceType<typeof InMemorySpendingKey>) =>
    new SaplingToolkit({ saplingSigner: key }, details, provider);
  if (action === 'observe') {
    const viewers = await Promise.all(
      [alice, bob, unrelated].map(async (key) => toolkit(key).getSaplingTransactionViewer()),
    );
    const balances = await Promise.all(
      viewers.map(async (viewer) => (await viewer.getBalance()).toFixed()),
    );
    const histories = await Promise.all(
      viewers.map(async (viewer) => viewer.getIncomingAndOutgoingTransactions()),
    );
    return {
      view: {
        aliceMutez: balances[0]!,
        bobMutez: balances[1]!,
        unrelatedMutez: balances[2]!,
        unrelatedIncomingCount: histories[2]!.incoming.length,
        aliceMemos: histories[0]!.incoming.map((tx) => tx.memo),
        bobMemos: histories[1]!.incoming.map((tx) => tx.memo),
      },
    };
  }
  const base = new URL(parameterBaseUrl);
  if (base.origin !== self.location.origin) throw new Error('Use local parameters');
  await initSapling({
    params: {
      spendParamsUrl: new URL('spend.params', base).href,
      outputParamsUrl: new URL('output.params', base).href,
      spendParamsSha256: fixture.spendHash,
      outputParamsSha256: fixture.outputHash,
    },
  });
  await preloadSaplingParams();
  if (action === 'shield') {
    const to = (await (await alice.getSaplingViewingKeyProvider()).getAddress()).address;
    return {
      transactionHex: await toolkit(alice).prepareShieldedTransaction([
        { to, amount: 10_000_000, mutez: true, memo: 'deposit' },
      ]),
    };
  }
  if (action === 'transfer') {
    const to = (await (await bob.getSaplingViewingKeyProvider()).getAddress()).address;
    return {
      transactionHex: await toolkit(alice).prepareSaplingTransaction([
        { to, amount: 3_000_000, mutez: true, memo: 'gift é' },
      ]),
    };
  }
  if (action !== 'unshield') throw new Error('Unknown pool action');
  return {
    transactionHex: await toolkit(bob).prepareUnshieldedTransaction({
      to: snapshot.recipient,
      amount: 2_000_000,
      mutez: true,
    }),
  };
}
scope.onmessage = (event) => {
  if (busy) {
    scope.postMessage({ error: 'Worker busy' });
    return;
  }
  busy = true;
  void act(event.data)
    .then((result) => scope.postMessage(result))
    .catch((error: unknown) =>
      scope.postMessage({ error: error instanceof Error ? error.message : 'Pool worker failed' }),
    )
    .finally(() => {
      busy = false;
    });
};
