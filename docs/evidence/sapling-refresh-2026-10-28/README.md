# Sapling refresh evidence, 28 October 2026

SDK baseline `e9a573bbb2699a64bfdc5bb1416c90015557b178`. Candidate `179d34c3f90b0bc33df9b98b0d8b72c8e8a2d891`. Template base `44d26ba`; runtime and measurement changes are committed through `c97a66e`. Later commits update documentation and retain evidence.

The SDK rebase retains the previous contribution's Sapling file contents exactly. Upstream dependency packages changed. The template rebase includes the previously merged wallet cancellation changes. Both rebases completed without conflicts.

## Privacy improvement evidence

The fresh construction corpus contains 4,096 samples for each variant and each output count. It compares unchanged main, omitted-policy candidate, and randomized candidate. Each sample has exactly one positive change output. The evaluator knows the label. Classifiers receive only position and output count. Proof and encryption work are mocked; these are not valid cryptographic transactions.

| Outputs | Unchanged and default last-position accuracy | Randomized last-position accuracy | Chance | Randomized Wilson 95% interval |
| ------- | -------------------------------------------- | --------------------------------- | ------ | ------------------------------ |
| 2       | 100%                                         | 50.98%                            | 50%    | 49.45% to 52.51%               |
| 3       | 100%                                         | 33.35%                            | 33.33% | 31.92% to 34.81%               |

A second classifier chooses the most frequent position in 2,048 training samples and evaluates a separate 2,048-sample holdout. Randomized accuracy is 50.98% and 32.71%, respectively. The intervals include chance. These results concern the tested position signal. They do not establish overall anonymity, defeat amount/timing/network analysis, or demonstrate an advantage over another privacy protocol. No padding or extra-output API was added.

Privacy measurements and raw positions are under `privacy/`. Input source, built artifact and dependency-lock hashes were checked before and after measurement. The earlier corpus remains historical and has not been replaced.

## Compatibility evidence

- All 111 unchanged-main Sapling tests pass using an archived complete main tree and the same installed dependencies. The candidate's full root run passes 4,004 tests across 18 packages, including 142 Sapling tests. Source and emitted-declaration public constructor checks pass. Root build and lint pass. Lint has ten warnings and no errors. TypeDoc builds with nine warnings and no errors.
- Independent fixed byte fixtures cover omitted and explicit preserve behavior. The construction check separately verifies ten byte-identical default/preserve cases, unchanged default shielding, secure shuffle edge cases and signed order. These controlled fixtures do not replace real proof validation.
- Five fresh Chromium worker/Octez scenarios pass. They contain 17 accepted protocol applications and six rejected signed mutations with equal before/after snapshots. The cases cover reversed multi-recipient shielding, moved change and its later spend, exact spends, multiple recipients, withdrawals, values and Unicode memos. An independent wire parser checks literal packed-recipient bytes.
- The protocol run pins Octez 25.3, its executable hash and Tallinn protocol. SDK and served-asset fingerprints and both dependency locks are verified after execution. Compatibility cases deliberately select moved outputs with bounded retries. They are not privacy samples.
- All 98 playground unit tests pass, including the 45 original wallet/counter tests. The final ordinary browser matrix passes all 18 cases across Chromium, Firefox and WebKit. It includes funded protocol rejection tests, public/Alice/Bob perspective selection, real shield proof checks and narrow/reduced-motion layouts. Seven existing wallet/counter source and test files match template base `44d26ba` byte-for-byte. The full branch adds vendor, worker, contract and dependency files; it does not claim those were unchanged.
- The real session module passes 781 bounded histories and all five deliberate fault variants are detected. This is bounded executable checking, not a proof of cryptography or unrestricted concurrency.

Protocol summaries and raw cycle/shield evidence are under `compatibility/`. Local full manifests, served bundle archive, logs and browser screenshots are retained in the task workspace. Public metadata omits machine-specific absolute paths.

## Review and corrections

Pocock Standards found a stale no-issue statement and possible stale sources in a reused archive directory. The README now links issue #3472. Each baseline build uses a fresh directory. Pocock Spec found that the observer-only draft overstated full-branch preservation. The replacement draft describes the complete contribution.

pstack interrogation used independent GPT-6 Astra and GPT-6.1 Sol reviewers because its default Claude and Grok models were unavailable. One reviewer found that a final observation failure discarded the confirmed payment receipt. Four regressions fail before the fix, with eight existing tests still passing. They pass after the fix; the focused client/UI group passes all 16 tests. Both reviewers then returned no further findings. Model reviews are separate from executed checks.

The first isolated protocol attempt failed all five cases before proof creation because asset discovery still used ordinary `dist`. Tests now use the same selected build directory as the server and verifier. The corrected run passes all five cases. A pre-fix ordinary browser run was stopped and superseded by the complete final matrix. The initial partial baseline test archive lacked root Vitest files; the successful baseline run uses a complete archived main tree. These setup failures are retained locally and are not SDK regressions.

## Scope and reproduction

Use the commands in `experiments/output-order/README.md` for fresh SDK measurement and protocol validation. Run `PAGES_BASE_PATH=/proof-lab/ pnpm build`, `PORT=4192 PAGES_BASE_PATH=/proof-lab/ pnpm exec playwright test`, and `pnpm verify:pool-session` for the ordinary playground. Setup requires Linux x64, Node 24, locked dependencies and the pinned verifier artifacts from `pnpm sapling:setup`.

The ordinary playground retains its identified vendor SDK, which includes the merged Sapling memo and parameter-body fixes. Output-order policy #3472 is an explicit experiment build input. It is not silently enabled in the ordinary UI. No public-network deployment, real-wallet approval, funded public-network operation or packed npm Sapling consumer qualification was performed. Feature-branch pushes do not deploy the Pages site. No PR is created by this work.
