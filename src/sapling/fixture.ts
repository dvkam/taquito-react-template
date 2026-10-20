import { MAX_MEMO_BYTES } from './protocol';

// Public disposable fixture. Never fund this account or use its seed for a real account.
export const fixture = {
  chainId: 'NetXynUjJNZm7wi',
  contractAddress: 'KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC',
  emptyRoot: 'fbc2f4300c01f0b7820d00e3347c8da4ee614674376cbc45359daa54f9b5493e',
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  memoSize: MAX_MEMO_BYTES,
  spendHash: '8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13',
  outputHash: '2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4',
} as const;
