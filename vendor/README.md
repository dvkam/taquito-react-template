# Pinned SDK builds

The playground uses the 11 Taquito packages in `d2915a1b/`, built together from [upstream commit d2915a1b](https://github.com/ecadlabs/taquito/commit/d2915a1bfbf6bf9f2a761ad7c4349f7ea64f9a74). Their upstream package version is 25.1.1. The source revision and hashes identify this local build, which includes later merged changes.

`d2915a1b/manifest.json` records the source commit and tree, source archive and npm lock hashes, each tarball hash, and the packaged JavaScript and declaration hashes. `pnpm-workspace.yaml` overrides the whole required Taquito dependency closure. `pnpm verify:sdk` checks the resolved installed packages and bytes, including transitive imports. Sapling WASM is independently versioned and pinned to 0.3.0 in the dependency lock.

The current Beacon adapter requires `4.9.0-ecad-beta.6`. The eight exact-version release-age exceptions in `pnpm-workspace.yaml` admit that required SDK dependency set. They do not disable the release-age policy for other packages. The lockfile also records the SDK dependency changes, including Beacon UI optional Rollup binaries; direct frontend tool versions are unchanged.

The SDK includes the merged memo and parameter-loader fixes, randomized output ordering, custom bound-data builder exports and native Uint8Array byte handling. Ordinary lab transactions use the default preserved output order. Randomization remains an explicit experiment mode.

## Rebuild the source snapshot

Use Node 24 and a local clone of the upstream Taquito repository:

```sh
python3 tools/build-sdk-vendor.py --checkout /path/to/taquito --revision d2915a1bfbf6bf9f2a761ad7c4349f7ea64f9a74
pnpm install --frozen-lockfile
pnpm verify:sdk
```

The helper archives the complete revision and builds it under ignored `.cache/sdk-refresh`. It does not edit the source checkout or application dependency settings. Existing committed tarballs are verified and never overwritten. A fresh source cache must match the committed package bytes. Selecting a new revision requires an explicit review of dependency paths, overrides, the lockfile and the evidence.

The original `taquito-sapling-25.1.0.tgz` remains for historical provenance. Its SHA-256 is `ad5da213d0a3a51543308896f553b6fab16d6ae338dd0344b88bdc7ecb0f22c0`, from source `8ecb7ad0db4af8dbfa1282385351dde28107e973`. The app no longer installs it.

The upstream packages retain their author and contributor metadata. Taquito code uses Apache-2.0, with a copy in `TAQUITO-LICENSE`. Dependency licenses remain with their packages.
