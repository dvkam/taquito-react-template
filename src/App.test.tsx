import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

const sdk = vi.hoisted(() => ({
  subscribeAccount: vi.fn(),
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  getBalance: vi.fn(),
  getCounter: vi.fn(),
  sendTezos: vi.fn(),
  changeCounter: vi.fn(),
}));
vi.mock('./Wallet', () => sdk);
const alice = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';
let emit: (address: string | undefined, error: unknown) => void;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(alice, undefined);
    return vi.fn();
  });
  sdk.getBalance.mockResolvedValue('0');
  sdk.getCounter.mockResolvedValue('42');
  sdk.sendTezos.mockResolvedValue('op-transfer');
  sdk.changeCounter.mockResolvedValue('op-counter');
});
async function fillTransfer() {
  const user = userEvent.setup();
  await screen.findByText('Balance: 0 ꜩ');
  await user.type(screen.getByLabelText('Receiver address'), alice);
  await user.type(screen.getByLabelText('Amount in XTZ'), '0.5');
  return user;
}
it('preserves fractional input at the wallet boundary', async () => {
  render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  await screen.findByText('op-transfer');
  expect(sdk.sendTezos).toHaveBeenCalledWith(alice, '0.5', alice);
});
it('keeps transfer available when the counter cannot load', async () => {
  sdk.getCounter.mockRejectedValue(new Error('Counter unavailable'));
  render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Counter contract' }));
  await screen.findByText('Counter unavailable');
  expect(screen.getByRole('button', { name: 'Increase by 1' }).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Transfer' }));
  expect(screen.getByRole('button', { name: 'Send test XTZ' }).hasAttribute('disabled')).toBe(
    false,
  );
});
it('blocks transfer and both counter directions while one write is pending', async () => {
  const request = deferred<string>();
  sdk.changeCounter.mockReturnValue(request.promise);
  render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Counter contract' }));
  await user.click(screen.getByRole('button', { name: 'Increase by 1' }));
  for (const name of ['Increase by 1', 'Decrease by 1', 'Disconnect'])
    expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Transfer' }));
  expect(screen.getByRole('button', { name: 'Send test XTZ' }).hasAttribute('disabled')).toBe(true);
  expect(sdk.changeCounter).toHaveBeenCalledExactlyOnceWith('increment', alice);
  await act(async () => request.resolve('op-counter'));
});
it('supports decrement and retains the receipt when a refresh fails', async () => {
  render(<App />);
  const user = await fillTransfer();
  sdk.getBalance.mockRejectedValue(new Error('Balance refresh failed'));
  await user.click(screen.getByRole('button', { name: 'Counter contract' }));
  await user.click(screen.getByRole('button', { name: 'Decrease by 1' }));
  await screen.findByText('op-counter');
  await screen.findByText('Balance refresh failed');
  expect(sdk.changeCounter).toHaveBeenCalledExactlyOnceWith('decrement', alice);
  sdk.getBalance.mockResolvedValue('2');
  await user.click(screen.getByRole('button', { name: 'Refresh balance and counter' }));
  await screen.findByText('Balance: 2 ꜩ');
  expect(screen.getByText('op-counter')).toBeTruthy();
});
it.each(['success', 'failure'])('ignores old transfer %s after A to B to A', async (result) => {
  const request = deferred<string>();
  sdk.sendTezos.mockReturnValue(request.promise);
  render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  act(() => {
    emit('other-account', undefined);
    emit(alice, undefined);
  });
  await act(async () => {
    if (result === 'success') request.resolve('old-operation');
    else request.reject(new Error('Old error'));
  });
  expect(screen.queryByText('old-operation')).toBeNull();
  expect(screen.queryByText('Old error')).toBeNull();
  expect((screen.getByLabelText('Amount in XTZ') as HTMLInputElement).value).toBe('');
});
it('ignores stale balance results and clears the disconnected view', async () => {
  const old = deferred<string>();
  sdk.getBalance.mockReturnValueOnce(old.promise);
  render(<App />);
  act(() => {
    emit('other-account', undefined);
    emit(alice, undefined);
  });
  await screen.findByText('Balance: 0 ꜩ');
  await act(async () => old.resolve('999'));
  expect(screen.queryByText('Balance: 999 ꜩ')).toBeNull();
  act(() => emit(undefined, undefined));
  await waitFor(() => expect(screen.queryByLabelText('Amount in XTZ')).toBeNull());
});
it('preserves input on wallet rejection', async () => {
  sdk.sendTezos.mockRejectedValue(new Error('Request rejected'));
  render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Amount in XTZ') as HTMLInputElement).value).toBe('0.5');
});

it('submits only once when the form receives two immediate submit events', async () => {
  const request = deferred<string>();
  sdk.sendTezos.mockReturnValue(request.promise);
  render(<App />);
  await fillTransfer();
  const form = screen.getByRole('form', { name: 'Send test XTZ' });
  act(() => {
    fireEvent.submit(form);
  });
  act(() => {
    fireEvent.submit(form);
  });
  await waitFor(() => expect(sdk.sendTezos).toHaveBeenCalledExactlyOnceWith(alice, '0.5', alice));
  await act(async () => request.resolve('single-operation'));
  expect(await screen.findByText('single-operation')).toBeTruthy();
});

it.each(['success', 'failure'])('ignores a transfer %s after unmount', async (outcome) => {
  const request = deferred<string>();
  const unsubscribe = vi.fn();
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(alice, undefined);
    return unsubscribe;
  });
  sdk.sendTezos.mockReturnValue(request.promise);
  const view = render(<App />);
  const user = await fillTransfer();
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
  const reads = sdk.getBalance.mock.calls.length;
  await act(async () => {
    if (outcome === 'success') request.resolve('unmounted-operation');
    else request.reject(new Error('Unmounted failure'));
  });
  expect(sdk.getBalance).toHaveBeenCalledTimes(reads);
  render(<App />);
  await screen.findByText('Balance: 0 ꜩ');
  expect(screen.queryByText('unmounted-operation')).toBeNull();
  expect(screen.queryByText('Unmounted failure')).toBeNull();
});

it.each(['success', 'failure'])('ignores a stale counter %s after A to B to A', async (outcome) => {
  const old = deferred<string>();
  sdk.getCounter.mockReturnValueOnce(old.promise);
  render(<App />);
  const user = userEvent.setup();
  act(() => {
    emit('other-account', undefined);
  });
  act(() => {
    emit(alice, undefined);
  });
  await user.click(screen.getByRole('button', { name: 'Counter contract' }));
  await screen.findByText('Current counter: 42');
  await act(async () => {
    if (outcome === 'success') old.resolve('999');
    else old.reject(new Error('Old counter failed'));
  });
  expect(screen.getByText('Current counter: 42')).toBeTruthy();
  expect(screen.queryByText('Current counter: 999')).toBeNull();
  expect(screen.queryByText('Old counter failed')).toBeNull();
});

it('connects, disconnects, and reconnects using account events', async () => {
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(undefined, undefined);
    return vi.fn();
  });
  sdk.connectWallet.mockImplementation(async () => {
    emit(alice, undefined);
  });
  sdk.disconnectWallet.mockImplementation(async () => {
    emit(undefined, undefined);
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
  await screen.findByText('Balance: 0 ꜩ');
  expect(screen.getByText(alice)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Disconnect' }));
  expect(screen.queryByLabelText('Amount in XTZ')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Connect wallet' }));
  await screen.findByText('Balance: 0 ꜩ');
  expect(sdk.connectWallet).toHaveBeenCalledTimes(2);
  expect(sdk.disconnectWallet).toHaveBeenCalledOnce();
  expect(screen.queryByText(/Confirmed operation/)).toBeNull();
});

it('does not show a late connection failure after a newer account event', async () => {
  const connection = deferred<void>();
  sdk.connectWallet.mockReturnValue(connection.promise);
  render(<App />);
  const user = userEvent.setup();
  await screen.findByText('Balance: 0 ꜩ');
  await user.click(screen.getByRole('button', { name: 'Switch account' }));
  act(() => {
    emit('other-account', undefined);
  });
  await act(async () => connection.reject(new Error('Old connection failed')));
  expect(screen.getByText('other-account')).toBeTruthy();
  expect(screen.queryByText('Old connection failed')).toBeNull();
  expect(screen.getByRole('button', { name: 'Disconnect' })).toHaveProperty('disabled', false);
});

it('closes a cancelled connection without an error and permits retry', async () => {
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(undefined, undefined);
    return vi.fn();
  });
  sdk.connectWallet.mockRejectedValueOnce({
    message: '[ABORTED_ERROR]:The action was aborted by the user.',
  });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toHaveProperty(
      'disabled',
      false,
    ),
  );
  expect(screen.queryByRole('alert')).toBeNull();
  sdk.connectWallet.mockImplementationOnce(async () => {
    emit(alice, undefined);
  });
  await user.click(screen.getByRole('button', { name: 'Connect wallet' }));
  await screen.findByText('Balance: 0 ꜩ');
  expect(sdk.connectWallet).toHaveBeenCalledTimes(2);
});

it('shows genuine non-Error wallet failures', async () => {
  sdk.connectWallet.mockRejectedValueOnce({ message: 'Transport failed' });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Switch account' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Transport failed');
});

it('describes wallet connection without claiming network confirmation', async () => {
  const request = deferred<void>();
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(undefined, undefined);
    return vi.fn();
  });
  sdk.connectWallet.mockReturnValue(request.promise);
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
  expect(await screen.findByText('Waiting for wallet connection…')).toBeTruthy();
  expect(screen.queryByText('Waiting for wallet approval and network confirmation…')).toBeNull();
  await act(async () => request.resolve());
});

it('shows the public counter without a wallet and keeps writes disabled', async () => {
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(undefined, undefined);
    return vi.fn();
  });
  render(<App />);
  expect(await screen.findByText('Current counter: 42')).toBeTruthy();
  expect(screen.getByText('Connect a wallet to change the counter.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Increase by 1' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Decrease by 1' }).hasAttribute('disabled')).toBe(true);
  expect(sdk.getBalance).not.toHaveBeenCalled();
  expect(sdk.connectWallet).not.toHaveBeenCalled();
  expect(sdk.changeCounter).not.toHaveBeenCalled();
});

it('retries public counter reads without requesting wallet access', async () => {
  sdk.subscribeAccount.mockImplementation((listener: typeof emit) => {
    emit = listener;
    listener(undefined, undefined);
    return vi.fn();
  });
  sdk.getCounter.mockRejectedValue(new Error('Counter temporarily unavailable'));
  render(<App />);
  await screen.findByText('Counter temporarily unavailable');
  sdk.getCounter.mockResolvedValue('43');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh counter' }));
  expect(await screen.findByText('Current counter: 43')).toBeTruthy();
  expect(sdk.connectWallet).not.toHaveBeenCalled();
});
