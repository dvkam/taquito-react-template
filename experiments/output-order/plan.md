# Output-order experiment plan

Approved 21 October 2026. Local implementation and investigation only. No upstream issue, PR, comment or push. Application baseline 0d84ef8. SDK source baseline 8ecb7ad0db4af8dbfa1282385351dde28107e973. Research confirms builder/types/randomness wrapper unchanged on upstream main 655a5a42ed4ca61fa7022a55e8b6361bce7d8a05.

## Question and observer

Does optional random output order remove the deterministic last-position change signal? The observer knows there is positive change, the number of recipient outputs and public output positions. It receives no keys, memos, amounts, ownership labels, entropy or application logs. The evaluator holds those labels separately. This tests output-role classification, not sender deanonymization or global anonymity.

## Design

Compile unmodified and candidate SDK snapshots in an ignored cache. Do not change the active Taquito checkout or the playground dependency. Keep a source patch, source and artifact hashes, build commands and runtime versions. Candidate adds outputOrder: preserve|randomized to SaplingContractDetails, default preserve. Opt-in shuffles shield outputs and private recipient/change outputs before binding-signature creation. Use existing secure wrapper randomness with unbiased Fisher-Yates rejection sampling. Default mode must make no extra entropy requests.

## Measurement

Run the actual compiled builder with cryptographic work replaced by labeled output fixtures, using 4096 independent transactions for each positive-change shape: one recipient plus change, and two recipients plus change. Reuse the same varied inputs for unmodified/default/randomized builders. Use real OS-backed randomness for shuffling. Freeze the last-position classifier in advance, and train a strongest-position classifier on one half and evaluate on the held-out half. Report per-transaction accuracies, Wilson intervals, position histograms and chance baselines. Do not count correlated outputs as independent samples. This corpus contains layout constructions, not thousands of valid proofs.

## Separate compatibility evidence

Unmodified and candidate default must have identical constructed outputs, signature inputs and forged bytes under fixed deterministic dependencies. Opt-in must preserve output identity/value/memo multisets, input behavior, total balance and bound recipient data. Check 0/1 output, exact spend, multiple recipients, duplicate recipients, rejection-sampling tails and unavailable entropy. Prove randomization occurs before signing; permutation after signing must fail Octez validation.

Run real browser-worker proofs for unmodified/default/randomized artifacts against independently observed local Octez state and balances. Cover recipient memo recovery, spending shuffled change, exact-spend with no fabricated change, multiple recipients and withdrawal recipient binding. Keep the ordinary funded worker, vendor tarball, wallet/counter and original proof tests unchanged. Public API assertions and independent byte fixtures remain separate from the role-classification metric.

## Review and contribution decision

Use Matt Pocock module-design/research and pstack foundational-thinking/sharpen guidance for this plan. Review the implementation on spec and standards separately. A plausible upstream contribution needs reproduced current behavior, an opt-in compatibility policy, source-level tests and explicit limitations. Positional history ordering changes in opt-in mode by design. No overall Tornado comparison follows from this experiment.
