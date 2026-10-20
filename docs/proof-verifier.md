# Independent Sapling proof verifier

Run `node tools/setup-sapling.mjs` on Linux x64. It downloads pinned Octez 25.3 and Sapling parameters into `.cache/sapling`, checks SHA-256, and creates a local Tallinn mockup. No node or chain connection is needed. No system packages are installed.

Import `verifyTransaction` from `tools/sapling-verify.mjs`, or pass a JSON file with `transactionHex` to its CLI. The verifier runs real Octez `SAPLING_VERIFY_UPDATE`. A valid result contains `accepted: true`, the bound data hex, and the signed balance as a decimal string. Verification failure returns `accepted: false`. Runtime and configuration failures throw; they are not proof failures.

The fixed fixture uses chain `NetXynUjJNZm7wi`, contract `KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC`, eight-byte memos, and a one-mutez shield. Its canonical empty tree root is `fbc2f4300c01f0b7820d00e3347c8da4ee614674376cbc45359daa54f9b5493e`. The source of this root is 32 Sapling Merkle hash rounds from the uncommitted leaf `01` followed by 31 zero bytes. Octez accepts the resulting transaction against an empty state.

The verifier contract returns the protocol's bound data, balance and updated state. For the fixture, require empty bound data and balance `-1`. Supply `--balance 0` because the synthetic self address has no stored balance. The helper checks the mockup chain ID before execution. A caller-provided chain mismatch is a configuration error; test cryptographic chain mismatch by generating a transaction with a different chain ID, then checking it under the default context.

Independent controls executed during setup used a real SDK-generated Node shield. Octez accepted it. Replacing the 192 proof bytes with zero bytes returned explicit `INVALID_SAPLING_PROOF`, not a decoding failure. Flipping a binding-signature byte also returned verification failure. Browser-generated proofs must pass this same oracle separately.

The first four bytes encode input byte length. With no inputs, bytes 4 through 7 encode output byte length. The first output starts at byte 8 with a 32-byte commitment, followed by 192 proof bytes at offset 40. The binding signature starts at `8 + outputByteLength`. Do not treat those length fields as counts.

Configuration overrides are `SAPLING_OCTEZ_CLIENT`, `SAPLING_MOCKUP_DIR`, and `SAPLING_PARAMS_PARENT`. The last directory must contain `zcash-params/sapling-spend.params` and `sapling-output.params`. Local research tools are available under `/home/david/workspace/taquito-proof-tools`, with mockup directory `tallinn-state`.

## Provenance

- [Official Octez installation and static binaries](https://octez.tezos.com/docs/introduction/howtoget.html)
- [Octez 25.3 package registry](https://gitlab.com/tezos/tezos/-/packages/73095772), binary SHA-256 `2e03901db6e0eab373e16ecf1d37055f6adf8a300a3cbed449eb61e45a511b63`. Version output is `e5d8a6b8`, Octez 25.3.
- [Mockup documentation](https://octez.tezos.com/docs/user/mockup.html)
- [SAPLING_VERIFY_UPDATE protocol semantics](https://octez.tezos.com/docs/active/sapling.html)
- [Canonical parameter lookup implementation](https://gitlab.com/tezos/tezos/-/blob/octez-v25.3/src/lib_sapling/rustzcash.ml)
- [Taquito parameter manifest](https://github.com/ecadlabs/taquito/blob/8ecb7ad0db4af8dbfa1282385351dde28107e973/packages/taquito-sapling/src/sapling-params-manifest.json)

The verifier is an independent protocol implementation, not independent cryptographic research: both implementations implement the Sapling construction and use the same trusted setup. This fixture checks a one-output shield, not spend authorization, double spends, or arbitrary pool histories.

## Runtime attribution checks

Each verification hashes the actual executable and requires the official pinned binary hash. It also reads the mockup chain and its next protocol through local RPC. The next protocol is the protocol used to execute the next simulated operation. Both accepted and rejected results include this checked protocol identifier. Setup checks existing contexts as well as newly created ones. An incompatible context or binary is a setup error, never a proof rejection. No binary-hash cache is used.

The changed-contract control is a cryptographic binding test. Passing a different chainId argument to the helper only exercises the configuration guard and must not be reported as a cryptographic chain-binding test.
