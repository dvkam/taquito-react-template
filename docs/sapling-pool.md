# Funded local Sapling cycle

Run `pnpm sapling:setup`, then `PAGES_BASE_PATH=/proof-lab/ pnpm build` and `PAGES_BASE_PATH=/proof-lab/ pnpm sapling:serve`. Open the local lab and choose **Run local payment cycle**. Every run creates a fresh isolated mockup in `.cache/sapling/pool-*`. Its disk context persists for inspection. Restarting the server clears its in-memory session handles. It does not remove disk contexts.

The pool contract in `tools/privacy-pool.tz` follows Taquito's `integration-tests/data/single_sapling_state_contract_jakarta_michelson.ts` at commit 8ecb7ad0db4af8dbfa1282385351dde28107e973. It accepts a list of transactions, verifies signed bound data and consumes nullifiers. Its amount accumulator enforces the one-to-one mutez conversion. Unshielding pays the implicit account unpacked from signed bound data. Existing deprecated DIIP macros are retained to preserve this source verbatim.

The browser worker derives public disposable Alice/Bob identities, constructs real proofs and reads one RPC-derived snapshot through a read provider. No shielded balance is hardcoded into the viewer. Octez applies the calls to actual local storage and balances. The expected final values are Alice 7,000,000 mutez, Bob 1,000,000, contract backing 8,000,000 and recipient payout 2,000,000. The initial deposit is 10,000,000 and the private transfer is 3,000,000.

The payer ledger records actual balance deltas. Its `feesAndStorageMutez` combines transaction fees and paid storage burns, separate from the 10,000,000 deposit. Confirmed receipts remain visible if a later state refresh fails. The session then stops accepting submissions. Initial origination costs are excluded because the baseline is read after origination. No participant balance silently absorbs these costs.

All pool reads and writes are serialized. Versions reject old application requests. A call with an uncertain infrastructure outcome quarantines its session. Inspect the preserved mockup and create a fresh session rather than retrying that transaction. This local runner does not implement reorg handling, a network relayer or arbitrary external concurrent writers.

## Separate verification evidence

`PORT=4181 PAGES_BASE_PATH=/proof-lab/ pnpm test:pool` tests production browser artifacts, literal byte fields, exact public balances, viewing-key balances, memo recovery, stale requests and duplicate spends. Build with the same URL prefix first. The negative cases include underfunded/overfunded shields, attached value on private transfers/withdrawals, modified proofs and changed signed recipient bytes. The local client rejects these during protocol preapplication. It checks unchanged stored state, payer and recipient balances. This is not a test of fees for deliberately injected failed operations.

`pnpm test:compat` separately runs the original wallet/counter tests. The original proof-only experiment also remains available and has its own browser tests.

`pnpm verify:pool-session` exhaustively runs 781 histories of up to four actions against the production JavaScript session module. It checks overlapping reads/writes, stale versions, quarantine after uncertain outcomes and version preservation on rejection. Five broken source variants must fail. This is bounded executable checking, not a proof over all executions or a verification of Sapling cryptography or the Michelson contract. No suitable installed source verifier was available. See the project-local verification skill for scope and maintenance.

The minimal result display is not the later public-observer/Alice/Bob interface. See `sapling-privacy.md` for the privacy experiment and limitations.

The deliberately broken variants expose these sequences: an outstanding submit lets another reader enter; a stale version reaches application; an uncertain outcome allows another application; a rejection moves the version; or a confirmed application loses its receipt when refresh fails. The checker must detect each sequence.
