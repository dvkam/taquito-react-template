# Funded local Sapling cycle

Approved scope: a local persistent pool, browser-worker proofs and actual protocol balance observations. Baseline is 322e0d3. No public deployment or upstream package work.

Test interfaces are the contract call and its RPC-observed state/balances, plus the browser worker and existing wallet/counter behavior. These follow the previously approved plan. Contract proof verification and SDK construction remain independent.

Use a fresh Octez mockup for each run. Shield 10,000,000 mutez, transfer 3,000,000, withdraw 2,000,000. Assert final Alice 7,000,000, Bob 1,000,000, pool 8,000,000, payout 2,000,000. Public payer fees are separate. Rejections must preserve contract state and balances.

Reuse Taquito's single-state contract design after inspecting it. Read one coherent snapshot under a serialized local session. Never apply the same session transition twice. Public disposable identities are test data. No privacy claim follows from their use.

Privacy work will measure observable metadata under an explicit observer model. Compare direct persona fee payment with a shared independent local fee payer. This may remove a direct payer identity signal, but it does not prove unlinkability against timing, amount, network or service observers. Relaying, timing policies and larger participant sets need separate experiments before comparative anonymity claims.
