"""Run protocol compatibility separately from the retained privacy corpus."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from sdk_snapshot import load_snapshot
load_snapshot(ROOT)
CACHE = ROOT / '.cache/output-order-current'
manifest = json.loads((CACHE / 'build-manifest.json').read_text())
SDK = Path(manifest['sdkRoot'])
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    load_snapshot(ROOT)
    if sha(ROOT / 'pnpm-lock.yaml') != manifest['appLockSha256']:
        raise RuntimeError('Application dependency lock changed')
    if sha(ROOT / manifest['vendorManifest']) != manifest['vendorManifestSha256']:
        raise RuntimeError('Vendor manifest changed')
    if sha(SDK / 'package-lock.json') != manifest['dependencyLockSha256'] or sha(SDK / 'node_modules/.package-lock.json') != manifest['installedDependencyLockSha256']:
        raise RuntimeError('SDK dependency lock changed')
    for name, expected in manifest['sourceInputs'].items():
        if sha(SDK / name) != expected:
            raise RuntimeError('SDK source changed: ' + name)
    for data in manifest['variants'].values():
        for name, expected in data['artifacts'].items():
            if sha(Path(data['directory']) / name) != expected:
                raise RuntimeError('SDK artifact changed: ' + name)
verify()
browser_dist = CACHE / 'browser-dist'
env = dict(os.environ, SAPLING_DIST_DIR=str(browser_dist), OUTPUT_ORDER_EXPERIMENT='1', PAGES_BASE_PATH='/proof-lab/', PORT=os.environ.get('PORT', '4189'), SAPLING_ORDER_BASELINE_SDK=manifest['browserPaths']['baseline'], SAPLING_ORDER_CANDIDATE_SDK=manifest['browserPaths']['candidate'])

def run(command, name):
    with (CACHE / (name + '.log')).open('w') as log:
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in process.stdout:
            log.write(line)
            print(line, end='', flush=True)
        if process.wait():
            raise RuntimeError(name + ' failed; retain its logs before retrying')

run(['pnpm', 'exec', 'vite', 'build', '--outDir', str(browser_dist)], 'browser-build')
manifest['browserDist'] = str(browser_dist)
manifest['servedArtifacts'] = {str(p.relative_to(browser_dist)): sha(p) for p in sorted((browser_dist).rglob('*')) if p.is_file()}
manifest['protocol'] = subprocess.check_output([str(ROOT / '.cache/sapling/octez-client'), '--version'], text=True).strip()
(CACHE / 'protocol-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
run(['pnpm', 'exec', 'playwright', 'test', '--config', 'playwright.output-order.config.ts', '--output', 'test-results/output-order-current'], 'protocol-tests')
verify()
status = json.loads((ROOT / 'test-results/output-order-current/.last-run.json').read_text())
if status['status'] != 'passed':
    raise RuntimeError('Protocol test status did not pass')
(CACHE / 'source-and-artifacts-unchanged.json').write_text(json.dumps({'candidateRevision': manifest['candidateRevision'], 'status': 'passed', 'allInputArtifactHashesVerifiedAfterRun': True}, indent=2) + '\n')
print('Current SDK protocol checks passed; input hashes verified again after the run.', flush=True)
