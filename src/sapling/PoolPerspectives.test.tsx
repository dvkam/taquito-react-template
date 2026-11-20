import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import PoolPerspectives from './PoolPerspectives';
import { publicPoolState, publicPoolTimeline, xtz } from './pool-observer';
import type { PoolSnapshot, PoolView } from './pool-protocol';

export const snapshot: PoolSnapshot = {
  version: 0,
  contractAddress: 'KT1-local',
  chainId: 'Net-local',
  diff: { root: 'public-root', commitments_and_ciphertexts: [], nullifiers: [] },
  poolMutez: '0',
  recipient: 'tz1-public-recipient',
  recipientMutez: '0',
  payer: 'tz1-public-payer',
  payerSpentMutez: '0',
  feesAndStorageMutez: '0',
};
const view: PoolView = {
  aliceMutez: '7000000',
  bobMutez: '1000000',
  unrelatedMutez: '0',
  unrelatedIncomingCount: 0,
  aliceMemos: ['ALICE_PRIVATE_MEMO', ''],
  bobMemos: ['BOB_PRIVATE_MEMO_é'],
};
const history = ['0', '10000000', '10000000', '8000000'].map((poolMutez, version) =>
  publicPoolState({
    ...snapshot,
    version,
    poolMutez,
    recipientMutez: version === 3 ? '2000000' : '0',
    feesAndStorageMutez: version ? '580000' : '0',
  }),
);

it('allowlists public snapshot data and derives only public deltas', () => {
  const contaminated = { ...snapshot, ...view, memo: 'PRIVATE_SECRET' };
  const publicState = publicPoolState(contaminated);
  expect(Object.keys(publicState).sort()).toEqual(
    [
      'version',
      'operationHash',
      'contractAddress',
      'chainId',
      'root',
      'outputCount',
      'spentCount',
      'poolMutez',
      'recipient',
      'recipientMutez',
      'payer',
      'feesAndStorageMutez',
    ].sort(),
  );
  expect(JSON.stringify(publicState)).not.toContain('PRIVATE');
  expect(publicPoolTimeline(history).map((step) => [step.label, step.backingChange])).toEqual([
    ['Deposit', '10 XTZ'],
    ['Private update', '0 XTZ'],
    ['Withdrawal', '-2 XTZ'],
  ]);
});

it('starts public and removes private data across keyboard role changes', async () => {
  const user = userEvent.setup();
  render(<PoolPerspectives publicHistory={history} view={view} />);
  const observer = screen.getByRole('region', { name: 'Public chain report' });
  expect(within(observer).getByText('8000000 mutez')).toBeDefined();
  expect(observer.textContent).not.toMatch(/PRIVATE|7000000|1000000|3 XTZ|Alice|Bob/);
  await user.tab();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('region', { name: 'Alice viewing key report' })).toBeDefined();
  expect(screen.getByText('7000000 mutez')).toBeDefined();
  expect(screen.queryByText('BOB_PRIVATE_MEMO_é')).toBeNull();
  await user.click(screen.getByRole('button', { name: /^Bob$/ }));
  expect(screen.queryByText('ALICE_PRIVATE_MEMO')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Alice viewing key report' })).toBeNull();
  expect(screen.getByText('1000000 mutez')).toBeDefined();
  expect(screen.getByText('BOB_PRIVATE_MEMO_é')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Public observer' }));
  expect(screen.queryByText('BOB_PRIVATE_MEMO_é')).toBeNull();
  expect(screen.queryByText('7000000 mutez')).toBeNull();
  expect(screen.queryByText('1000000 mutez')).toBeNull();
  expect(screen.getByText(/not access rights/)).toBeDefined();
});

it('formats integer mutez exactly, including fees and negative public deltas', () => {
  expect(xtz('10000001')).toBe('10.000001 XTZ');
  expect(xtz('584129')).toBe('0.584129 XTZ');
  expect(xtz('-1')).toBe('-0.000001 XTZ');
  expect(xtz('0')).toBe('0 XTZ');
  expect(xtz('9007199254740993000001')).toBe('9007199254740993.000001 XTZ');
});
