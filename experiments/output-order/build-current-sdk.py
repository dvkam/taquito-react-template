"""Build unchanged main and the exact clean local contribution for protocol checks."""
from pathlib import Path
import hashlib
import io
import json
import os
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SDK = Path(os.environ.get('SAPLING_ORDER_SDK_ROOT', '/home/david/workspace/taquito-3472')).resolve()
CACHE = ROOT / '.cache/output-order-current'
CACHE.mkdir(parents=True, exist_ok=True)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=SDK, text=True).strip()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

status = git('status', '--porcelain')
if status:
    raise RuntimeError('Commit or otherwise resolve SDK changes before creating proof evidence.')
head = git('rev-parse', 'HEAD')
base = git('rev-parse', 'origin/main')
if git('merge-base', head, base) != base:
    raise RuntimeError('Rebase the local SDK contribution onto recorded main first.')
archive = subprocess.check_output(['git', 'archive', base, 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.prod.json', 'packages/taquito-sapling'], cwd=SDK)
# A fresh directory prevents removed upstream files surviving from an earlier run.
baseline = Path(tempfile.mkdtemp(prefix='baseline-', dir=CACHE))
with tarfile.open(fileobj=io.BytesIO(archive)) as files:
    files.extractall(baseline, filter='data')
package = baseline / 'packages/taquito-sapling'
for link, target in [(baseline / 'node_modules', SDK / 'node_modules'), (package / 'node_modules', SDK / 'packages/taquito-sapling/node_modules')]:
    if not target.exists():
        continue
    if link.is_symlink():
        assert link.resolve() == target.resolve()
    elif not link.exists():
        link.symlink_to(target, target_is_directory=True)
    else:
        raise RuntimeError('Unexpected dependency directory: ' + str(link))
manifest = {'baseRevision': base, 'candidateRevision': head, 'sdkRoot': str(SDK), 'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'dependencyLockSha256': sha(SDK / 'package-lock.json'), 'variants': {}}
for variant, directory in [('baseline', package), ('candidate', SDK / 'packages/taquito-sapling')]:
    result = subprocess.run(['npm', 'run', 'build'], cwd=directory, text=True, capture_output=True)
    (CACHE / (variant + '-build.log')).write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(variant + ' build failed: ' + (result.stdout + result.stderr)[-4000:])
    artifacts = sorted([*directory.glob('dist/taquito-sapling.*.js'), *directory.glob('dist/lib/**/*.js'), *directory.glob('dist/types/**/*.d.ts')])
    manifest['variants'][variant] = {'directory': str(directory), 'artifacts': {str(p.relative_to(directory)): sha(p) for p in artifacts}}
    print(variant + ': built ' + str(len(artifacts)) + ' fingerprinted artifacts')
if git('status', '--porcelain') != status or git('rev-parse', 'HEAD') != head:
    raise RuntimeError('SDK source changed during proof build.')
manifest['browserPaths'] = {variant: data['directory'] + '/dist/taquito-sapling.es6.js' for variant, data in manifest['variants'].items()}
manifest['installedDependencyLockSha256'] = sha(SDK / 'node_modules/.package-lock.json')
(CACHE / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'base': base, 'candidate': head, 'browserPaths': manifest['browserPaths']}, indent=2))
