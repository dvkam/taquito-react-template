# Public and viewing-key perspectives

Open the Sapling lab and choose **Run local payment cycle**. The worker creates real Sapling proofs. A local Octez mockup applies a deposit, a private update, and a withdrawal. The result opens in **Public observer**.

## Read the public report

The report shows public pool backing, the payout to the public recipient, and the separate fee payer's costs. The public timeline shows changes to backing, output counts, spent-note marker counts, and accepted operation receipts.

A zero backing change is a private pool update. The report does not assign its outputs to Alice, Bob, or change. Counts and transaction construction patterns can still provide information. A root or operation hash is an identifier, not a proof of anonymity.

## Inspect a viewing key

Choose **Alice** or **Bob**. The worker has already decrypted that identity's balance and incoming memos. Only the selected report appears. Incoming memos are history and may refer to notes that have since been spent. The balance counts unspent notes.

Alice finishes with 7 test XTZ and Bob with 1. The public contract backs 8 and the public recipient receives 2. Fees and storage costs come from the separate payer and do not reduce those shielded balances.

The keys are published disposable fixtures. Anyone who knows those keys can recover the same information. The selector changes the explanation, not access rights. A viewing key does not authorize spending, but this local app also contains the published demo spending keys. It is not a wallet security model.

## Repeat a run

A new run removes the old perspective and creates a fresh local pool. The completed view starts public again. Closing the lab stops its worker and prevents late results from restoring a private report.

If Octez applied an operation but a later state refresh fails, retain the displayed operation receipt. Do not resubmit that operation. Inspect the local verifier before starting a fresh pool. Generic errors omit private diagnostic strings from the page.

## Relation to issue 3472

This interface uses the ordinary pinned vendor SDK. The proposed randomized output order implementation remains a separate local Taquito contribution and experiment. The interface does not silently enable that option or claim its measured improvement for the default builder.

The output-order measurements concern the ability to identify change by position in a specified workload. Compatibility checks concern existing public calls, fixed bytes, and accepted protocol behavior. Keep these evidence groups separate.
