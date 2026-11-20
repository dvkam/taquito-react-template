# SDK refresh, 20 November 2026

The lab uses one coherent source build from Taquito commit `d2915a1bfbf6bf9f2a761ad7c4349f7ea64f9a74`. See [the vendor guide](../vendor/README.md) for package and build provenance. This is a Linux x64 local proof of concept with published disposable keys.

## Bug-fix evidence

The refreshed Beacon interface permits an account without network metadata and returns an unsubscribe function from event subscription. The new regression failed before the guard: it received `Cannot read properties of undefined (reading 'type')` instead of the expected Shadownet error. After the guard, the check passes and sending remains blocked. The subscription type now follows the SDK return type.

See the [before-fix log](evidence/sdk-refresh-2026-11-20/wallet-missing-network-red.log) and [passing compatibility log](evidence/sdk-refresh-2026-11-20/compat-final.log). A deliberately failing baseline is evidence of the fix, not an outstanding test failure.

## Compatibility evidence

- A fresh archive of fork `master` at `44d26ba` passes all 45 original wallet/counter/transfer checks. The refreshed app passes those checks plus the new regression: 46. The full unit suite passes 99 tests.
- All 18 ordinary browser checks pass across Chromium, Firefox and WebKit. Each engine validates real worker proofs with Octez and completes the funded cycle: shield 10, transfer 3 and withdraw 2. Independent reads verify Alice 7, Bob 1, backing 8 and payout 2. Fees and storage costs remain separate.
- Five additional Chromium output-order scenarios pass: 17 accepted Octez applications and six rejected mutations with unchanged state. Coverage includes moved change spent later, multiple recipients, memos and an independent literal receiver-packing fixture.
- Ten deterministic construction comparisons preserve the same current SDK's default bytes when `outputOrder` is omitted or explicitly `preserve`. The installed vendor builder matches the isolated source builder. These checks do not claim byte equality between SDK releases.
- The session checker covers 781 histories of up to four actions and detects five deliberate faults. These bounded checks are not a formal proof.
- The dependency verifier checks the actual resolved package bytes across all 11 Taquito packages. Five isolated corruption controls detect changed source, compiled JavaScript, package metadata, source lock and revision. SDK inputs and served protocol artifact hashes remain unchanged after proof validation.
- Frozen installation, strict types, lint, formatting and the production build pass. The final ordinary build is byte-identical to the build used by the browser tests. The build still reports its existing large-chunk warning.

See the [execution summary](evidence/sdk-refresh-2026-11-20/execution-summary.json), [protocol summary](evidence/sdk-refresh-2026-11-20/protocol-summary.json), [construction controls](evidence/sdk-refresh-2026-11-20/construction-compatibility.json) and [ordinary browser log](evidence/sdk-refresh-2026-11-20/ordinary-browsers.log). Raw transactions and snapshots are in the adjacent `protocol/` and `browsers/` directories. Logs remove local home paths. The [hash list](evidence/sdk-refresh-2026-11-20/evidence-hashes.json) identifies every archived evidence file.

## Privacy evidence

The fresh corpus uses 4,096 constructions per mode and output count, with mocked cryptography. It compares omitted/default, explicit `preserve` and opt-in `randomized` order from the same current SDK.

| Outputs | Default: last-position accuracy | Preserve | Randomized | Chance |
| ------- | ------------------------------- | -------- | ---------- | ------ |
| 2       | 100%                            | 100%     | 49.17%     | 50%    |
| 3       | 100%                            | 100%     | 32.93%     | 33.33% |

See the [measurements and confidence intervals](evidence/sdk-refresh-2026-11-20/measurement.json) and [raw positions](evidence/sdk-refresh-2026-11-20/positions.json). The held-out position classifier and frozen last-position rule are both retained. Selected moved-output proof cases do not enter this unbiased corpus.

This measures one position signal. It does not establish anonymity against value, timing, fee-payer or network observers. Public fixture seeds provide no real confidentiality, and the observer selector provides no access control. October reports remain historical. No public-network injection, real-wallet approval or physical mobile-device validation was performed.

## Repeat the checks

Follow the [source snapshot guide](../vendor/README.md) and [experiment commands](../experiments/output-order/README.md). `pnpm build` checks installed SDK bytes, types, lint, formatting and unit tests. `pnpm verify:sdk-cache`, `pnpm test:compat` and `pnpm verify:pool-session` run the separate controls. After `pnpm sapling:setup`, `pnpm test:browser` runs the three-engine local suite. The output-order guide describes the additional current-build protocol run and verification.
