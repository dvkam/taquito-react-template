"""Exercise the real source-cache validator with independent corruption controls."""
import hashlib
import json
from pathlib import Path
import tempfile
from sdk_snapshot import load_snapshot


def sha(data):
    return hashlib.sha256(data).hexdigest()


with tempfile.TemporaryDirectory(prefix='sapling-cache-check-') as directory:
    root = Path(directory)
    source = root / 'source'
    package = source / 'packages/taquito-sapling'
    (package / 'dist').mkdir(parents=True)
    (package / 'src').mkdir()
    files = {
        'package-lock.json': b'{"lockfileVersion":3}',
        'packages/taquito-sapling/src/runtime.ts': b'export const value = 7;',
        'packages/taquito-sapling/dist/runtime.js': b'exports.value = 7;',
        'packages/taquito-sapling/package.json': b'{"name":"@taquito/sapling","version":"test"}',
    }
    for name, data in files.items():
        (source / name).write_bytes(data)
    (source / 'source-hashes.json').write_text(json.dumps({name: sha(files[name]) for name in ['package-lock.json', 'packages/taquito-sapling/src/runtime.ts']}))
    vendor = root / 'vendor'
    vendor.mkdir()
    manifest = {'revision': 'fixed', 'sourceLockSha256': sha(files['package-lock.json']), 'packages': {'@taquito/sapling': {'files': {'dist/runtime.js': sha(files['packages/taquito-sapling/dist/runtime.js']), 'package.json': sha(files['packages/taquito-sapling/package.json'])}}}}
    (vendor / 'manifest.json').write_text(json.dumps(manifest))
    cache = root / '.cache/sdk-refresh'
    cache.mkdir(parents=True)
    metadata = {'revision': 'fixed', 'sourceDirectory': str(source), 'manifest': 'vendor/manifest.json'}
    (cache / 'build.json').write_text(json.dumps(metadata))
    load_snapshot(root)
    print('unchanged snapshot: passed')
    for name, original in files.items():
        try:
            (source / name).write_bytes(original + b' changed')
            try:
                load_snapshot(root)
            except RuntimeError:
                print(name + ': corruption detected')
            else:
                raise AssertionError('Corruption was accepted: ' + name)
        finally:
            (source / name).write_bytes(original)
        load_snapshot(root)
    metadata['revision'] = 'wrong'
    (cache / 'build.json').write_text(json.dumps(metadata))
    try:
        load_snapshot(root)
    except RuntimeError:
        print('revision mismatch: corruption detected')
    else:
        raise AssertionError('Revision mismatch accepted')
print('All five corruption controls passed against the real validator.')
