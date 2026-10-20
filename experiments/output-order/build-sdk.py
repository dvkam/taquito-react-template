from pathlib import Path
import subprocess, tarfile, io, json, hashlib, difflib

ROOT = Path(__file__).resolve().parents[2]
TAQUITO = Path('/home/david/workspace/taquito')
REVISION = '8ecb7ad0db4af8dbfa1282385351dde28107e973'
CACHE = ROOT / '.cache/output-order'
EXPERIMENT = ROOT / 'experiments/output-order'
archive = subprocess.check_output(['git', 'archive', REVISION, 'tsconfig.prod.json', 'packages/taquito-sapling'], cwd=TAQUITO)
metadata = {'sourceRevision': REVISION, 'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'variants': {}}
for variant in ['baseline', 'candidate']:
    directory = CACHE / variant
    directory.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive)) as files:
        files.extractall(directory, filter='data')
    package = directory / 'packages/taquito-sapling'
    for target, dependency in [(directory / 'node_modules', TAQUITO / 'node_modules'), (package / 'node_modules', TAQUITO / 'packages/taquito-sapling/node_modules')]:
        if target.is_symlink():
            assert target.resolve() == dependency.resolve()
        elif not target.exists():
            target.symlink_to(dependency, target_is_directory=True)
        else:
            raise RuntimeError('Unexpected dependency directory: ' + str(target))
    patches = []
    if variant == 'candidate':
        builder = package / 'src/sapling-tx-builder/sapling-transactions-builder.ts'
        original = builder.read_text()
        updated = "import { shuffleOutputs } from './shuffle-outputs';\n" + original
        updated = updated.replace('  #memoSize: number;', "  #memoSize: number;\n  #outputOrder: 'preserve' | 'randomized';")
        updated = updated.replace('    this.#memoSize = saplingContractDetails.memoSize;', "    this.#memoSize = saplingContractDetails.memoSize;\n    this.#outputOrder = saplingContractDetails.outputOrder ?? 'preserve';\n    if (this.#outputOrder !== 'preserve' && this.#outputOrder !== 'randomized') throw new Error('Unknown output order');")
        anchor = '        const signature = await this.createBindingSignature({'
        assert updated.count(anchor) == 2
        updated = updated.replace(anchor, "        if (this.#outputOrder === 'randomized') {\n          shuffleOutputs(outputs, (length) => this.#saplingWrapper.getRandomBytes(length));\n        }\n\n" + anchor)
        builder.write_text(updated)
        helper = package / 'src/sapling-tx-builder/shuffle-outputs.ts'
        helper.write_text((EXPERIMENT / 'shuffle-outputs.ts').read_text())
        types = package / 'src/types.ts'
        types_original = types.read_text()
        marker = 'export interface SaplingContractDetails {\n'
        assert types_original.count(marker) == 1
        types_updated = types_original.replace(marker, marker + "  /** Preserve caller ordering by default. Randomized mode changes output/history positions. */\n  outputOrder?: 'preserve' | 'randomized';\n")
        types.write_text(types_updated)
        for name, before, after in [('src/sapling-tx-builder/sapling-transactions-builder.ts', original, updated), ('src/types.ts', types_original, types_updated), ('src/sapling-tx-builder/shuffle-outputs.ts', '', helper.read_text())]:
            patches.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='a/packages/taquito-sapling/' + name, tofile='b/packages/taquito-sapling/' + name))
        (EXPERIMENT / 'taquito-output-order.patch').write_text(''.join(patches))
    # Both snapshots use the same installed tools and dependency graph. No installation or source-checkout change.
    subprocess.run([str(TAQUITO / 'node_modules/.bin/tsc'), '--project', 'tsconfig.prod.json', '--module', 'commonjs', '--moduleResolution', 'node', '--ignoreDeprecations', '6.0', '--esModuleInterop'], cwd=package, check=True)
    subprocess.run([str(TAQUITO / 'node_modules/.bin/rollup'), '-c', 'rollup.config.ts', '--bundleConfigAsCjs'], cwd=package, check=True)
    metadata['variants'][variant] = {str(p.relative_to(package)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(package.glob('dist/taquito-sapling.*.js'))}
CACHE.mkdir(parents=True, exist_ok=True)
(CACHE / 'build-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
