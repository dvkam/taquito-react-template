import {
  SaplingToolkit as Baseline,
  InMemorySpendingKey as BaselineKey,
} from '../../.cache/output-order/baseline/packages/taquito-sapling/dist/types/taquito-sapling';
import {
  SaplingToolkit as Candidate,
  InMemorySpendingKey as CandidateKey,
} from '../../.cache/output-order/candidate/packages/taquito-sapling/dist/types/taquito-sapling';
declare const baselineKey: BaselineKey;
declare const candidateKey: CandidateKey;
declare const baselineProvider: ConstructorParameters<typeof Baseline>[2];
declare const candidateProvider: ConstructorParameters<typeof Candidate>[2];
new Baseline(
  { saplingSigner: baselineKey },
  { contractAddress: 'local', memoSize: 8 },
  baselineProvider,
);
new Candidate(
  { saplingSigner: candidateKey },
  { contractAddress: 'local', memoSize: 8 },
  candidateProvider,
);
new Candidate(
  { saplingSigner: candidateKey },
  { contractAddress: 'local', memoSize: 8, outputOrder: 'randomized' },
  candidateProvider,
);
new Candidate(
  { saplingSigner: candidateKey },
  { contractAddress: 'local', memoSize: 8, outputOrder: 'preserve' },
  candidateProvider,
);
// @ts-expect-error Unknown policies must remain a type error.
export const invalidPolicy: ConstructorParameters<typeof Candidate>[1]['outputOrder'] = 'reverse';
