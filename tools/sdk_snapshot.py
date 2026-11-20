"""Validate an isolated SDK snapshot against the committed vendor manifest."""
import hashlib
import json
from pathlib import Path


def load_snapshot(root):
    metadata = json.loads((root / '.cache/sdk-refresh/build.json').read_text())
    source = Path(metadata['sourceDirectory'])
    manifest = json.loads((root / metadata['manifest']).read_text())
    if metadata['revision'] != manifest['revision']:
        raise RuntimeError('SDK cache revision differs from vendor manifest')
    def sha(file):
        return hashlib.sha256(file.read_bytes()).hexdigest()
    inputs = json.loads((source / 'source-hashes.json').read_text())
    for name, expected in inputs.items():
        if sha(source / name) != expected:
            raise RuntimeError('SDK source changed: ' + name)
    if sha(source / 'package-lock.json') != manifest['sourceLockSha256']:
        raise RuntimeError('SDK source lock changed')
    for name, record in manifest['packages'].items():
        directory = source / 'packages' / ('taquito' if name == '@taquito/taquito' else 'taquito-' + name.split('/')[1])
        for file, expected in record['files'].items():
            if sha(directory / file) != expected:
                raise RuntimeError('SDK artifact differs from committed vendor: ' + name + '/' + file)
    return metadata, manifest, inputs


if __name__ == '__main__':
    metadata, manifest, inputs = load_snapshot(Path(__file__).resolve().parents[1])
    print('Verified source cache and all vendor SDK artifact bytes at ' + metadata['revision'])
