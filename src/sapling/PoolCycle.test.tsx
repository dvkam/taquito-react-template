import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import PoolCycle from './PoolCycle';
import { PoolReceiptError } from './pool-client';
import { publicPoolState } from './pool-observer';
import type { PoolSnapshot } from './pool-protocol';
const pool = vi.hoisted(() => ({
  runPoolCycle: vi.fn(),
  dispose: vi.fn(),
  createPoolWorker: vi.fn(),
}));
vi.mock('./pool-client', async (original) => ({
  ...(await original<typeof import('./pool-client')>()),
  runPoolCycle: pool.runPoolCycle,
  createPoolWorker: pool.createPoolWorker,
}));
beforeEach(() => {
  vi.resetAllMocks();
  pool.createPoolWorker.mockReturnValue({ dispose: pool.dispose });
});
it('does not present private diagnostic text after failure', async () => {
  pool.runPoolCycle.mockRejectedValue(new Error('gift é PRIVATE_BALANCE_7'));
  render(<PoolCycle />);
  expect(document.body.textContent).not.toMatch(/send 3|privately to Bob/);
  await userEvent.click(screen.getByRole('button', { name: 'Run local payment cycle' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('could not finish');
  expect(document.body.textContent).not.toContain('PRIVATE_BALANCE_7');
  expect(document.body.textContent).not.toContain('gift é');
});
it('keeps a confirmed operation receipt visible without private diagnostics', async () => {
  pool.runPoolCycle.mockRejectedValue(new PoolReceiptError('op-public-receipt'));
  render(<PoolCycle />);
  await userEvent.click(screen.getByRole('button', { name: 'Run local payment cycle' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Applied locally: op-public-receipt',
  );
  expect(screen.getByRole('alert').textContent).toContain('Do not resubmit');
});
it('disposes pending work on unmount and ignores late results', async () => {
  let complete!: (result: null) => void;
  pool.runPoolCycle.mockReturnValue(
    new Promise<null>((resolve) => {
      complete = resolve;
    }),
  );
  const rendered = render(<PoolCycle />);
  await userEvent.click(screen.getByRole('button', { name: 'Run local payment cycle' }));
  const active = pool.runPoolCycle.mock.calls[0]![2] as () => boolean;
  rendered.unmount();
  expect(active()).toBe(false);
  expect(pool.dispose).toHaveBeenCalled();
  await act(async () => {
    complete(null);
  });
  expect(screen.queryByText('Local payment cycle verified.')).toBeNull();
});

it('clears a private perspective before restart and defaults back to public on completion', async () => {
  const state: PoolSnapshot = {
    version: 3,
    contractAddress: 'pool',
    chainId: 'chain',
    diff: { root: 'root', commitments_and_ciphertexts: [], nullifiers: [] },
    poolMutez: '8000000',
    recipient: 'recipient',
    recipientMutez: '2000000',
    payer: 'payer',
    payerSpentMutez: '10500000',
    feesAndStorageMutez: '500000',
  };
  const completed = {
    snapshot: state,
    view: {
      aliceMutez: '7000000',
      bobMutez: '1000000',
      unrelatedMutez: '0',
      unrelatedIncomingCount: 0,
      aliceMemos: ['PRIVATE_ALICE'],
      bobMemos: ['PRIVATE_BOB'],
    },
    publicHistory: [publicPoolState(state)],
  };
  let complete!: (value: typeof completed) => void;
  pool.runPoolCycle.mockResolvedValueOnce(completed).mockReturnValueOnce(
    new Promise<typeof completed>((resolve) => {
      complete = resolve;
    }),
  );
  render(<PoolCycle />);
  const run = screen.getByRole('button', { name: 'Run local payment cycle' });
  await userEvent.click(run);
  await screen.findByRole('region', { name: 'Public chain report' });
  await userEvent.click(screen.getByRole('button', { name: /^Alice$/ }));
  expect(screen.getByText('PRIVATE_ALICE')).toBeDefined();
  await waitFor(() => expect(run.hasAttribute('disabled')).toBe(false));
  await userEvent.click(run);
  expect(screen.queryByText('PRIVATE_ALICE')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Alice viewing key report' })).toBeNull();
  await act(async () => {
    complete(completed);
  });
  expect(screen.getByRole('region', { name: 'Public chain report' })).toBeDefined();
  expect(screen.queryByText('PRIVATE_ALICE')).toBeNull();
});
