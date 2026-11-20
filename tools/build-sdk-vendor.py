"""Build and vendor one coherent Taquito source revision for the local proof lab."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
from sdk_snapshot import load_snapshot

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', required=True, type=Path)
parser.add_argument('--revision', required=True)
args = parser.parse_args()
checkout = args.checkout.resolve()
def git(*values):
    return subprocess.check_output(['git', *values], cwd=checkout, text=True).strip()
revision = git('rev-parse', args.revision + '^{commit}')
existing = ROOT / 'vendor' / revision[:8] / 'manifest.json'
recorded = None
if existing.exists():
    recorded = json.loads(existing.read_text())
    if recorded['revision'] != revision:
        raise RuntimeError('Vendor prefix collision')
    for package in recorded['packages'].values():
        if hashlib.sha256((ROOT / package['file']).read_bytes()).hexdigest() != package['sha256']:
            raise RuntimeError('Existing vendor artifact differs; keep it for investigation')
    metadata_file = ROOT / '.cache/sdk-refresh/build.json'
    if metadata_file.exists():
        metadata = json.loads(metadata_file.read_text())
        if metadata['revision'] == revision and (Path(metadata['sourceDirectory']) / 'source-hashes.json').exists():
            load_snapshot(ROOT)
            print('Verified existing vendor build and source cache: ' + revision)
            raise SystemExit(0)
cache = ROOT / '.cache/sdk-refresh'
cache.mkdir(parents=True, exist_ok=True)
build = Path(tempfile.mkdtemp(prefix=revision[:8] + '-', dir=cache))
archive = subprocess.Popen(['git', 'archive', revision], cwd=checkout, stdout=subprocess.PIPE)
with tarfile.open(fileobj=archive.stdout, mode='r|') as source:
    source.extractall(build, filter='data')
archive.stdout.close()
if archive.wait():
    raise RuntimeError('SDK archive failed')
source_archive_hash = hashlib.sha256(subprocess.check_output(['git', 'archive', revision], cwd=checkout)).hexdigest()
source_hashes = {str(p.relative_to(build)): hashlib.sha256(p.read_bytes()).hexdigest() for p in build.rglob('*') if p.is_file() and (str(p.relative_to(build)).startswith(('packages/', 'scripts/')) or p.parent == build)}
(build / 'source-hashes.json').write_text(json.dumps(source_hashes, indent=2) + '\n')
env = dict(os.environ, NX_DAEMON='false')
for command in [['npm', 'ci', '--no-audit', '--no-fund'], ['npm', 'run', 'build']]:
    with (build / ('install.log' if command[1] == 'ci' else 'build.log')).open('w') as log:
        result = subprocess.run(command, cwd=build, env=env, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError('SDK command failed; inspect logs in ' + str(build))
packages = {}
for file in sorted((build / 'packages').glob('*/package.json')):
    metadata = json.loads(file.read_text())
    packages[metadata['name']] = (file.parent, metadata)
app_file = ROOT / 'package.json'
app = json.loads(app_file.read_text())
wanted = {name for name in app['dependencies'] if name in packages}
pending = list(wanted)
while pending:
    name = pending.pop()
    for dependency in packages[name][1].get('dependencies', {}):
        if dependency in packages and dependency not in wanted:
            wanted.add(dependency)
            pending.append(dependency)
vendor = ROOT / 'vendor' / revision[:8]
vendor.mkdir(parents=True, exist_ok=True)
records = {}
for name in sorted(wanted):
    directory, metadata = packages[name]
    if recorded is not None:
        record = recorded['packages'][name]
        for file, expected in record['files'].items():
            if hashlib.sha256((directory / file).read_bytes()).hexdigest() != expected:
                raise RuntimeError('Rebuilt SDK differs from committed artifact: ' + name + '/' + file)
        records[name] = record
        continue
    result = json.loads(subprocess.check_output(['npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', str(vendor)], cwd=directory, env=env, text=True))[0]
    artifact = vendor / result['filename']
    records[name] = {'version': metadata['version'], 'file': str(artifact.relative_to(ROOT)), 'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'size': artifact.stat().st_size, 'files': {'package.json': hashlib.sha256((directory / 'package.json').read_bytes()).hexdigest(), **{str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((directory / 'dist').rglob('*')) if p.is_file() and p.suffix in ['.js', '.mjs', '.json', '.ts']}}}
manifest = {'sourceArchiveSha256': source_archive_hash, 'treeRevision': git('rev-parse', revision + '^{tree}'), 'repository': 'https://github.com/ecadlabs/taquito', 'revision': revision, 'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'sourceLockSha256': hashlib.sha256((build / 'package-lock.json').read_bytes()).hexdigest(), 'packages': records}
if recorded is None:
    (vendor / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(cache / 'build.json').write_text(json.dumps({'sourceDirectory': str(build), 'revision': revision, 'manifest': str((vendor / 'manifest.json').relative_to(ROOT))}, indent=2) + '\n')
print(json.dumps({'revision': revision, 'packages': list(records), 'sourceDirectory': str(build)}, indent=2), flush=True)
