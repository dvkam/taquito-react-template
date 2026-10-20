# Worker experiment verification record

Validated locally on Ubuntu 24.04 under WSL with Node 24.21.0 and pnpm 12.14.0. No branch was pushed and no issue, PR, deployment, wallet permission, or chain transaction was created for this experiment.

## New behavior and real proof evidence

The production Vite build emits a real module worker and a separate WASM asset. The worker calls the public Sapling preparation interface with real WASM and authenticated proving parameters. Only its chain-read adapter uses a fixed empty pool fixture. No proof, signature, or verifier result is mocked in browser acceptance tests.

Playwright 1.64.1, matching current Taquito tooling, passed all 12 checks in Chromium, Firefox and WebKit. Each engine covered parameter-free panel startup, real shielding preparation, cold and warm worker operation, independent Octez acceptance, proof/signature corruption, download failure/retry, stop/restart, and narrow-screen reduced-motion interaction. The test opens a disclosure after the UI reports proving, asserts its expansion within one second, and confirms proving is still in progress.

The Chromium-generated transaction also fails verification under a different valid contract address. This is a cryptographic binding check. A wrong chain argument is rejected as configuration and is not counted as a cryptographic chain-replay test.

An additional four Chromium checks passed with the production build and local server under `/proof-lab/`. This checks deployment-prefix resolution for the page, lazy UI, worker, WASM, parameter URLs and verifier URL.

Octez 25.3, commit e5d8a6b8, independently executes `SAPLING_VERIFY_UPDATE` in a Tallinn mockup. The helper checks the binary SHA-256, actual mockup chain and actual protocol on every invocation. The original transaction is accepted with balance `-1` and empty bound data. Proof and binding-signature mutations must fail with the explicit protocol-verification failure, not merely a decoding error.

The fixture uses chain `NetXynUjJNZm7wi`, self-contract `KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC`, memo size eight and one mutez. Literal byte checks require a 615-byte transaction, prefix `00000000000001f3`, signed balance bytes `ffffffffffffffff`, the canonical empty root `fbc2f4300c01f0b7820d00e3347c8da4ee614674376cbc45359daa54f9b5493e`, and empty bound-data length `00000000`. These expected values are not calculated by the SDK encoder. Randomized proof bytes are verified semantically, not compared for equality.

## Separate compatibility evidence

Template baseline `020aecc` passed its full build and all 45 tests before implementation. The same three original test files remain byte-for-byte unchanged and pass the same 45 tests after the dependency and UI changes. They cover the public wallet, transfer, and counter behavior. The evidence export records their baseline and current SHA-256 hashes.

The full fixed unit suite passes 79 tests, comprising the original 45, 24 worker-client tests, and 10 lab UI tests. These lifecycle tests use controlled worker/client adapters; they do not establish cryptographic correctness. The production browser checks establish the real worker/crypto path separately. Removing stale-message isolation makes the public warm-worker test fail; exact source bytes were restored afterward.

Strict type-aware Oxlint, Oxfmt, app/Node/browser-test TypeScript checks, all unit tests and the final production build pass. The existing large wallet-bundle warning remains. It is not hidden by changing the warning threshold.

## Runtime observations and review

One recorded Chromium prefix run measured 1.11 seconds for cold parameter load/checks and 4.76 seconds for account derivation plus proof preparation. Warm worker load/checks rounded to 0.00 seconds and preparation took 4.23 seconds. These are local measurements with local parameter delivery, not public-network, mobile, or general performance guarantees. The exact returned transaction and displayed measurements are saved in the exported proof-evidence JSON.

The initial Playwright 1.58.2 Firefox run accepted its cold proof but timed out while waiting for warm preparation. Aligning with current Taquito Playwright 1.64.1 and its browser revisions produced the successful full matrix. This experiment does not claim compatibility with the earlier browser revision or classify its timeout as an SDK defect.

Matt Pocock codebase-design/TDD/code-review and pstack sharpen, boundary discipline, and unslop informed planning and review. Standards and spec reviews ran separately. Review fixes include the canonical root, explicit mutez units, distinct proof/signature/context controls, verifier concurrency, actual protocol attribution, prefix handling, and stage-gated responsiveness. Both final review axes report no unresolved findings.

Emil's UI guidance informed immediate state feedback, visible keyboard focus, touch-sized controls, reduced-motion behavior, readable byte counts, and restrained styling.

| Before                    | After                                        | Why                                                        |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| No Sapling entry          | Lazy lab independent of wallet connection    | Keeps the experiment available without permission requests |
| No proof state            | Distinct preparation and Octez acceptance    | Shows exactly which check completed                        |
| No worker lifecycle       | Stop, retry and stale-result isolation       | Prevents old work from replacing a later result            |
| No browser proof evidence | Real worker plus protocol rejection controls | Detects failures a preload-only check cannot find          |

## Limits

The fixture proves one-output shielding into an empty pool. It does not establish spend-proof correctness, private transfers, unshielding, double-spend handling, reorganization recovery, wallet interoperability, mobile performance, or production privacy. The published test mnemonic is intentionally public. The local verifier server is not a deployment target. Browser request cancellation does not prove a running Octez subprocess was cancelled.
