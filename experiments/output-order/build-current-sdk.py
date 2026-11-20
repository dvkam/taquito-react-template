"""Fingerprint current SDK modes from the isolated, coherent vendor build."""
from pathlib import Path
import datetime
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/output-order-current'
if CACHE.exists():
    history = ROOT / '.cache/output-order-history'
    history.mkdir(exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    CACHE.rename(history / stamp)
CACHE.mkdir()
sys.path.insert(0, str(ROOT / 'tools'))
from sdk_snapshot import load_snapshot
metadata, provenance, inputs = load_snapshot(ROOT)
SDK = Path(metadata['sourceDirectory'])
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
for name, expected in inputs.items():
    if sha(SDK / name) != expected:
        raise RuntimeError('SDK source changed: ' + name)
package = SDK / 'packages/taquito-sapling'
artifacts = {str(p.relative_to(package)): sha(p) for p in sorted((package / 'dist').rglob('*')) if p.is_file()}
manifest = {'comparison': 'One current SDK, omitted outputOrder versus explicit preserve versus randomized', 'baseRevision': provenance['revision'], 'candidateRevision': provenance['revision'], 'sdkRoot': str(SDK), 'sourceInputs': inputs, 'sourceArchiveSha256': provenance['sourceArchiveSha256'], 'treeRevision': provenance['treeRevision'], 'dependencyLockSha256': sha(SDK / 'package-lock.json'), 'installedDependencyLockSha256': sha(SDK / 'node_modules/.package-lock.json'), 'appLockSha256': sha(ROOT / 'pnpm-lock.yaml'), 'vendorManifest': metadata['manifest'], 'vendorManifestSha256': sha(ROOT / metadata['manifest']), 'variants': {variant: {'directory': str(package), 'artifacts': artifacts} for variant in ['baseline', 'candidate']}}
manifest['browserPaths'] = {variant: str(package / 'dist/taquito-sapling.es6.js') for variant in ['baseline', 'candidate']}
(CACHE / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({key: manifest[key] for key in ['comparison', 'baseRevision', 'browserPaths']}, indent=2))
