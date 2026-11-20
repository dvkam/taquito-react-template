# Local observer interface and output order completion plan

Intent: extend the verified funded Sapling cycle with public-observer, Alice, and Bob views. Complete a local Taquito proposal for issue 3472 with implementation, documentation, and package tests. Do not publish, push, comment, or change issue state.

## Fixed points and ownership

The playground starts at 7578fc8. Keep its original vendor SDK and ordinary wallet behavior. The output-order experiment and prior proof evidence remain separate. A dedicated Taquito worktree must start at a recorded current main revision, without switching the active checkout. Keep the proposed API opt-in and preserve the current default.

## Observer design

Keep proof creation and Octez application in the existing worker and local pool session. Retain initial and accepted snapshots in the cycle result. Derive an allowlisted public report from those snapshots. It contains contract, chain, roots, public backing, payout, fee payer costs, and output/nullifier counts. Derive transaction deltas only from public snapshots. Do not pass decrypted balances, memos, fixture ownership labels, or private transfer amounts to the public report.

Render one selected perspective at a time, initially Public observer. Alice and Bob views use balances and memos actually decrypted by the existing worker. Selecting a perspective changes the displayed explanation, not cryptographic authorization. This educational app contains published disposable keys and runs a known fixed scenario. State that limitation clearly. Do not describe the selector as access control or claim unknown real identities.

Show a public timeline without Alice/Bob labels or the private 3 XTZ amount. Account for public pool backing, recipient payout, and payer fees separately. Keep stable raw mutez evidence as well as readable XTZ values. Reset private UI state before a new cycle and on unmount. Reuse the existing receipt-preserving error handling.

## Verification

Privacy presentation gate: public report is an explicit allowlist; serialized reports and observer DOM must exclude decrypted fixture markers and memos. Private role switches must remove the other role's report. Test actual keyboard-operable controls and public/private distinction. Unknown fixtures are not a substitute for the real browser proof cycle.

Compatibility gate: preserve original wallet/counter sources and original tests. Run all ordinary units, checks and build. Retain the original funded protocol rejection tests and economic reconciliation. Test the role UI over the actual worker and Octez in Chromium, Firefox, and WebKit. Save results separately from fast mocked UI tests. Capture narrow-screen and reduced-motion evidence.

## Taquito issue 3472

Rebase the local experiment onto a recorded main snapshot in an isolated worktree. Shuffle whole output descriptions with secure random bytes and unbiased rejection sampling before signing, in private transfer and multi-output shield paths. Preserve omitted and explicit preserve behavior, reject unknown options, fail closed on entropy failure, and keep zero/single outputs as no-ops. Document public constructor examples, custom builder responsibility, history/index effects, and the bounded privacy claim.

Port focused behavior tests into Taquito's own test suite. Compare unchanged and candidate public behavior and byte fixtures separately from distribution measurements. Reuse the sealed construction corpus as historical privacy evidence and clearly record its source revision. Recheck current-source equivalence or rerun if relevant construction changes. Existing real Octez evidence is historical until source/artifact equivalence or a new real-proof run establishes applicability.

## Plan interrogation decisions

The selector is an explanation tool, not a security boundary. Public display data comes only from chain/public snapshots; private histories never enter that report. We do not add sessions, real wallets, arbitrary recipient controls, testnet deployment, or a relayer. A role selector must not imply anonymity for a known fixed script. No mutable SDK dependency replacement occurs in the ordinary app.

The local draft PR descriptions must separate privacy improvement from compatibility and must distinguish executed checks from remaining work. Use pstack unslop and technical-writing STE sentence guidance. The independent reviewers challenge correctness, knowledge separation, stale async work, default compatibility, signing order, randomness, fixture independence, and evidence attribution.

Apply Pocock codebase-design and parallel Spec/Standards review, plus pstack sharpen and interrogate. Resolve actionable findings, rerun relevant gates, and request a final review of the resulting diff. Record dismissed findings with evidence. A no-findings review is bounded to the reviewed code and scope, not a claim of a full cryptographic audit.

## Plan review corrections

Spec review identified two gaps. Public-safe presentation now includes introductory prose, progress, and errors in every lifecycle state. No public progress text names Bob or the private transfer amount. Private diagnostic messages must not appear as public error text, while confirmed operation receipts remain available.

Cancellation gates now explicitly cover delayed create, submit, and observe replies. Stop before final observation if no longer active, and suppress late observations. Unmount does not undo an accepted transaction. Preserve confirmed receipt semantics when a read fails after application.
