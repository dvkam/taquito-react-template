import type { PoolSnapshot } from './pool-protocol';
export type OrderVariant = 'baseline' | 'candidate-default' | 'candidate-randomized';
export type OrderAction =
  | 'seed'
  | 'multi-seed'
  | 'transfer'
  | 'change-spend'
  | 'withdraw'
  | 'exact-multi'
  | 'multi'
  | 'observe';
export type OrderRequest = {
  variant: OrderVariant;
  action: OrderAction;
  snapshot: PoolSnapshot;
  parameterBaseUrl: string;
};
export type OrderNote = { position: number; value: string; memo: string };
export type OrderView = { balances: string[]; notes: OrderNote[][] };
export type OrderResponse = {
  transactionHex?: string;
  preview?: OrderView;
  view?: OrderView;
  error?: string;
};
