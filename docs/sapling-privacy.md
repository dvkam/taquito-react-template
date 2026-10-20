# Privacy scope and next experiment

The funded cycle tests accounting and Sapling execution. Published fixture seeds provide no secrecy. The local verifier can also observe submission timing and network requests. This run cannot establish an anonymity set or comparative unlinkability.

## What this implementation reduces

All outer operations use one independent public bootstrap payer. Alice and Bob hold separate Sapling keys in a browser worker. Their Sapling keys do not sign outer Tezos operations. The withdrawing recipient differs from the payer. This avoids requiring Bob to fund an outer-operation account just to withdraw in the local flow. It is not a production relayer and does not hide who funds that payer.

An unrelated recipient viewing key must recover zero owned notes. Alice retains legitimate outgoing viewing access to the transfer she sent. Viewing-only entry does not fetch proving parameters. These are tested properties of access to data, not a comparison with Tornado's anonymity.

## What remains visible

The contract, payer, deposit amount, withdrawal amount and public recipient remain visible. Serialized sizes expose input/output counts. Timing, network metadata and a small participant set can support correlation. One Alice/Bob round trip is especially easy to correlate even if its note contents are encrypted.

## A measurable anonymity experiment

Use a public-chain observer with access to operation sender, time, amount, size and recipient, but no viewing keys or network/service logs. Separately test a stronger observer with service timing logs. Define the observer before collecting results.

Compare the same synthetic multi-person transaction workload with direct persona fee payers, then an independent shared payer. Later compare immediate submission with a documented randomized-delay policy and consistent transaction shapes. Never represent a deliberately weakened comparison as Tornado's actual behavior. Run matched workloads and fixed seeds, preserving correctness and withdrawal-recipient binding.

Measure remaining candidate senders for each withdrawal, top-choice linkage accuracy against held-out ground truth, and the effect of amount and timing filters. Report workload size, assumptions, distributions, failures and confidence intervals. A larger candidate set in this experiment supports only that stated observer/workload result. It does not establish cryptographic security or superiority to Tornado Nova.

Before making an advantage claim, implement the compared policies, retain an unmodified baseline, reproduce the result and include an amount/timing counterexample. Larger independent participation, external analysis and deployment-specific network behavior remain outside this local milestone.
