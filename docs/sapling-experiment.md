# Run the local Sapling proof lab

This experiment runs real Sapling WASM proof preparation in a module worker and independently verifies the returned transaction with Octez. It uses a published disposable seed, an empty local mock pool, memo size eight, and one mutez. This proof-only mode never submits a transaction. The separate [funded local cycle](sapling-pool.md) now tests shielding, private transfer and withdrawal against a persistent local contract. Both modes use published demonstration identities.

## Setup and run

Use Linux x64, including Ubuntu under WSL, Node 24, and the repository's pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm sapling:setup
pnpm sapling:experiment
```

Open `http://127.0.0.1:4180`. Choose **Open Sapling lab**, then **Prepare proof**. Preparation downloads the authenticated parameters and runs real cryptography. Choose **Verify with Octez** to perform the separate protocol check. Opening the panel alone does not load the worker, WASM, or proving parameters.

The setup downloads a pinned Octez Linux binary and about 49.2 MiB of parameters into ignored `.cache/sapling`. It checks each SHA-256 digest and creates a local Tallinn mockup. See [verifier provenance](proof-verifier.md) for the exact binary, protocol, paths, and limits. The browser uses [the local pinned Sapling build](../vendor/README.md). Existing wallet packages are aligned to published Taquito 25.1.0.

The local server serves the **production build**, parameters, and the verifier endpoint. Ordinary `pnpm dev`, `pnpm preview`, and the public GitHub Pages deployment do not provide the local verifier or parameter endpoints. Do not deploy this experiment server. It binds to loopback, checks request origins for verification, caps request size, and permits one active verifier request.

## What the controls mean

Parameter load and checks includes loading the SDK/WASM and authenticating the parameters. Proof preparation includes deriving the disposable account and preparing its shield transaction. The times are observations on the current machine, not mobile or network guarantees.

A second preparation reuses the worker's initialized parameters. **Stop** terminates the worker. A retry creates fresh WASM state, even if parameter HTTP responses remain cached. Stop during verification aborts the browser request; an already running bounded Octez check may still finish on the server. The UI ignores its stale result. If that check is still running, retry verification after it finishes.

The published test account offers no privacy. The memo and recipient are encrypted on the wire, but anyone can derive the fixture keys. Keys are never sent to the UI or verifier. The UI shows public transaction bytes only on request. A worker keeps expensive work off the page thread; it is not a security boundary against same-origin scripts.

## Verification commands

```sh
pnpm build
pnpm test:compat
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
```

`pnpm build` runs strict lint, formatting, type checks, all unit tests, and the production build. `pnpm test:compat` runs the original 45 wallet/counter/transfer tests unchanged, separately from the new tests. Browser tests execute the emitted module worker and real WASM in all three engines, check literal protocol fields, verify the transaction with Octez, and require proof/signature mutations to fail cryptographic verification.

For a deployment prefix, build and serve with the same value:

```sh
PAGES_BASE_PATH=/proof-lab/ pnpm build
PAGES_BASE_PATH=/proof-lab/ pnpm sapling:serve
```

The public fee-payer wallet and counter examples keep their existing behavior. This lab uses its own local mockup identifiers, not the Shadownet wallet account or counter contract.

## Next application work

This proves the browser worker and verifier path for shielding into an empty fixture. It does not establish spend-proof generation, private transfers, unshielding, state synchronization, viewing-key interoperability, reorganization handling, or mobile performance. Those require their own fixtures and protocol checks before the full playground flow is built.
