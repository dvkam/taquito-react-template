import { describe, expect, it } from 'vitest';
import { parseTransfer } from './transfer';

const receiver = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';

describe('Tezos transfer validation', () => {
  it.each([
    ['0.000001', 1],
    ['0.1', 100000],
    ['1.234567', 1234567],
    ['9007199254.740991', Number.MAX_SAFE_INTEGER],
  ])('converts %s XTZ to exact mutez', (amount, expected) => {
    expect(parseTransfer(` ${receiver} `, amount)).toEqual({
      to: receiver,
      amount: expected,
      mutez: true,
    });
  });
  it.each(['', '0', '-1', 'NaN', 'Infinity', '1e3', '0.0000001', '1.2345678', '9007199254.740992'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => parseTransfer(receiver, amount)).toThrow();
    },
  );
  it('rejects invalid receivers before attempting any wallet interaction', () => {
    expect(() => parseTransfer('invalid', '1')).toThrow(/receiver address/);
  });
});
