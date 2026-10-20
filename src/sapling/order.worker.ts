import type { TzReadProvider } from '@taquito/taquito';
import { fixture } from './fixture';
import type { PoolSnapshot } from './pool-protocol';
import type { OrderRequest, OrderResponse, OrderView } from './order-protocol';
import { readOrderTransaction } from './order-wire';
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<OrderRequest>) => void) | null;
  postMessage: (result: OrderResponse) => void;
};
async function act(request: OrderRequest): Promise<OrderResponse> {
  const { action, variant, snapshot } = request;
  const sdk =
    variant === 'baseline'
      ? await import('@sapling-order/baseline')
      : await import('@sapling-order/candidate');
  const mnemonics = [
    fixture.mnemonic,
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  ];
  const keys = await Promise.all(
    mnemonics.map(async (mnemonic) => sdk.InMemorySpendingKey.fromMnemonic(mnemonic)),
  );
  const details = {
    contractAddress: snapshot.contractAddress,
    memoSize: 8,
    ...(variant === 'candidate-randomized' ? { outputOrder: 'randomized' as const } : {}),
  };
  const toolkit = (index: number, state: PoolSnapshot) => {
    const provider = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'getChainId') return async () => state.chainId;
          if (property === 'getSaplingDiffByContract')
            return async () => structuredClone(state.diff);
          throw new Error(`Unexpected experiment read: ${String(property)}`);
        },
      },
    ) as TzReadProvider;
    return new sdk.SaplingToolkit({ saplingSigner: keys[index]! }, details, provider);
  };
  const observe = async (state: PoolSnapshot): Promise<OrderView> => {
    const viewers = await Promise.all(
      keys.map(async (_key, index) => toolkit(index, state).getSaplingTransactionViewer()),
    );
    const balances = await Promise.all(
      viewers.map(async (viewer) => (await viewer.getBalance()).toFixed()),
    );
    const notes = await Promise.all(
      viewers.map(async (viewer) => {
        const raw = await viewer.getIncomingAndOutgoingTransactionsRaw();
        const readable = await viewer.getIncomingAndOutgoingTransactions();
        return raw.incoming.map((note, index) => ({
          position: note.position,
          value: readable.incoming[index]!.value.toFixed(),
          memo: readable.incoming[index]!.memo,
        }));
      }),
    );
    return { balances, notes };
  };
  if (action === 'observe') return { view: await observe(snapshot) };
  const base = new URL(request.parameterBaseUrl);
  if (base.origin !== self.location.origin) throw new Error('Use local parameters');
  await sdk.initSapling({
    params: {
      spendParamsUrl: new URL('spend.params', base).href,
      outputParamsUrl: new URL('output.params', base).href,
      spendParamsSha256: fixture.spendHash,
      outputParamsSha256: fixture.outputHash,
    },
  });
  await sdk.preloadSaplingParams();
  const addresses = await Promise.all(
    keys.map(
      async (key) => (await (await key.getSaplingViewingKeyProvider()).getAddress()).address,
    ),
  );
  let transactionHex: string;
  if (action === 'seed')
    transactionHex = await toolkit(0, snapshot).prepareShieldedTransaction([
      { to: addresses[0]!, amount: 10_000_000, mutez: true, memo: 'seed' },
    ]);
  else if (action === 'transfer')
    transactionHex = await toolkit(0, snapshot).prepareSaplingTransaction([
      { to: addresses[1]!, amount: 3_000_000, mutez: true, memo: 'pay é' },
    ]);
  else if (action === 'change-spend')
    transactionHex = await toolkit(0, snapshot).prepareSaplingTransaction([
      { to: addresses[2]!, amount: 7_000_000, mutez: true, memo: 'change' },
    ]);
  else if (action === 'withdraw')
    transactionHex = await toolkit(1, snapshot).prepareUnshieldedTransaction({
      to: snapshot.recipient,
      amount: 2_000_000,
      mutez: true,
    });
  else if (action === 'exact-multi')
    transactionHex = await toolkit(2, snapshot).prepareSaplingTransaction([
      { to: addresses[0]!, amount: 2_000_000, mutez: true, memo: 'exact A' },
      { to: addresses[1]!, amount: 5_000_000, mutez: true, memo: 'exact B' },
    ]);
  else if (action === 'multi')
    transactionHex = await toolkit(1, snapshot).prepareSaplingTransaction([
      { to: addresses[0]!, amount: 1_000_000, mutez: true, memo: 'multi A' },
      { to: addresses[2]!, amount: 1_000_000, mutez: true, memo: 'multi C' },
    ]);
  else throw new Error('Unknown experiment action');
  const parsed = readOrderTransaction(transactionHex);
  // Decrypt unsubmitted outputs only to select a moved-change case. Protocol evidence uses RPC state after application.
  const previewState = {
    ...snapshot,
    diff: {
      ...snapshot.diff,
      commitments_and_ciphertexts: [
        ...snapshot.diff.commitments_and_ciphertexts,
        ...parsed.outputs,
      ],
    },
  };
  const preview = await observe(previewState);
  preview.notes = preview.notes.map((notes) =>
    notes.filter((note) => note.position >= snapshot.diff.commitments_and_ciphertexts.length),
  );
  return { transactionHex, preview };
}
let busy = false;
scope.onmessage = ({ data }) => {
  if (busy) {
    scope.postMessage({ error: 'Worker busy' });
    return;
  }
  busy = true;
  void act(data)
    .then((result) => scope.postMessage(result))
    .catch((error: unknown) =>
      scope.postMessage({
        error: error instanceof Error ? error.message : 'Output-order experiment failed',
      }),
    )
    .finally(() => {
      busy = false;
    });
};
