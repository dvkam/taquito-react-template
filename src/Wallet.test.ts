import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  subscribe: vi.fn(),
  permissions: vi.fn(),
  disconnect: vi.fn(),
  chain: vi.fn(),
  balance: vi.fn(),
  storage: vi.fn(),
  at: vi.fn(),
  transfer: vi.fn(),
  send: vi.fn(),
  confirm: vi.fn(),
  status: vi.fn(),
  increment: vi.fn(),
  decrement: vi.fn(),
}));
vi.mock('@taquito/beacon-wallet', () => ({
  BeaconEvent: { ACTIVE_ACCOUNT_SET: 'active' },
  BeaconWallet: class {
    client = { getActiveAccount: mocks.account, subscribeToEvent: mocks.subscribe };
    requestPermissions = mocks.permissions;
    disconnect = mocks.disconnect;
  },
}));
vi.mock('@taquito/taquito', () => ({
  TezosToolkit: class {
    rpc = { getChainId: mocks.chain, getStorage: mocks.storage };
    tz = { getBalance: mocks.balance };
    wallet = { at: mocks.at, transfer: mocks.transfer };
    setWalletProvider() {}
  },
}));
const address = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';
const account = { address, network: { type: 'shadownet' } };
const contract = () => ({
  script: { code: [{ prim: 'storage', args: [{ prim: 'int' }] }] },
  entrypoints: { entrypoints: { increment: { prim: 'int' }, decrement: { prim: 'int' } } },
  methodsObject: { increment: mocks.increment, decrement: mocks.decrement },
});
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.account.mockResolvedValue(account);
  mocks.subscribe.mockResolvedValue(undefined);
  mocks.permissions.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.chain.mockResolvedValue('NetXsqzbfFenSTS');
  mocks.at.mockResolvedValue(contract());
  mocks.storage.mockResolvedValue({ int: '900719925474099312345' });
  mocks.transfer.mockReturnValue({ send: mocks.send });
  mocks.increment.mockReturnValue({ send: mocks.send });
  mocks.decrement.mockReturnValue({ send: mocks.send });
  mocks.send.mockResolvedValue({
    opHash: 'op-applied',
    confirmation: mocks.confirm,
    status: mocks.status,
  });
  mocks.confirm.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue('applied');
});

it('sends exact mutez and requires applied execution', async () => {
  const wallet = await import('./Wallet');
  expect(await wallet.sendTezos(address, '0.000001', address)).toBe('op-applied');
  expect(mocks.transfer).toHaveBeenCalledWith({ to: address, amount: 1, mutez: true });
  for (const status of ['failed', 'backtracked', 'skipped']) {
    mocks.status.mockResolvedValue(status);
    await expect(wallet.sendTezos(address, '1', address)).rejects.toThrow(status);
  }
});

it('rejects a wrong RPC chain before reads or writes', async () => {
  const wallet = await import('./Wallet');
  mocks.chain.mockResolvedValue('mainnet');
  await expect(wallet.getCounter()).rejects.toThrow(/Shadownet/);
  await expect(wallet.getBalance(address)).rejects.toThrow(/Shadownet/);
  await expect(wallet.sendTezos(address, '1', address)).rejects.toThrow(/Shadownet/);
  expect(mocks.at).not.toHaveBeenCalled();
  expect(mocks.transfer).not.toHaveBeenCalled();
});

it('returns exact counter storage and sends both directions with one and zero tez', async () => {
  const wallet = await import('./Wallet');
  expect(await wallet.getCounter()).toBe('900719925474099312345');
  for (const direction of ['increment', 'decrement'] as const) {
    expect(await wallet.changeCounter(direction, address)).toBe('op-applied');
    expect(mocks[direction]).toHaveBeenCalledWith(1);
    expect(mocks.send).toHaveBeenLastCalledWith({ amount: 0 });
  }
});

it('rejects invalid counter deployment or storage', async () => {
  const wallet = await import('./Wallet');
  mocks.at.mockResolvedValue({ ...contract(), entrypoints: { entrypoints: {} } });
  await expect(wallet.getCounter()).rejects.toThrow(/counter/i);
  mocks.at.mockResolvedValue({
    ...contract(),
    script: { code: [{ prim: 'storage', args: [{ prim: 'nat' }] }] },
  });
  await expect(wallet.getCounter()).rejects.toThrow(/counter/i);
  mocks.at.mockResolvedValue(contract());
  mocks.storage.mockResolvedValue({ int: '1.5' });
  await expect(wallet.getCounter()).rejects.toThrow(/integer/i);
});

it('checks the sender after contract loading and rejects wrong wallet networks', async () => {
  const wallet = await import('./Wallet');
  mocks.at.mockImplementation(() => {
    mocks.account.mockResolvedValue({ ...account, address: 'another-address' });
    return Promise.resolve(contract());
  });
  await expect(wallet.changeCounter('increment', address)).rejects.toThrow(/changed/);
  expect(mocks.send).not.toHaveBeenCalled();
  mocks.account.mockResolvedValue({ ...account, network: { type: 'ghostnet' } });
  await expect(wallet.sendTezos(address, '1', address)).rejects.toThrow(/Shadownet/);
});

it('blocks concurrent writes until confirmation completes', async () => {
  const wallet = await import('./Wallet');
  let finish!: () => void;
  mocks.confirm.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const first = wallet.sendTezos(address, '1', address);
  await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
  await expect(wallet.changeCounter('increment', address)).rejects.toThrow(/pending/);
  finish();
  await expect(first).resolves.toBe('op-applied');
});

it('ignores stale restore and permission reads after newer account events', async () => {
  const wallet = await import('./Wallet');
  let restore!: (value: typeof account) => void;
  mocks.account.mockReturnValueOnce(
    new Promise((resolve) => {
      restore = resolve;
    }),
  );
  const observer = vi.fn();
  const stop = wallet.subscribeAccount(observer);
  await vi.waitFor(() => expect(mocks.account).toHaveBeenCalled());
  const emit = mocks.subscribe.mock.calls[0]?.[1] as (value: typeof account | undefined) => void;
  const next = { ...account, address: 'next-address' };
  emit(next);
  restore(account);
  await Promise.resolve();
  expect(observer).toHaveBeenLastCalledWith('next-address', undefined);
  let permissionRead!: (value: typeof account) => void;
  mocks.account.mockReturnValueOnce(
    new Promise((resolve) => {
      permissionRead = resolve;
    }),
  );
  const connecting = wallet.connectWallet();
  await vi.waitFor(() => expect(mocks.account).toHaveBeenCalledTimes(2));
  emit(next);
  permissionRead(account);
  await connecting;
  expect(observer).toHaveBeenLastCalledWith('next-address', undefined);
  stop();
  observer.mockClear();
  emit(undefined);
  expect(observer).not.toHaveBeenCalled();
});

it('publishes permission fallback and disconnect through account observers', async () => {
  const wallet = await import('./Wallet');
  const observer = vi.fn();
  const stop = wallet.subscribeAccount(observer);
  await vi.waitFor(() => expect(observer).toHaveBeenCalledWith(address, undefined));
  await wallet.connectWallet();
  expect(observer).toHaveBeenLastCalledWith(address, undefined);
  await wallet.disconnectWallet();
  expect(observer).toHaveBeenLastCalledWith(undefined, undefined);
  expect(mocks.disconnect).toHaveBeenCalledOnce();
  await wallet.connectWallet();
  expect(observer).toHaveBeenLastCalledWith(address, undefined);
  stop();
});

it('reports invalid restored accounts and missing permission accounts', async () => {
  const wallet = await import('./Wallet');
  mocks.account.mockResolvedValue({ ...account, network: { type: 'mainnet' } });
  const observer = vi.fn();
  const stop = wallet.subscribeAccount(observer);
  await vi.waitFor(() => expect(observer).toHaveBeenCalledWith(undefined, expect.any(Error)));
  mocks.account.mockResolvedValue(undefined);
  await expect(wallet.connectWallet()).rejects.toThrow(/did not return/);
  await expect(wallet.sendTezos(address, '1', address)).rejects.toThrow(/Connect/);
  expect(mocks.send).not.toHaveBeenCalled();
  stop();
});

it('checks counter execution status and releases the write guard on failure', async () => {
  const wallet = await import('./Wallet');
  mocks.status.mockResolvedValueOnce('failed');
  await expect(wallet.changeCounter('increment', address)).rejects.toThrow(/failed/);
  await expect(wallet.changeCounter('decrement', address)).resolves.toBe('op-applied');
});

it('keeps one SDK subscription while removing individual observers', async () => {
  const wallet = await import('./Wallet');
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = wallet.subscribeAccount(first);
  const stopSecond = wallet.subscribeAccount(second);
  await vi.waitFor(() => expect(second).toHaveBeenCalledWith(address, undefined));
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  stopFirst();
  first.mockClear();
  const emit = mocks.subscribe.mock.calls[0]?.[1] as (value: undefined) => void;
  emit(undefined);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenLastCalledWith(undefined, undefined);
  stopSecond();
});
