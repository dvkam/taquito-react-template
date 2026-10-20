import type { TzReadProvider } from '@taquito/taquito';
export type PoolSnapshot = {
  version: number;
  contractAddress: string;
  chainId: string;
  diff: Awaited<ReturnType<TzReadProvider['getSaplingDiffByContract']>>;
  poolMutez: string;
  recipient: string;
  recipientMutez: string;
  payer: string;
  payerSpentMutez: string;
  feesAndStorageMutez: string;
};
export type PoolAction = 'shield' | 'transfer' | 'unshield' | 'observe';
export type PoolRequest = { action: PoolAction; snapshot: PoolSnapshot; parameterBaseUrl: string };
export type PoolView = {
  aliceMutez: string;
  bobMutez: string;
  unrelatedMutez: string;
  aliceMemos: string[];
  bobMemos: string[];
};
export type PoolResponse = { transactionHex?: string; view?: PoolView; error?: string };
