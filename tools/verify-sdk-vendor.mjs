import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const spec = app.dependencies['@taquito/sapling'];
assert.ok(spec.startsWith('file:vendor/'));
const manifest = JSON.parse(
  readFileSync(join(dirname(resolve(root, spec.slice(5))), 'manifest.json'), 'utf8'),
);
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const record of Object.values(manifest.packages))
  assert.equal(hash(resolve(root, record.file)), record.sha256, record.file);
const pending = Object.keys(app.dependencies)
  .filter((name) => manifest.packages[name])
  .map((name) => [root, name]);
const seen = new Set();
const names = new Set();
while (pending.length) {
  const [from, name] = pending.pop();
  const require = createRequire(join(from, 'package.json'));
  let directory = dirname(realpathSync(require.resolve(name)));
  while (
    !existsSync(join(directory, 'package.json')) ||
    JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).name !== name
  ) {
    const parent = dirname(directory);
    assert.notEqual(parent, directory, 'Package root missing: ' + name);
    directory = parent;
  }
  if (seen.has(directory)) continue;
  seen.add(directory);
  names.add(name);
  const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const record = manifest.packages[name];
  assert.equal(metadata.version, record.version, name);
  for (const [file, expected] of Object.entries(record.files))
    assert.equal(hash(join(directory, file)), expected, name + '/' + file);
  for (const dependency of Object.keys(metadata.dependencies ?? {})) {
    if (manifest.packages[dependency]) pending.push([directory, dependency]);
    else if (dependency.startsWith('@taquito/')) {
      assert.equal(dependency, '@taquito/sapling-wasm', 'Unexpected external SDK package');
      assert.equal(metadata.dependencies[dependency], '0.3.0');
      const wasm = createRequire(join(directory, 'package.json'));
      assert.ok(wasm.resolve(dependency));
    }
  }
}
assert.deepEqual(
  [...names].sort((a, b) => a.localeCompare(b)),
  Object.keys(manifest.packages).sort((a, b) => a.localeCompare(b)),
);
console.log('Verified ' + names.size + ' coherent Taquito packages at ' + manifest.revision + '.');
