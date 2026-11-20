# Local output-order experiment

The ordinary playground and this experiment use the current pinned SDK described in [vendor provenance](../../vendor/README.md). Output ordering shipped in [Taquito PR #3499](https://github.com/ecadlabs/taquito/pull/3499). This harness now compares the same current build with omitted `outputOrder`, explicit `preserve`, and explicit `randomized` modes.

## Current proof and privacy checks

Use Linux x64, Node 24 and the pinned pnpm version. First reconstruct the isolated source cache with the command in the vendor guide, then run:

```sh
pnpm install --frozen-lockfile
pnpm verify:sdk
pnpm sapling:setup
python3 experiments/output-order/build-current-sdk.py
node experiments/output-order/measure.mjs
PORT=4195 python3 experiments/output-order/run-current-protocol.py
python3 experiments/output-order/verify-current-protocol.py
```

The input builder fingerprints the archived SDK source, built artifacts, vendor manifest and separate SDK/app dependency locks. It moves any previous `.cache/output-order-current` directory to a dated `.cache/output-order-history` path before recording a new run. Both browser aliases point to the same pinned SDK. Default versus preserve is a same-version compatibility check, not a claim that every byte matches the old October vendor package.

The 4,096-sample construction corpus per mode and output count uses mocked proof and encryption work. It measures only output position. `privacy/measurement.json` and `positions.json` retain this evidence separately from `privacy/construction-compatibility.json`.

Real proof checks use the production browser build and pinned Octez 25.3/Tallinn. Five Chromium scenarios exercise omitted/default, preserve and randomized modes. They verify later spending of moved change, exact spends, multiple recipients, Unicode memos and literal withdrawal recipient bytes. Reordered signed outputs and altered recipients must be rejected without changing state. Preparation retries select moved cases for compatibility coverage only; they are excluded from the unbiased privacy corpus.

The runner keeps its browser output in `.cache/output-order-current/browser-dist` and verifies SDK, served artifact and lock hashes again after execution. Raw evidence is under `test-results/output-order-current`. Keep the manifests, raw JSON, test status and verified summary together.

## Historical evidence

The October source patch, original vendor tarball and saved reports remain historical inputs. Their percentages and earlier baseline failures are not fresh results. Read the [historical construction report](../../docs/sapling-output-order-experiment.md) and the dated evidence directories. The old `build-sdk.py` prototype is not the acceptance path for this refresh.

## Ordinary playground compatibility

```sh
PAGES_BASE_PATH=/proof-lab/ pnpm build
pnpm test:compat
pnpm verify:pool-session
PORT=4194 PAGES_BASE_PATH=/proof-lab/ pnpm test:browser
```

These checks are separate from output-order privacy measurements. The ordinary app preserves output order. Published fixture keys provide no secrecy, and these checks do not establish public-network or real-wallet validation.
