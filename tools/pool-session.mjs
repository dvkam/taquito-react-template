// Serialize RPC snapshots and submissions within one private mockup session.
export function createPoolSession(read, apply) {
  let busy = false;
  let uncertain = false;
  let version = 0;
  async function exclusive(action) {
    if (busy) throw new Error('POOL_BUSY');
    busy = true;
    try {
      return await action();
    } finally {
      busy = false;
    }
  }
  const snapshot = async () => ({ ...(await read()), version, uncertain });
  return {
    snapshot: () => exclusive(snapshot),
    submit: (input) =>
      exclusive(async () => {
        if (uncertain) throw new Error('POOL_OUTCOME_UNKNOWN');
        if (!Number.isSafeInteger(input.version) || input.version !== version)
          throw new Error('STALE_POOL_STATE');
        if (
          typeof input.transactionHex !== 'string' ||
          !/^(?:[0-9a-f]{2})+$/i.test(input.transactionHex) ||
          input.transactionHex.length > 40_000
        )
          throw new Error('INVALID_TRANSACTION');
        if (
          typeof input.amountMutez !== 'string' ||
          !/^(0|[1-9][0-9]{0,8})$/.test(input.amountMutez)
        )
          throw new Error('INVALID_AMOUNT');
        let result;
        try {
          result = await apply(input);
        } catch (error) {
          uncertain = true;
          throw error;
        }
        if (result.accepted) version++;
        try {
          return { ...result, snapshot: await snapshot() };
        } catch (error) {
          uncertain = true;
          throw error;
        }
      }),
  };
}
