import type { PoolSnapshot } from './pool-protocol';

// Construct this report explicitly. Never spread worker-decrypted data into it.
export function publicPoolState(snapshot: PoolSnapshot, operationHash?: string) {
  return {
    version: snapshot.version,
    operationHash: operationHash ?? null,
    contractAddress: snapshot.contractAddress,
    chainId: snapshot.chainId,
    root: snapshot.diff.root,
    outputCount: snapshot.diff.commitments_and_ciphertexts.length,
    spentCount: snapshot.diff.nullifiers.length,
    poolMutez: snapshot.poolMutez,
    recipient: snapshot.recipient,
    recipientMutez: snapshot.recipientMutez,
    payer: snapshot.payer,
    feesAndStorageMutez: snapshot.feesAndStorageMutez,
  };
}
export type PublicPoolState = ReturnType<typeof publicPoolState>;

export function xtz(mutez: string) {
  const value = BigInt(mutez);
  const sign = value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  const fraction = (magnitude % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${sign}${magnitude / 1_000_000n}${fraction ? `.${fraction}` : ''} XTZ`;
}

export function publicPoolTimeline(history: PublicPoolState[]) {
  return history.slice(1).map((state, index) => {
    const before = history[index]!;
    const change = BigInt(state.poolMutez) - BigInt(before.poolMutez);
    return {
      version: state.version,
      operationHash: state.operationHash,
      label: change > 0n ? 'Deposit' : change < 0n ? 'Withdrawal' : 'Private update',
      backingChange: xtz(change.toString()),
      newOutputs: state.outputCount - before.outputCount,
      newNullifiers: state.spentCount - before.spentCount,
    };
  });
}
