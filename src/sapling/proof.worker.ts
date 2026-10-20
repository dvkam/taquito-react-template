import type { TzReadProvider } from '@taquito/taquito';
import { fixture } from './fixture';
import type { WorkerRequest, WorkerResponse } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};
let initialized = false;
let busy = false;

function isRequest(value: unknown): value is WorkerRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    Number.isSafeInteger(value.id) &&
    'memo' in value &&
    typeof value.memo === 'string' &&
    'parameterBaseUrl' in value &&
    typeof value.parameterBaseUrl === 'string'
  );
}

async function prepare(request: WorkerRequest) {
  const { id, memo } = request;
  try {
    const memoBytes = new TextEncoder().encode(memo).length;
    if (memoBytes > fixture.memoSize) throw new Error('The memo must fit in 8 UTF-8 bytes.');
    const parameterBaseUrl = new URL(request.parameterBaseUrl);
    if (parameterBaseUrl.origin !== self.location.origin) {
      throw new Error('This experiment uses same-origin parameter fixtures.');
    }
    scope.postMessage({ id, type: 'stage', stage: 'loading' });
    const loadStart = performance.now();
    const warm = initialized;
    const { InMemorySpendingKey, SaplingToolkit, initSapling, preloadSaplingParams } =
      await import('@taquito/sapling');
    await initSapling({
      params: {
        spendParamsUrl: new URL('spend.params', parameterBaseUrl).href,
        outputParamsUrl: new URL('output.params', parameterBaseUrl).href,
        spendParamsSha256: fixture.spendHash,
        outputParamsSha256: fixture.outputHash,
      },
    });
    await preloadSaplingParams();
    initialized = true;
    const preloadMs = performance.now() - loadStart;
    scope.postMessage({ id, type: 'stage', stage: 'proving' });
    const proofStart = performance.now();
    const key = await InMemorySpendingKey.fromMnemonic(fixture.mnemonic);
    const viewingKey = await key.getSaplingViewingKeyProvider();
    const { address: recipient } = await viewingKey.getAddress();
    // Only public read-provider calls are replaced. The SDK and WASM prove the real transaction.
    const readProvider = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'getChainId') return async () => fixture.chainId;
          if (property === 'getSaplingDiffByContract')
            return async () => ({
              root: fixture.emptyRoot,
              commitments_and_ciphertexts: [],
              nullifiers: [],
            });
          throw new Error(`Unexpected fixture read: ${String(property)}`);
        },
      },
    ) as TzReadProvider;
    const toolkit = new SaplingToolkit(
      { saplingSigner: key },
      { contractAddress: fixture.contractAddress, memoSize: fixture.memoSize },
      readProvider,
    );
    const transactionHex = await toolkit.prepareShieldedTransaction([
      { to: recipient, amount: 1, mutez: true, memo },
    ]);
    scope.postMessage({
      id,
      type: 'result',
      result: {
        transactionHex,
        recipient,
        memo,
        memoBytes,
        preloadMs,
        proofMs: performance.now() - proofStart,
        warm,
      },
    });
  } catch (error) {
    scope.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Sapling proof preparation failed.',
    });
  } finally {
    busy = false;
  }
}

scope.onmessage = (event) => {
  if (!isRequest(event.data) || busy) return;
  busy = true;
  void prepare(event.data);
};
