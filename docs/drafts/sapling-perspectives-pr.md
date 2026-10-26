# Show public and viewing-key perspectives in the local Sapling lab

The funded cycle previously displayed Alice's and Bob's decrypted balances together with public chain data. That made the source of each fact hard to see.

Add a perspective selector that starts with Public observer. The public report uses an explicit list of fields from accepted Octez snapshots. It shows pool backing, payout, separate payer costs, output counts, spent-note markers, and a public operation timeline.

Alice and Bob each get a separate report with the balance and incoming memos that the worker decrypted. Changing perspective removes the previous report. A new run resets the view to public. Public progress and failure text do not include private fixture amounts or memos. Confirmed operation receipts remain available if a later state read fails.

## Privacy presentation evidence

Check the public report and rendered text separately from proof validity. Tests reject private fixture markers in the public report and check role changes, restarts, delayed responses, and generic error text. The real browser cycle checks the same perspective changes after Octez applies the transactions.

The selector is an explanation tool. The demo keys are published, so the selector provides no access control or anonymity. It does not remove timing, count, public payer, or builder-order signals.

## Compatibility evidence

The ordinary vendor SDK, proof workers, wallet and counter code, dependency lock, and local contract/session logic remain unchanged. The original funded protocol rejection test is retained. The previous UI expectation changes deliberately because the two private balances no longer appear together.

All 94 app unit tests pass. The funded protocol rejection cases pass across Chromium, Firefox, and WebKit. After a mobile wrapping correction, all three real perspective UI cases pass at 360 pixels with reduced motion. Four original Chromium proof-lab checks also pass. The bounded session check covers 781 histories and detects all five deliberate mutations.

The evidence report records the initial layout failures and the passing rerun separately. Original wallet/counter sources and tests remain unchanged.

This draft remains local. It does not deploy a service or change the SDK output order policy.
