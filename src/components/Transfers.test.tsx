import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { TezosToolkit } from '@taquito/taquito';
import Transfers from './Transfers';

it('sends fractional XTZ as exact mutez', async () => {
  const transfer = vi.fn(() => ({ send: async () => ({ confirmation: async () => {}, status: async () => 'applied' }) }));
  const toolkit = { wallet: { transfer }, tz: { getBalance: async () => ({ toNumber: () => 0 }) } };
  render(<Transfers Tezos={toolkit as unknown as TezosToolkit} setUserBalance={vi.fn()} userAddress="tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" />);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Recipient'), 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
  await user.type(screen.getByPlaceholderText('Amount'), '0.5');
  await user.click(screen.getByRole('button', { name: /Send/ }));
  await waitFor(() => expect(transfer).toHaveBeenCalledWith({ to: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', amount: 500000, mutez: true }));
});
