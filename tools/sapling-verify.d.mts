export type VerificationResult =
  | { accepted: true; protocol: string; boundData: string; balance: string }
  | { accepted: false; protocol: string; reason: 'verification-failed' | 'invalid-encoding' };
export function verifyTransaction(input: {
  transactionHex: string;
  contractAddress?: string;
  chainId?: string;
}): Promise<VerificationResult>;
