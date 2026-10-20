# Local output-order experiment

The ordinary playground keeps its original SDK dependency. Both experimental SDKs are compiled from pinned source into `.cache/output-order` and never installed over it. The active Taquito source and Git state stay unchanged. Builds reuse its installed dependencies.

Use Ubuntu with Node 24 and the existing dependencies in `/home/david/workspace/taquito`. Run from the React template:

```sh
pnpm experiment:order:build
pnpm experiment:order:measure
PORT=4186 PAGES_BASE_PATH=/proof-lab/ pnpm experiment:order:browser
```

The third command builds with the explicit experiment input and runs the dedicated Chromium config. Normal browser discovery excludes these tests. The 4,096-transaction position corpus and report are in `.cache/output-order/results`. The build manifest fingerprints the actual CJS/browser/type artifacts and dependencies. Samples are fresh randomness; retain each result and its corpus together.

Compile the old/new public consumer separately:

```sh
/home/david/workspace/taquito/node_modules/.bin/tsc --ignoreConfig experiments/output-order/public-consumer.ts --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2023
```

The optional unchanged upstream unit sweep uses `SAPLING_SNAPSHOT=baseline` or `candidate` with `pnpm exec vitest run --config experiments/output-order/upstream-vitest.config.mjs`. It is a separate diagnostic. Both snapshots currently have the same three failures out of 111; see the evidence report. Normal app Vitest tests remain 82.

Restore the ordinary build with `PAGES_BASE_PATH=/proof-lab/ pnpm build`. The loopback preview then serves only the original app inputs. See [the measured result and limitations](../../docs/sapling-output-order-experiment.md), [the approved plan](plan.md), and [the local source patch](taquito-output-order.patch). No issue or PR has been created.
