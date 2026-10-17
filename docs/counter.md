# Shadownet counter

The demo uses `KT1VNTTHJ56xDoBoS1n3HDcr4s2zt6yDshbG`, the public counter linked from the [Taquito contract guide](https://taquito.io/docs/25.0.0/smartcontracts/).

Verified on 18 October 2026 at block `BMYQMpTT9bGpcMTXWZft2c1q5JYHL2v6oJ2a5mgiyYYmqXsbBim`:

- Chain ID: `NetXsqzbfFenSTS`.
- Storage: Michelson `int`.
- Entrypoints: `increment(int)`, `decrement(int)`, and `reset(unit)`.

The app uses the first two entrypoints with argument `1` and sends zero XTZ to the contract. Each call still requires wallet approval and network fees. Other users can change this shared counter between reads. The displayed value is the current chain value, not a private account counter.

`src/network.ts` owns the RPC URL, chain ID, explorer URL, and address. The wallet module checks the RPC chain, entrypoint types, and storage type. It preserves integer storage as a string and checks operation execution status after confirmation.

## Optional separate deployment

A new deployment is not needed to run this demo. To use a separate counter, first prepare and test a contract with integer storage and the same increment/decrement interface. The Taquito website has its own license; do not assume its examples inherit the SDK's Apache license.

Connect a funded Shadownet wallet and verify the chain ID. Use Taquito's [wallet origination API](https://taquito.io/docs/wallet_API/) with the reviewed contract code, initial storage `0`, and initial contract balance `0`. The wallet must approve the operation and its fee. Save the operation hash before waiting for confirmation, and inspect that hash before retrying after a timeout.

After applied confirmation, read the new deployment's script, entrypoints, and storage. Record its address, chain ID, operation hash, and source revision. Update `counterAddress` only after those checks. Keep private keys outside the repository and browser build configuration.

No contract is deployed automatically by this app.
