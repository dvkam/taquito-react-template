# Add a local Sapling proof and private-payment lab

Add real browser-worker Sapling proofs with independent Octez validation and a funded local contract. Shield 10 test XTZ, privately send 3 to Bob and withdraw 2. Independent reads verify Alice 7, Bob 1, backing 8 and payout 2, with fees separate.

Public observer, Alice and Bob views explain chain-visible and viewing-key information. Refresh the SDK to one source build at `d2915a1b`, including the merged Sapling fixes and output-order API. Verify the installed bytes across all 11 required Taquito packages.

## Bug-fix evidence

A new Beacon regression fails before the adapter fix when account network metadata is absent. It passes after the guard and rejects the account before sending.

## Compatibility evidence

- Fresh fork-master baseline: 45 wallet/counter/transfer tests. Refreshed app: those 45 plus the new regression; 99 unit tests overall.
- 18 browser checks pass across Chromium, Firefox and WebKit, including real proofs, the funded cycle and atomic rejection controls.
- Five separate Chromium output-order scenarios: 17 accepted Octez applications and six rejected mutations with unchanged state. Includes independent receiver-packing bytes and later spending of moved change.
- Ten same-SDK default/preserve byte comparisons pass. The session checker covers 781 histories and detects five faults; cache validation detects five corruptions. Frozen install, types, lint, formatting and build pass.

## Privacy evidence

A separate mocked corpus uses 4,096 samples per mode and output count. The last-position rule identifies change in 100% of default/preserve samples; randomized order yields 49.17% for two outputs and 32.93% for three, near chance. Selected proof cases are excluded. This measures one position signal, not full anonymity.

See [the dated report and raw evidence](https://github.com/dvkam/taquito-react-template/blob/feat/sapling-worker-proof/docs/sdk-refresh-2026-11-20.md). This is a Linux x64 local PoC with published disposable keys. Public-network operations and real-wallet approvals remain unverified. The build retains its large-chunk warning.
