import { BeaconEvent, BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, PermissionScope } from '@taquito/beacon-wallet/types';
import { TezosToolkit } from '@taquito/taquito';
import { network } from './network';
import { parseTransfer } from './transfer';

const tezos = new TezosToolkit(network.rpcUrl);
const wallet = new BeaconWallet({
  name: 'Taquito React template',
  preferredNetwork: NetworkType.SHADOWNET,
  // The application reports permission errors and treats cancellation as a normal exit.
  eventHandlers: { [BeaconEvent.PERMISSION_REQUEST_ERROR]: { handler: async () => {} } },
});
tezos.setWalletProvider(wallet);
type Account = Awaited<ReturnType<typeof wallet.client.getActiveAccount>>;
type Observer = (address: string | undefined, error: unknown) => void;
const observers = new Set<Observer>();
let revision = 0;
let subscription: Promise<void> | undefined;
let writePending = false;

function addressOf(account: Account) {
  if (account && account.network.type !== NetworkType.SHADOWNET)
    throw new Error('Select a Shadownet wallet account.');
  return account?.address;
}

function publish(account: Account) {
  revision += 1;
  let address: string | undefined;
  let error: unknown;
  try {
    address = addressOf(account);
  } catch (cause) {
    error = cause;
  }
  for (const observer of observers) observer(address, error);
}

export function subscribeAccount(observer: Observer) {
  observers.add(observer);
  subscription ??= wallet.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, publish);
  const expectedRevision = revision;
  void subscription.then(
    async () => {
      try {
        const account = await wallet.client.getActiveAccount();
        if (observers.has(observer) && revision === expectedRevision)
          observer(addressOf(account), undefined);
      } catch (error) {
        if (observers.has(observer) && revision === expectedRevision) observer(undefined, error);
      }
    },
    (error: unknown) => {
      subscription = undefined;
      if (observers.has(observer)) observer(undefined, error);
    },
  );
  return () => {
    observers.delete(observer);
  };
}

async function checkChain() {
  if ((await tezos.rpc.getChainId()) !== network.chainId)
    throw new Error('The RPC endpoint is not on Shadownet.');
}

export async function connectWallet(): Promise<void> {
  await checkChain();
  const expectedRevision = revision;
  await wallet.requestPermissions({ scopes: [PermissionScope.OPERATION_REQUEST] });
  const account = await wallet.client.getActiveAccount();
  if (revision !== expectedRevision) return;
  if (!addressOf(account)) throw new Error('The wallet did not return an account address.');
  publish(account);
}

export async function disconnectWallet(): Promise<void> {
  const expectedRevision = revision;
  await wallet.disconnect();
  if (revision === expectedRevision) publish(undefined);
}

export async function getBalance(address: string): Promise<string> {
  await checkChain();
  return (await tezos.tz.getBalance(address)).dividedBy(1_000_000).toFixed();
}

async function counterContract() {
  const contract = await tezos.wallet.at(network.counterAddress);
  const entries = contract.entrypoints.entrypoints;
  const storage = contract.script.code.find(
    (part) => !Array.isArray(part) && 'prim' in part && part.prim === 'storage',
  );
  const storageType =
    storage && !Array.isArray(storage) && 'args' in storage ? storage.args?.[0] : undefined;
  if (
    !storageType ||
    Array.isArray(storageType) ||
    !('prim' in storageType) ||
    storageType.prim !== 'int' ||
    entries['increment']?.prim !== 'int' ||
    entries['decrement']?.prim !== 'int'
  )
    throw new Error(
      'The configured counter does not have integer storage and counter entrypoints.',
    );
  return contract;
}

export async function getCounter(): Promise<string> {
  await checkChain();
  await counterContract();
  const storage: unknown = await tezos.rpc.getStorage(network.counterAddress);
  if (
    !storage ||
    typeof storage !== 'object' ||
    !('int' in storage) ||
    typeof storage.int !== 'string' ||
    !/^-?\d+$/.test(storage.int)
  )
    throw new Error('The counter did not return integer storage.');
  return storage.int;
}

async function checkSender(sender: string) {
  const current = addressOf(await wallet.client.getActiveAccount());
  if (!current) throw new Error('Connect a wallet before sending an operation.');
  if (current !== sender)
    throw new Error('The wallet account changed. Review the account and retry.');
}

type Operation = { opHash: string; confirmation(): Promise<unknown>; status(): Promise<string> };
async function write(send: () => Promise<Operation>): Promise<string> {
  if (writePending) throw new Error('Another operation is pending.');
  writePending = true;
  try {
    const operation = await send();
    await operation.confirmation();
    const status = await operation.status();
    if (status !== 'applied')
      throw new Error(`The operation was included but execution ${status}.`);
    return operation.opHash;
  } finally {
    writePending = false;
  }
}

export async function sendTezos(receiver: string, amount: string, sender: string): Promise<string> {
  const transfer = parseTransfer(receiver, amount);
  return write(async () => {
    await checkChain();
    await checkSender(sender);
    return tezos.wallet.transfer(transfer).send();
  });
}

export async function changeCounter(
  direction: 'increment' | 'decrement',
  sender: string,
): Promise<string> {
  return write(async () => {
    await checkChain();
    const contract = await counterContract();
    await checkSender(sender);
    const method = contract.methodsObject[direction];
    if (!method) throw new Error('The configured counter entrypoint is unavailable.');
    return method(1).send({ amount: 0 });
  });
}
