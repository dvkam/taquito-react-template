import assert from 'node:assert/strict';
import { createPoolSession } from './pool-session.mjs';
const actions = ['accept', 'reject', 'unknown', 'stale', 'snapshot'];
let histories = 0;
async function check(sequence) {
  let applied = 0;
  let expectedVersion = 0;
  let quarantined = false;
  let outcome;
  let release;
  const session = createPoolSession(
    async () => ({ applied }),
    async () => {
      await new Promise((resolve) => {
        release = resolve;
      });
      if (outcome === 'unknown') {
        applied++;
        throw new Error('timeout');
      }
      if (outcome === 'accept') applied++;
      return { accepted: outcome === 'accept' };
    },
  );
  for (const action of sequence) {
    const input = { version: expectedVersion, transactionHex: 'aa', amountMutez: '0' };
    if (action === 'snapshot') {
      const snapshot = await session.snapshot();
      assert.equal(snapshot.version, expectedVersion);
      assert.equal(snapshot.uncertain, quarantined);
      continue;
    }
    if (quarantined) {
      await assert.rejects(session.submit(input), /POOL_OUTCOME_UNKNOWN/);
      continue;
    }
    if (action === 'stale') {
      await assert.rejects(session.submit({ ...input, version: -1 }), /STALE_POOL_STATE/);
      continue;
    }
    outcome = action;
    const submitted = session.submit(input);
    // The real session guard must reject every overlapping reader and writer.
    await assert.rejects(session.snapshot(), /POOL_BUSY/);
    await assert.rejects(session.submit(input), /POOL_BUSY/);
    release();
    if (action === 'unknown') {
      await assert.rejects(submitted, /timeout/);
      quarantined = true;
    } else {
      const result = await submitted;
      if (action === 'accept') expectedVersion++;
      assert.equal(result.accepted, action === 'accept');
      assert.equal(result.snapshot.version, expectedVersion);
      assert.equal(result.snapshot.applied, expectedVersion);
    }
  }
  histories++;
}
async function enumerate(prefix, remaining) {
  await check(prefix);
  if (remaining) for (const action of actions) await enumerate([...prefix, action], remaining - 1);
}
await enumerate([], 4);
console.log(
  `Checked ${histories} histories of up to four actions against the real session module, including overlapping calls.`,
);

let readsFail = false;
const receiptSession = createPoolSession(
  async () => {
    if (readsFail) throw new Error('read unavailable');
    return {};
  },
  async () => {
    readsFail = true;
    return { accepted: true, operationHash: 'known-local-receipt' };
  },
);
const receipt = await receiptSession.submit({ version: 0, transactionHex: 'aa', amountMutez: '0' });
assert.equal(receipt.accepted, true);
assert.equal(receipt.operationHash, 'known-local-receipt');
assert.equal(receipt.snapshot, null);
assert.equal(receipt.version, 1);
await assert.rejects(
  receiptSession.submit({ version: 1, transactionHex: 'aa', amountMutez: '0' }),
  /POOL_OUTCOME_UNKNOWN/,
);
console.log('Confirmed receipt survives a failed state refresh.');
