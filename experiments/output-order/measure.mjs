import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const require = createRequire(new URL('../../package.json', import.meta.url));
const sourceRequire = createRequire(
  '/home/david/workspace/taquito/packages/taquito-sapling/package.json',
);
const BigNumber = sourceRequire('bignumber.js').default;
const path = (variant, file) =>
  fileURLToPath(
    new URL(`.cache/output-order/${variant}/packages/taquito-sapling/dist/${file}`, root),
  );
const baseline = require(
  path('baseline', 'lib/sapling-tx-builder/sapling-transactions-builder.js'),
).SaplingTransactionBuilder;
const candidate = require(
  path('candidate', 'lib/sapling-tx-builder/sapling-transactions-builder.js'),
).SaplingTransactionBuilder;
const packagedBaseline =
  require('@taquito/sapling/dist/lib/sapling-tx-builder/sapling-transactions-builder.js').SaplingTransactionBuilder;
const forger = new (require(
  path('baseline', 'lib/sapling-forger/sapling-forger.js'),
).SaplingForger)();
const { shuffleOutputs } = require(path('candidate', 'lib/sapling-tx-builder/shuffle-outputs.js'));
const address = 'zet12mVvzJ4QJhnNQetGHzdwTMcLgNrdC4SFact6BB5jpeqGAefWip3iGgEjvDA9z7b9Y';
const secureBytes = (length) => webcrypto.getRandomValues(new Uint8Array(length));
function fixture(Builder, outputOrder, randomBytes = secureBytes) {
  let signed;
  let ordinal = 0;
  const viewer = {
    getOutgoingViewingKey: async () => Buffer.alloc(32),
    getAddress: async () => ({ address }),
  };
  const signer = { getSaplingViewingKeyProvider: async () => viewer };
  const wrapper = {
    randR: async () => Buffer.alloc(32, 1),
    withProvingContext: async (action) => action(7),
    getRandomBytes: randomBytes,
  };
  const builder = new Builder(
    { saplingSigner: signer },
    forger,
    {
      contractAddress: 'KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC',
      memoSize: 8,
      ...(outputOrder ? { outputOrder } : {}),
    },
    {},
    wrapper,
  );
  // Isolate expensive cryptography. The actual SDK constructs recipients/change, balances and signs their ordered list.
  builder.prepareSaplingSpendDescription = async () => [];
  builder.prepareSaplingOutputDescription = async (parameters) => {
    const data = {
      ordinal: ordinal++,
      address: Buffer.from(parameters.address).toString('hex'),
      amount: parameters.amount,
      memo: parameters.memo,
    };
    const id = createHash('sha256').update(JSON.stringify(data)).digest();
    return {
      commitment: id,
      proof: Buffer.alloc(192),
      ciphertext: {
        commitmentValue: Buffer.alloc(32),
        ephemeralPublicKey: Buffer.alloc(32),
        payloadEnc: Buffer.alloc(79),
        nonceEnc: Buffer.alloc(24),
        payloadOut: Buffer.alloc(80),
        nonceOut: Buffer.alloc(24),
      },
      fixture: data,
    };
  };
  builder.createBindingSignature = async (parameters) => {
    signed = parameters.outputs.map((output) => output.commitment.toString('hex'));
    return createHash('sha512')
      .update(
        JSON.stringify({
          signed,
          balance: parameters.balance.toFixed(),
          bound: parameters.boundData.toString('hex'),
        }),
      )
      .digest();
  };
  return { builder, signed: () => signed };
}
async function construct(Builder, outputOrder, amounts, change, iteration = 0, rng) {
  const setup = fixture(Builder, outputOrder, rng);
  const params = amounts.map((amount, index) => ({
    to: address,
    amount: String(amount),
    memo: `r${index}:${iteration % 100}`,
  }));
  const total = amounts.reduce((a, b) => a + b, 0);
  const tx = await setup.builder.createSaplingTx(params, new BigNumber(total), Buffer.alloc(0), {
    inputsToSpend: [],
    sumSelectedInputs: new BigNumber(total + change),
  });
  assert.deepEqual(
    setup.signed(),
    tx.outputs.map((output) => output.commitment.toString('hex')),
    'Outputs must be ordered before signature creation',
  );
  const encoded = forger
    .forgeSaplingTransaction({
      ...tx,
      root: 'fbc2f4300c01f0b7820d00e3347c8da4ee614674376cbc45359daa54f9b5493e',
      boundData: Buffer.alloc(0),
    })
    .toString('hex');
  return {
    tx,
    encoded,
    changeIndex: change > 0 ? tx.outputs.findIndex((output) => output.fixture.memo === '') : null,
  };
}
function wilson(successes, count) {
  const z = 1.959963984540054;
  const p = successes / count;
  const denominator = 1 + (z * z) / count;
  const center = (p + (z * z) / (2 * count)) / denominator;
  const radius =
    (z * Math.sqrt((p * (1 - p)) / count + (z * z) / (4 * count * count))) / denominator;
  return { correct: successes, count, accuracy: p, wilson95: [center - radius, center + radius] };
}
const permutations = new Set();
for (let first = 0; first < 3; first++)
  for (let second = 0; second < 2; second++) {
    const values = [first, second];
    const outputs = [0, 1, 2];
    shuffleOutputs(outputs, () => {
      const bytes = new Uint8Array(4);
      new DataView(bytes.buffer).setUint32(0, values.shift(), true);
      return bytes;
    });
    permutations.add(outputs.join(','));
  }
assert.equal(permutations.size, 6);
let calls = 0;
shuffleOutputs([0, 1, 2], () => {
  const value = calls++ === 0 ? 0xffffffff : 0;
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
});
assert.equal(calls, 3, 'Reject the biased tail for a bound of three');
for (const values of [[], [1]])
  shuffleOutputs(values, () => {
    throw new Error('No entropy needed');
  });
assert.throws(
  () =>
    shuffleOutputs([1, 2], () => {
      throw new Error('Entropy unavailable');
    }),
  /Entropy unavailable/,
);
assert.throws(() => shuffleOutputs([1, 2], () => new Uint8Array(1)), /four random bytes/);
let compatible = 0;
for (const [amounts, change] of [
  [[3000000], 7000000],
  [[2000000, 1000000], 7000000],
  [[10000000], 0],
  [[4000000, 6000000], 0],
  [[1, 1], 2],
]) {
  const before = await construct(baseline, undefined, amounts, change);
  const packaged = await construct(packagedBaseline, undefined, amounts, change);
  assert.equal(
    packaged.encoded,
    before.encoded,
    'Source baseline must match the original installed vendor builder',
  );
  for (const policy of [undefined, 'preserve']) {
    const after = await construct(candidate, policy, amounts, change, 0, () => {
      throw new Error('Default must not request entropy');
    });
    assert.equal(after.encoded, before.encoded);
    assert.deepEqual(after.tx, before.tx);
    compatible++;
  }
  const shuffled = await construct(candidate, 'randomized', amounts, change);
  assert.deepEqual(
    shuffled.tx.outputs.map((item) => item.fixture).sort((a, b) => a.ordinal - b.ordinal),
    before.tx.outputs.map((item) => item.fixture),
  );
  assert.equal(shuffled.tx.balance.toFixed(), before.tx.balance.toFixed());
}
await assert.rejects(
  construct(candidate, 'randomized', [3], 7, 0, () => {
    throw new Error('Entropy unavailable');
  }),
  /Entropy unavailable/,
);
const shieldBefore = fixture(baseline);
const shieldAfter = fixture(candidate, undefined, () => {
  throw new Error('Default must not request entropy');
});
const shields = [
  { to: address, amount: '3', memo: 'first' },
  { to: address, amount: '7', memo: 'second' },
];
assert.deepEqual(
  await shieldAfter.builder.createShieldedTx(shields, new BigNumber(10), Buffer.alloc(0)),
  await shieldBefore.builder.createShieldedTx(shields, new BigNumber(10), Buffer.alloc(0)),
);
await construct(candidate, 'randomized', [10], 0, 0, () => {
  throw new Error('One output needs no shuffle entropy');
});
assert.throws(() => fixture(candidate, 'invalid'), /Unknown output order/);
const count = 4096;
const corpus = [];
const measurements = [];
for (const recipients of [1, 2]) {
  for (const [name, Builder, mode] of [
    ['unchanged', baseline, undefined],
    ['candidate-default', candidate, undefined],
    ['candidate-randomized', candidate, 'randomized'],
  ]) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const amounts = Array.from({ length: recipients }, (_, index) => 10 + ((i + index) % 41));
      const result = await construct(Builder, mode, amounts, 100 + (i % 97), i);
      positions.push(result.changeIndex);
    }
    const outputs = recipients + 1;
    const train = positions.slice(0, count / 2);
    const heldOut = positions.slice(count / 2);
    const histogram = Array.from(
      { length: outputs },
      (_, index) => positions.filter((position) => position === index).length,
    );
    const trainHistogram = Array.from(
      { length: outputs },
      (_, index) => train.filter((position) => position === index).length,
    );
    const trainedPosition = trainHistogram.indexOf(Math.max(...trainHistogram));
    const row = {
      variant: name,
      recipients,
      outputs,
      chanceAccuracy: 1 / outputs,
      positionHistogram: histogram,
      frozenLast: wilson(positions.filter((position) => position === outputs - 1).length, count),
      trainedPosition,
      heldOutBestPosition: wilson(
        heldOut.filter((position) => position === trainedPosition).length,
        heldOut.length,
      ),
    };
    if (mode === undefined) assert.equal(row.frozenLast.accuracy, 1);
    else assert(histogram.every((value) => value > 0));
    measurements.push(row);
    corpus.push({ variant: name, recipients, positions });
  }
}
const directory = new URL('.cache/output-order/results/', root);
await mkdir(directory, { recursive: true });
const manifest = JSON.parse(
  await readFile(new URL('.cache/output-order/build-manifest.json', root), 'utf8'),
);
const report = {
  source: manifest,
  workload: {
    countPerVariantAndShape: count,
    train: count / 2,
    heldOut: count / 2,
    unit: 'independently shuffled transaction',
    crypto: 'mocked construction corpus; not valid cryptographic transactions',
    classifierInputs: ['output count', 'position only'],
    labels: 'private evaluator fixtures, excluded from classifier',
  },
  compatibility: {
    byteIdenticalDefaultCases: compatible,
    originalVendorMatchesSourceBaseline: true,
    invalidPolicyRejected: true,
    singleOutputConsumesNoShuffleEntropy: true,
    shieldDefaultIdentical: true,
    permutationCases: 6,
    rejectionTailChecked: true,
    failClosedOnMissingEntropy: true,
    signedOrderChecked: true,
  },
  measurements,
};
await writeFile(new URL('measurement.json', directory), JSON.stringify(report, null, 2));
await writeFile(new URL('positions.json', directory), JSON.stringify(corpus));
console.log(JSON.stringify({ compatibility: report.compatibility, measurements }, null, 2));
