# Local output-order experiment

The ordinary playground keeps its pinned vendor SDK. The order experiment is an explicit build input and never replaces that dependency. Issue #3472 exists. The candidate contribution and this harness remain local.

## Current SDK protocol validation

Use Ubuntu, Node 24, and the coherent installed dependencies in the isolated `/home/david/workspace/taquito-3472` worktree. Refresh main and rebase that worktree first if needed. Commit source changes before recording proof evidence.

```sh
python3 experiments/output-order/build-current-sdk.py
PORT=4189 python3 experiments/output-order/run-current-protocol.py
python3 experiments/output-order/verify-current-protocol.py
```

Set `SAPLING_ORDER_SDK_ROOT` for a different local SDK worktree. The builder records `origin/main` and the clean contribution HEAD. It archives the unchanged main SDK and builds it with the same installed dependencies as the candidate. Both builds use their standard package build commands.

The runner supplies explicit baseline and candidate ES6 artifact paths to the opt-in Vite aliases. Supplying only one path is an error. It fingerprints the built and served files, runs five real Chromium worker/Octez scenarios, and verifies SDK inputs again. The final verification checks served artifact hashes and both dependency locks before the ordinary build is restored. It also checks saved mutation rejection snapshots and the recorded test status.

The five cases cover multi-recipient shielding, the unchanged baseline, candidate default mode, and randomized private transfers with actual moved change. Preparation retries select moved outputs only for compatibility coverage. They are not an unbiased privacy sample.

Evidence is in `.cache/output-order-current` and `test-results/output-order-current`. Keep the raw JSON, build manifest, test log, and verified summary together. This is a local bundled-consumer check, not packed npm consumer qualification or an all-browser SDK matrix.

## Retained privacy experiment

The historical construction experiment is pinned to source `8ecb7ad`. Its 4,096-transaction corpus per variant and output count uses mocked proof and encryption work. It measures the change-position signal separately from real protocol validation. Preserve the saved corpus and its manifest. Do not relabel its percentages as fresh measurements.

The older commands remain available for a deliberately new measurement:

```sh
pnpm experiment:order:build
pnpm experiment:order:measure
PORT=4186 PAGES_BASE_PATH=/proof-lab/ pnpm experiment:order:browser
```

Those commands use the original archived experiment inputs, not the current contribution build. The original isolated 108-pass/three-failure SDK sweep was later explained and a source-aligned run passed all 111 tests. The current contribution has its own native/type/build evidence. Do not treat those different runs as one result.

## Restore the ordinary playground

After archiving and verifying the experimental served files, restore the normal inputs:

```sh
PAGES_BASE_PATH=/proof-lab/ pnpm build
```

The ordinary app has 94 unit tests. Its wallet and proof worker dependencies stay unchanged. See the task's local #3472 verification report and draft PR description for the current results and remaining limits.
