export const MAX_MEMO_BYTES = 8;
export type ProofStage = 'loading' | 'proving';

export type PreparedProof = {
  transactionHex: string;
  recipient: string;
  memo: string;
  memoBytes: number;
  preloadMs: number;
  proofMs: number;
  warm: boolean;
};

export type WorkerRequest = { id: number; memo: string; parameterBaseUrl: string };

export type WorkerResponse =
  | { id: number; type: 'stage'; stage: ProofStage }
  | { id: number; type: 'result'; result: PreparedProof }
  | { id: number; type: 'error'; message: string };

export type VerificationResult = {
  accepted: boolean;
  balance: string | null;
  protocol: string;
};
