import { validateAddress, ValidationResult } from '@taquito/utils';

export function parseTransfer(receiver: string, amount: string) {
  const to = receiver.trim();
  if (validateAddress(to) !== ValidationResult.VALID) {
    throw new Error('Enter a valid Tezos receiver address.');
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) throw new Error('Enter a positive XTZ amount with up to six decimal places.');
  const mutez = Number(`${match[1]}${(match[2] ?? '').padEnd(6, '0')}`);
  if (!Number.isSafeInteger(mutez) || mutez <= 0) {
    throw new Error('The amount must be positive and fit in the supported mutez range.');
  }
  return { to, amount: mutez, mutez: true } as const;
}
