# Sapling perspective implementation and evidence

Completed locally on 26 October 2026. Baseline 7578fc8. Implementation 75211c0. No push, issue update, PR creation, comment, or deployment occurred.

## Result

The funded local cycle now starts in Public observer. Its report shows public backing, payout, payer fees/storage, output/nullifier counts, public roots/addresses, and an operation timeline. It derives only allowlisted public fields from the initial and accepted snapshots.

Alice and Bob have separate reports with balances and incoming memos actually decrypted by the worker. Only the selected report renders. Switching to Public observer removes the private report. A new run clears the old report and starts public. Delayed create, submit, and observe replies cannot restore stale results after closure.

The fixed cycle ends with Alice 7 test XTZ, Bob 1, public backing 8, and public payout 2. Fees remain separate. This is a local persistent Octez mockup, not a public deployment. The selector is an explanation tool with published disposable keys, not access control or a privacy boundary.

## Privacy presentation evidence

The projection test injects private fixture markers and checks an explicit public field list. DOM tests verify private memos/balances are absent from public reports, only the selected role appears, and restarting clears private data. Generic failures do not display private diagnostic strings. Confirmed public operation receipts remain visible after refresh/lineage failures.

Real Chromium, Firefox, and WebKit UI runs complete actual worker proofs and Octez applications, then check public-first presentation, keyboard selection, removal of the other role, return to public, public-safe progress, and a 360-pixel reduced-motion layout. Screenshots and perspective artifacts are saved per browser.

This is evidence about truthful presentation. It does not establish anonymity against an observer with the published keys or remove other public signals. The ordinary playground SDK remains unchanged. It does not silently enable issue 3472's order policy.

## Separate compatibility evidence

All 94 app unit tests pass, including the 45 original wallet/counter tests. Twelve compatibility source/dependency files match baseline byte-for-byte. Proof and pool worker asset names remain proof.worker-B__Wfm_b.js and pool.worker-CA8qwh_l.js. Type checks, lint, formatting, and production build pass. The existing large-bundle warning remains.

The original funded protocol test is retained. In each of three browsers, it independently applies three valid transitions and rejects eight invalid submissions without changing state. These include invalid deposit amounts, corrupted proof, altered recipient, unexpected amounts, and duplicate spends. The separate stale-version guard also rejects a call. The final perspective UI adds three accepted transitions per browser. The selected final evidence therefore contains 18 accepted protocol applications and 24 protocol rejections across both test groups.

All four original Chromium proof-lab browser checks pass. The unchanged session module passes 781 bounded histories and detects five deliberate mutations. This is executable bounded checking, not an unbounded proof of the contract or cryptography.

## Browser review and correction

The first six-case run passed all three protocol cases but failed the perspective layout check in all three engines. Long operation hashes caused horizontal overflow. The CSS now wraps those identifiers and stacks amount rows at narrow widths. The corrected three-case perspective run passes all three browsers. Its worker code is unchanged. The original proof-lab compatibility run passes separately.

The old simultaneous-private-balances UI assertion changed deliberately. The new interface shows one perspective at a time. We retained the independent protocol/economic assertions instead of treating presentation changes as protocol compatibility.

## Reviews and local contribution status

Pocock Spec and Standards reviews and pstack interrogation ran independently with available Codex models. Plan findings about public-safe lifecycle text, delayed replies, null policy rejection, and portable public consumer checks were corrected. Final reviewed scope has no actionable findings. Read-only review conclusions remain separate from executed checks. The browser layout finding was corrected and revalidated.

The Taquito proposal is a separate local branch, feat/3472-sapling-output-order, at f5200649 from main bbe1ba24. It contains implementation, documentation, byte fixtures, 142 passing native tests, source and emitted-declaration consumer checks, lint, and standard builds using a locked isolated offline install. Its historical privacy corpus and Octez evidence stay explicitly historical. No new current-source Octez run or packed-consumer qualification is claimed for that SDK branch.

## Reproduce

From the React template with Node 24 and existing dependencies:

```sh
PAGES_BASE_PATH=/proof-lab/ pnpm build
PORT=4187 PAGES_BASE_PATH=/proof-lab/ pnpm exec playwright test browser-tests/pool.pw.ts
PORT=4188 PAGES_BASE_PATH=/proof-lab/ pnpm exec playwright test browser-tests/sapling.pw.ts --project chromium
pnpm verify:pool-session
```

Use tools/serve-sapling.mjs for the local preview. See docs/sapling-perspectives.md for usage, docs/drafts/sapling-perspectives-pr.md for the local PR description, and outputs/3472-local/draft-pr-description.md in the task workspace for the separate SDK draft.
