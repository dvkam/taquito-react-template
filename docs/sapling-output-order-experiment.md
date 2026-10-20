# Output-order privacy experiment

Completed locally on 21 October 2026. No issue, PR, comment or push was created. Source implementation before this report: `724fd4ab93fda3634dc92dbc40f82db363a06d6e`.

## Measured result

Optional randomization removed the deterministic last-position change signal in the tested construction workload. The unchanged builder and candidate default mode both put change last in all sampled positive-change transactions.

| Outputs | Unchanged last-position accuracy | Randomized accuracy | Randomized 95% Wilson interval | Chance |
| ------: | -------------------------------: | ------------------: | -----------------------------: | -----: |
|       2 |                             100% |              49.54% |               48.01% to 51.07% | 50.00% |
|       3 |                             100% |              33.57% |               32.14% to 35.03% | 33.33% |

Each row uses 4,096 transactions per variant. The evaluator knows there is one positive change output and knows the recipient count. The classifier receives output position/count only, with no ownership labels, keys, values, memos or service logs. These are actual SDK construction calls with proof/encryption work mocked. They are not thousands of independently valid cryptographic transactions.

For 2 outputs, the trained position rule achieved 50.78% on 2048 held-out transactions, with a 95% Wilson interval of 48.62% to 52.94%.

For 3 outputs, the trained position rule achieved 32.96% on 2048 held-out transactions, with a 95% Wilson interval of 30.96% to 35.03%.

The trained rule chooses its position on a separate 2,048-transaction training half. Transaction is the statistical unit, not each correlated output. `positions.json` preserves all six groups of 4,096 labels for recalculation. Randomness is fresh WebCrypto randomness; an exact rerun need not yield identical percentages.

This is evidence of a reduction in this specific output-role position signal. It does not establish deposit/withdraw linkage resistance, anonymity-set size, safety against timing/amount/network observers, or an advantage over Tornado. Published fixture seeds provide no secrecy.

## Separate compatibility evidence

- Ten fixed-dependency private-transaction comparisons retain identical constructed/forged bytes in omitted/default and explicit preserve modes. The compiled source baseline also matches the installed original vendor builder on those fixtures. Default multi-output shielding matches too.
- Opt-in preserves output multiplicity, address/value/memo associations, signed balance and bound data. Exact spend adds no change output. Duplicate-recipient fixtures retain their associations. One/zero-output shuffle cases consume no entropy. All six three-output permutations, the rejection-sampling tail and missing entropy are checked.
- Public consumer compilation accepts the old constructor calls and the optional randomized/preserve modes against emitted declarations. An unknown policy remains a type error and is rejected at runtime.
- Five Chromium production-browser scenarios passed, with 17 actual protocol applications across unchanged/default/randomized SDKs. Octez independently verified and applied them. An actually moved change note was spent successfully, exact-spend and multi-recipient transfers worked, and values/memos survived a genuinely swapped multi-recipient shield.
- Reordering output descriptions after signing and altering signed withdrawal recipient bytes were rejected with unchanged state in each applicable core scenario. The recipient PACK bytes are an independent literal Octez fixture.
- The compatibility test selects an actually moved transaction before applying it. Its preparation attempts are recorded, and are excluded from the unbiased classification corpus. The moved transfer took 1 preparation attempt(s). Only accepted selected proofs count as protocol evidence.
- All 82 ordinary app unit tests and four original Chromium proof-lab browser checks passed. Original wallet/counter code, the original proof/funded workers, dependency lock and vendor SDK tarball are unchanged from baseline. A separate earlier pool-status class collision was corrected without weakening the original browser assertions.

Default behavior preserves positions. Opt-in changes output indices and public transaction-history array order by design. Do not describe randomized mode as positional or full-byte compatibility.

## Additional SDK sweep and limitations

The isolated unchanged upstream SDK suite and candidate default suite each produced 108 passes and the same three failures out of 111 tests. Two failures concern malformed UTF-16 memo cases; one concerns invalid-key error handling. No additional failing test appeared in candidate default. This local suite/dependency setup is not all green. It does not establish that these failures occur in official upstream CI or that they were introduced by this experiment. Align and triage that environment before proposing a merge-ready upstream PR.

Prototype protocol testing here covers Node construction and Chromium browser proofs. It does not requalify randomized mode on every supported browser, network or protocol. The Octez runtime is pinned 25.3/Tallinn. Contract timing, input/output counts, payout recipient and public amounts remain visible.

## Local implementation and provenance

The small source patch adds `outputOrder: 'preserve' | 'randomized'`, defaults to preserve, and shuffles complete shield/private output descriptions before binding-signature creation. It uses the existing SDK secure random-byte provider, unbiased Fisher-Yates sampling and no Math.random fallback. The source patch applies cleanly to the unmodified snapshot.

Baseline source is `8ecb7ad0db4af8dbfa1282385351dde28107e973`. Research confirmed builder/types/randomness-wrapper files are unchanged on main `655a5a42ed4ca61fa7022a55e8b6361bce7d8a05`. Both snapshots compile with the same installed dependency graph. Build metadata includes Node 24.21.0, TypeScript 6.0.3, Rollup 4.64.7, lock/dependency fingerprints and hashes for the actual consumed CJS, browser bundles, helper and emitted declarations. Browser SDK hashes remained identical through the final provenance rebuild.

The app uses its original vendor SDK. Experimental imports/build inputs and browser tests are explicit and separate. Vitest excludes cached SDK sources by using the app's source-test include. The ordinary playground build has been restored.

Matt Pocock research/module-design and separate spec/standards reviews, plus pstack foundational-thinking/sharpen guidance, informed the work. Review findings about test discovery, multi-output shielding and audit provenance were corrected and rechecked.

## Contribution suitability

Yes. The evidence supports a bounded feature proposal to remove the deterministic change-position fingerprint with an opt-in policy. Research found no matching existing issue/PR. Zcash's Sapling builder provides a relevant precedent for shuffling and index tracking. The source and search evidence is in `contribution-assessment.md`.

The future issue should explain the conditioned observer model, unchanged current behavior, measured position result and ordering compatibility. The future PR should keep default behavior stable unless maintainers choose otherwise, document history/index changes, port focused tests into Taquito's own suite, align the three baseline failures, and run its official package/integration checks. The option's API placement is a maintainer decision. Taquito requests an issue before a PR when no matching issue exists.

No upstream item was created. This is a locally tested prototype and contribution assessment, not a claim that a PR is ready to merge.
