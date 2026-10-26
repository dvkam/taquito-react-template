"""Check the actual served artifacts and raw current-run evidence before archiving."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/output-order-current'
manifest = json.loads((CACHE / 'protocol-manifest.json').read_text())
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
SDK = Path(manifest['sdkRoot'])
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=SDK, text=True).strip() == manifest['candidateRevision']
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=SDK, text=True).strip()
for data in manifest['variants'].values():
    for name, expected in data['artifacts'].items():
        assert sha(Path(data['directory']) / name) == expected, name
served = {str(p.relative_to(ROOT / 'dist')): sha(p) for p in sorted((ROOT / 'dist').rglob('*')) if p.is_file()}
assert served == manifest['servedArtifacts'], 'Served build changed during verification'
assert sha(SDK / 'package-lock.json') == manifest['dependencyLockSha256']
assert sha(SDK / 'node_modules/.package-lock.json') == manifest['installedDependencyLockSha256']
results = ROOT / 'test-results/output-order-current'
assert json.loads((results / '.last-run.json').read_text())['status'] == 'passed'
cycles = [json.loads(p.read_text()) for p in results.glob('*/output-order-evidence.json')]
shields = [json.loads(p.read_text()) for p in results.glob('*/shield-evidence.json')]
assert len(cycles) == 3 and len(shields) == 2
assert {item['variant'] for item in cycles} == {'baseline', 'candidate-default', 'candidate-randomized'}
assert {item['variant'] for item in shields} == {'baseline', 'candidate-randomized'}
protocolHash = 'PtTALLiNtPec7mE7yY4m3k26J8Qukef3E3ehzhfXgFZKGtDdAXu'
summary = {'protocolHash': protocolHash, 'octezBinarySha256': sha(ROOT / '.cache/sapling/octez-client'), 'baseRevision': manifest['baseRevision'], 'candidateRevision': manifest['candidateRevision'], 'browser': 'Chromium', 'octez': manifest['protocol'], 'servedArtifactHashesVerified': True, 'sdkArtifactHashesVerified': True, 'dependencyLocksUnchanged': True, 'cycles': [], 'shields': []}
for item in cycles:
    variant = item['variant']
    expected = 3 if variant == 'candidate-default' else 6
    assert len(item['evidence']) == expected
    assert len(item['rejections']) == 2
    for rejection in item['rejections']:
        assert rejection['accepted'] is False and rejection['before'] == rejection['after']
    for step in item['evidence']:
        assert step['accepted'] is True and step['operationHash'].startswith('o')
        assert step['public']['protocol'] == protocolHash
    seed = next(step for step in item['evidence'] if step['action'] == 'seed')
    transfer = next(step for step in item['evidence'] if step['action'] == 'transfer')
    firstNewPosition = len(seed['public']['diff']['commitments_and_ciphertexts'])
    changes = [note for note in transfer['view']['notes'][0] if note['position'] >= firstNewPosition]
    assert len(changes) == 1 and changes[0]['value'] == '7000000'
    assert changes[0]['position'] == firstNewPosition + (0 if variant == 'candidate-randomized' else 1)
    movedChangeSpent = any(step['action'] == 'change-spend' and step['view']['balances'][0] == '0' for step in item['evidence'])
    assert movedChangeSpent == (variant != 'candidate-default')
    summary['cycles'].append({'variant': variant, 'acceptedApplications': expected, 'changeOutputPosition': changes[0]['position'], 'changeSpentInLaterAction': movedChangeSpent, 'rejectedMutationsWithUnchangedState': 2, 'preparationAttempts': {step['action']: step['attempts'] for step in item['evidence']}})
for item in shields:
    assert item['view']['balances'] == ['6000000', '4000000', '0']
    assert item['snapshot']['poolMutez'] == '10000000'
    assert item['snapshot']['protocol'] == protocolHash
    assert item['view']['notes'][0][0]['position'] == (1 if item['variant'] == 'candidate-randomized' else 0)
    summary['shields'].append({'variant': item['variant'], 'acceptedApplications': 1, 'preparationAttempts': item['attempts'], 'aliceOutputPosition': item['view']['notes'][0][0]['position'], 'bobOutputPosition': item['view']['notes'][1][0]['position']})
summary['acceptedApplications'] = sum(item['acceptedApplications'] for item in summary['cycles'] + summary['shields'])
summary['rejectedMutationsWithUnchangedState'] = sum(item['rejectedMutationsWithUnchangedState'] for item in summary['cycles'])
assert summary['acceptedApplications'] == 17 and summary['rejectedMutationsWithUnchangedState'] == 6
(CACHE / 'verified-protocol-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
