# Add a local Sapling proof and private-payment lab

Add a browser-worker lab that creates real Sapling proofs and checks them with pinned Octez 25.3. A stateful local contract enforces deposits and payouts. The payment cycle shields 10 test XTZ, privately transfers 3 to Bob, and lets Bob withdraw 2. Independent reads verify Alice holds 7, Bob holds 1, the contract backs 8, and the public recipient receives 2. Payer fees and storage costs remain separate.

The result starts with Public observer. Its allowlisted report shows chain-visible backing, payout, costs, counts and receipts. Alice and Bob have separate reports with balances and memos decrypted by their viewing keys. Restart clears private reports, and closed workers cannot restore stale results. A final observation failure retains the confirmed public receipt without exposing private diagnostics.

## Privacy presentation evidence

Projection and UI tests check that private markers do not enter the public report, that only the selected private perspective appears, and that restart removes it. Real browser cases verify the same behavior after Octez applies the payments.

The keys are published disposable fixtures. The selector explains viewing keys; it provides no access control or anonymity. A separate opt-in experiment measures SDK output ordering. The ordinary lab does not enable that proposed policy.

## Compatibility evidence

All 98 unit tests pass, including the 45 original wallet/counter checks. Seven existing wallet/counter source and test files match base `44d26ba` byte-for-byte. The branch adds the Sapling vendor package, workers, local contract and dependency entries. The vendor package includes the merged Sapling memo and parameter-body fixes.

All 18 browser cases pass across Chromium, Firefox and WebKit. They check real proofs, the funded cycle, invalid deposits, altered proof/recipient data, duplicate spends, unchanged rejected state, perspective selection and narrow/reduced-motion layouts. Four receipt-loss regressions fail before the fix and pass afterward. The session check covers 781 bounded histories and detects five deliberate faults.

The separate SDK experiment has fresh privacy measurements and 17 accepted Octez applications plus six unchanged-state mutation rejections. Those results are recorded separately from the ordinary lab's evidence.

Build, lint, formatting and strict type checks pass. The existing large-bundle warning remains. The evidence report includes reproduction commands and limitations.

This is a local Linux x64 proof of concept. Public-network operations and real-wallet approvals are unverified. It does not deploy a service or provide production key custody.
