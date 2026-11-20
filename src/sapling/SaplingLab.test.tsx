import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PreparedProof, ProofStage } from './protocol';
import SaplingLab from './SaplingLab';

const sdk = vi.hoisted(() => ({
  createProofClient: vi.fn(),
  verifyProof: vi.fn(),
  prepare: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('./client', () => sdk);
let stage: (value: ProofStage) => void;
const prepared: PreparedProof = {
  transactionHex: 'aabb',
  recipient: 'zet1-test-recipient',
  memo: 'é',
  memoBytes: 2,
  preloadMs: 1200,
  proofMs: 2400,
  warm: false,
};
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
  sdk.createProofClient.mockImplementation((listener: typeof stage) => {
    stage = listener;
    return { prepare: sdk.prepare, stop: sdk.stop, dispose: sdk.dispose };
  });
  sdk.prepare.mockResolvedValue(prepared);
  sdk.verifyProof.mockResolvedValue({ accepted: true, balance: '-1', protocol: 'Tallinn' });
});
it('opens without loading proof parameters and counts UTF-8 memo bytes', () => {
  render(<SaplingLab />);
  expect(screen.getByRole('heading', { name: 'Sapling proof lab' })).toBeDefined();
  expect(screen.getByText('No proof parameters loaded.')).toBeDefined();
  expect(screen.getByText('2 of 8 bytes')).toBeDefined();
  expect(sdk.prepare).not.toHaveBeenCalled();
});
it('keeps preparation distinct from independent Octez verification', async () => {
  const pending = deferred<PreparedProof>();
  sdk.prepare.mockReturnValueOnce(pending.promise);
  render(<SaplingLab />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Prepare proof' }));
  expect(sdk.prepare).toHaveBeenCalledWith('é');
  act(() => stage('proving'));
  expect(screen.getByText('Preparing a Sapling proof in the worker.')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'What is public?' }));
  expect(screen.getByText(/The shielding amount is public/)).toBeDefined();
  await act(async () => {
    pending.resolve(prepared);
    await pending.promise;
  });
  expect(screen.getByText('Proof prepared. Not yet verified.')).toBeDefined();
  expect(sdk.verifyProof).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Verify with Octez' }));
  await screen.findByText('Octez accepted this proof.');
  expect(sdk.verifyProof).toHaveBeenCalledWith('aabb', expect.any(AbortSignal));
});
it('rejects a nine-byte memo and accepts the eight-byte boundary', async () => {
  render(<SaplingLab />);
  const input = screen.getByLabelText('Private memo');
  fireEvent.change(input, { target: { value: 'ééééa' } });
  expect(screen.getByText(/9 of 8 bytes/)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Prepare proof' }).hasAttribute('disabled')).toBe(true);
  fireEvent.submit(input.closest('form')!);
  expect(sdk.prepare).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'éééé' } });
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  expect(sdk.prepare).toHaveBeenCalledWith('éééé');
});

it('stops a pending proof and ignores its late result after retry', async () => {
  const old = deferred<PreparedProof>();
  const current = deferred<PreparedProof>();
  sdk.prepare.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(sdk.stop).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await act(async () => {
    current.resolve({ ...prepared, transactionHex: 'ccdd' });
    await current.promise;
  });
  await act(async () => {
    old.resolve(prepared);
    await old.promise;
  });
  expect((screen.getByLabelText('Prepared transaction bytes') as HTMLTextAreaElement).value).toBe(
    'ccdd',
  );
  expect(screen.getByText('Proof prepared. Not yet verified.')).toBeDefined();
});

it('recovers from preparation failure through the same client', async () => {
  sdk.prepare.mockRejectedValueOnce(new Error('Parameter download failed'));
  render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Parameter download failed')).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Proof prepared. Not yet verified.');
  expect(sdk.createProofClient).toHaveBeenCalledOnce();
});

it('does not mark a rejected proof verified and can retry verification', async () => {
  sdk.verifyProof.mockResolvedValueOnce({ accepted: false, balance: null, protocol: 'Tallinn' });
  render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await userEvent.click(screen.getByRole('button', { name: 'Verify with Octez' }));
  await screen.findByText('Octez rejected this proof.');
  expect(screen.queryByText('Octez accepted this proof.')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
  await screen.findByText('Octez accepted this proof.');
  expect(sdk.prepare).toHaveBeenCalledOnce();
});

it('preserves prepared bytes after a verifier connection failure', async () => {
  sdk.verifyProof.mockRejectedValueOnce(new Error('Local verifier unavailable'));
  render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await userEvent.click(screen.getByRole('button', { name: 'Verify with Octez' }));
  await screen.findByText('Local verifier unavailable');
  expect((screen.getByLabelText('Prepared transaction bytes') as HTMLTextAreaElement).value).toBe(
    'aabb',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
  await screen.findByText('Octez accepted this proof.');
});

it('aborts verification on stop and ignores its late acceptance', async () => {
  const old = deferred<{ accepted: boolean; balance: string; protocol: string }>();
  sdk.verifyProof.mockReturnValueOnce(old.promise);
  render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await userEvent.click(screen.getByRole('button', { name: 'Verify with Octez' }));
  const signal = sdk.verifyProof.mock.calls[0]![1] as AbortSignal;
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(signal.aborted).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Proof prepared. Not yet verified.');
  await act(async () => {
    old.resolve({ accepted: true, balance: '-1', protocol: 'old' });
    await old.promise;
  });
  expect(screen.queryByText('Octez accepted this proof.')).toBeNull();
  expect(screen.getByText('Proof prepared. Not yet verified.')).toBeDefined();
});

it('disposes the client and aborts verification when the lab closes', async () => {
  sdk.verifyProof.mockReturnValueOnce(new Promise(() => {}));
  const view = render(<SaplingLab />);
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await userEvent.click(screen.getByRole('button', { name: 'Verify with Octez' }));
  const signal = sdk.verifyProof.mock.calls[0]![1] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(sdk.dispose).toHaveBeenCalledOnce();
});

it('uses the live client after StrictMode setup cleanup and can still prepare', async () => {
  const obsoletePrepare = vi.fn();
  sdk.createProofClient.mockImplementationOnce(() => ({
    prepare: obsoletePrepare,
    stop: sdk.stop,
    dispose: sdk.dispose,
  }));
  const view = render(
    <StrictMode>
      <SaplingLab />
    </StrictMode>,
  );
  expect(sdk.dispose).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Prepare proof' }));
  await screen.findByText('Proof prepared. Not yet verified.');
  expect(obsoletePrepare).not.toHaveBeenCalled();
  expect(sdk.prepare).toHaveBeenCalledOnce();
  view.unmount();
  expect(sdk.dispose).toHaveBeenCalledTimes(2);
});
