# Local Sapling build

`taquito-sapling-25.1.0.tgz` is a local npm package built from Taquito commit `8ecb7ad0db4af8dbfa1282385351dde28107e973`. It contains the merged memo-byte and parameter-body fixes, which postdate the published 25.1.0 release. Its package version remains upstream 25.1.0; the file hash identifies this experiment build.

SHA-256: `ad5da213d0a3a51543308896f553b6fab16d6ae338dd0344b88bdc7ecb0f22c0`.

Build in a checkout of that commit with Node 24:

```sh
npm ci
NX_DAEMON=false npx nx run @taquito/sapling:build
cd packages/taquito-sapling
npm pack
```

The pnpm lockfile records the exact tarball integrity. Replace this local artifact with an upstream release only after confirming it contains the fixes and rerunning both proof and compatibility checks. The package uses the upstream Apache-2.0 license; dependency licenses remain in their installed packages.
