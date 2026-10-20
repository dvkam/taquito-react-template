# Funded Sapling cycle evidence

Completed locally on 21 October 2026. No public deployment, GitHub post or push.

Source revision before this evidence-only commit: `c32b7e98d7ef1112db5199e72c505a74e774354c`. The pool session implementation and bounded verification correspond to `ed9948b1a1848d7f89680ad034ed9cafa0fe2ab6`. Baseline was `322e0d3523604f82276d07d7fb350fdd9ec7de48`.

## Observed result

Real browser-worker proofs shielded 10,000,000 mutez, transferred 3,000,000 privately from Alice to Bob and withdrew 2,000,000. Octez 25.3 independently verified and applied each call in an isolated persistent Tallinn mockup. Values below are integer mutez, observed through the SDK viewer and actual Octez balances.

| Browser  |   Alice |     Bob | Contract backing | Recipient payout | Separate payer fees and storage |
| -------- | ------: | ------: | ---------------: | ---------------: | ------------------------------: |
| chromium | 7000000 | 1000000 |          8000000 |          2000000 |                          584129 |
| firefox  | 7000000 | 1000000 |          8000000 |          2000000 |                          584129 |
| webkit   | 7000000 | 1000000 |          8000000 |          2000000 |                          584129 |

Each browser accepted three transitions and rejected eight invalid submissions. These include underfunded and overfunded deposits, a changed proof, unexpected attached amounts, an altered signed withdrawal recipient and duplicate spends. Stored Sapling state and contract/payer/recipient balances stayed unchanged after each rejection. Stale application versions also failed. Invalid calls were rejected during protocol preapplication; this does not cover fees for deliberately injected failed operations.

The payer costs above exclude the 10,000,000 deposit and initial contract origination. They include transaction fees and storage burns, rather than a public-network fee estimate.

The unrelated viewing key decrypted zero incoming notes. Alice and Bob recovered their expected balances and Bob recovered the Unicode memo. Viewing-only inspection fetched no proving parameters. Literal signed-balance bytes and an independently obtained Octez recipient fixture checked serialization.

## Separate compatibility evidence

- All 82 unit tests passed, including the original 79 and three new lifecycle/receipt tests.
- The 45 original wallet/counter tests passed before implementation and again within the final suite. Eight original public implementation/test files are byte-identical to baseline, recorded in `compatibility-baseline.json`.
- All six new production-browser tests passed across Chromium, Firefox and WebKit. Each engine ran both the negative protocol matrix and the user-facing payment control.
- Four original Chromium proof-lab browser tests passed separately, including real proof acceptance, mutation/context rejection, recovery and narrow-screen behavior.
- Type checks, lint, formatting and production builds passed. The existing large-bundle warning remains.
- The control rendered at 360 pixels with reduced motion and no horizontal overflow. Its screenshot is `local-cycle-control.png`.

## Review and bounded verification

Matt Pocock's separate spec and standards reviews found three gaps: unrelated-note-count evidence, receipt retention after a confirmed write followed by a failed read, and pending worker disposal. All were corrected and the reviewers confirmed resolution.

Pstack's experimental verification workflow produced a project-local skill and a rerunnable check. `pnpm verify:pool-session` checks 781 histories of up to four actions against the real JavaScript session code. Five deliberately broken variants are detected. This is bounded executable checking, not a formal proof of all interleavings, the Michelson contract or cryptography.

## Privacy result and remaining work

Outer operations use an independent public payer. The local withdrawal recipient need not supply its own fee-paying account. Public demonstration seeds provide no secrecy, and this is not a deployed relayer.

No comparative anonymity advantage over Tornado is established. The next proposed experiment targets Taquito's deterministic last-position change output, with matched-workload classification and independent ownership labels. Shared-payer and timing policies need measured baselines too. See `sapling-privacy.md`.

The later public-observer/Alice/Bob interface, production session recovery, public deployment and upstream packaging contributions remain outside this completed milestone.

## Run locally

Open `http://localhost:4180/proof-lab/`, choose **Open Sapling lab**, then **Run local payment cycle**. The preview is left running. Each run creates a fresh isolated local pool.

From the React template, `pnpm sapling:setup` prepares the pinned runtime. Build with `PAGES_BASE_PATH=/proof-lab/ pnpm build`, then serve with `PAGES_BASE_PATH=/proof-lab/ pnpm sapling:serve`. For browser tests, use a free port such as `PORT=4181 PAGES_BASE_PATH=/proof-lab/ pnpm test:pool`. `pnpm verify:pool-session` reruns the bounded guard check.
