# Taquito React template

A React starter for connecting a Tezos wallet, sending test XTZ, and calling a counter contract on Shadownet.

## Local Sapling proof experiment

The local branch includes a real browser-worker proof lab with an independent Octez checker. Read [setup, operation, and verification instructions](docs/sapling-experiment.md). The experiment uses disposable public fixture keys and sends no chain transaction. Its verifier runs only through the local experiment server.

## Run locally

Use Node 24 and pnpm 12.14.0. The repository pins both versions.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. Connect a Shadownet wallet. Test tokens have no monetary value. The counter is shared with other users. See [the counter configuration and deployment guide](docs/counter.md).

## Build and checks

```sh
pnpm build
pnpm preview
```

The build runs type-aware Oxlint, Oxfmt, strict TypeScript checks for the app and tools, Vitest tests, and Vite's production build. GitHub Actions runs the same command on pushes and pull requests. Tests use controlled wallet responses and need no account or private key.

Use `pnpm test`, `pnpm check`, or `pnpm format` for individual tasks. `pnpm-workspace.yaml` enables automatic deduplication. Keep `pnpm-lock.yaml` committed.

## Code structure

- `src/Wallet.ts` owns the SDK instances, account subscription, network validation, and confirmed writes.
- `src/useWalletSession.ts` manages display state and rejects stale results after account changes.
- `src/transfer.ts` validates addresses and converts decimal XTZ to exact mutez.
- `src/network.ts` configures Shadownet and the verified counter address.
- `src/App.tsx` contains accessible wallet, transfer, and counter controls.

Balances and counter values remain decimal strings. Conflicting writes share a pending guard. A failed read after a confirmed write does not erase the operation receipt or trigger another write.

The app uses Taquito's supported wallet exports and default pairing UI. It does not contain private signing keys. Never put keys into a Vite environment variable, since those values can enter the browser bundle.

## React Compiler and browser support

The Vite React plugin uses the experimental native Oxc React Compiler. `oxc-transform-react` is pinned to the plugin's compatible version. Oxlint handles static checks; the compiler generates memoization. Compiler diagnostics are enabled during development and builds.

Vite targets ES2023-capable browsers. Buffer, stream, and util compatibility support remains for the wallet dependency graph. The app uses `globalThis` rather than a synthetic global object.

## Dependency maintenance

Refresh compatible dependencies with `pnpm update`, then run `pnpm build` and `pnpm audit`. Do not force a major transitive override solely to clear the audit count. The current wallet dependency tree still includes advisories for `decode-uri-component` and `elliptic`. The decoder's patched release changes module format, and elliptic has no patched release. Track upstream fixes and assess affected APIs before adding an override.

The wallet libraries still account for most of the production bundle. Splitting them into a chunk does not remove their download cost when restoring a wallet on startup.

## GitHub Pages

Live demo: [dvkam.github.io/taquito-react-template](https://dvkam.github.io/taquito-react-template/).

The Pages workflow deploys pushes to `master` after the full build and checks pass. It can also be run manually from that branch. The workflow uses GitHub Pages metadata to set the asset base path, while local development keeps `/`.

To build the Pages layout locally:

```sh
PAGES_BASE_PATH=/taquito-react-template/ pnpm build
PAGES_BASE_PATH=/taquito-react-template/ pnpm preview
```

GitHub Pages must use the GitHub Actions publishing source. Deployments use the `github-pages` environment and GitHub's short-lived deployment token. No separate deployment secret is required.

### Funded local Sapling cycle

The Sapling lab also has a **Run local payment cycle** control. It creates an isolated local Octez pool, shields 10 test XTZ, privately sends 3 to Bob and withdraws 2. The result reports Alice's 7, Bob's 1, contract backing of 8 and a recipient payout of 2, with payer fees and storage costs separate. It uses published disposable identities and no public network.

See [the local pool guide](docs/sapling-pool.md) for setup and independent acceptance checks, and [the privacy experiment](docs/sapling-privacy.md) for the observer model and limits on anonymity claims.
