import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const source = await readFile(new URL('./pool-session.mjs', import.meta.url), 'utf8');
const scratch = await mkdtemp(join(tmpdir(), 'sapling-session-check-'));
try {
  await copyFile(
    new URL('./check-pool-session.mjs', import.meta.url),
    join(scratch, 'check-pool-session.mjs'),
  );
  const variants = [
    ['baseline', source, true],
    [
      'lost confirmed receipt',
      source.replace(
        'return { ...result, snapshot: null, version, uncertain, warning: String(error) };',
        'throw error;',
      ),
      false,
    ],
    ['missing busy guard', source.replace("if (busy) throw new Error('POOL_BUSY');", ''), false],
    ['missing stale guard', source.replace('input.version !== version', 'false'), false],
    [
      'missing uncertain guard',
      source.replace("if (uncertain) throw new Error('POOL_OUTCOME_UNKNOWN');", ''),
      false,
    ],
    [
      'version moves on rejection',
      source.replace('if (result.accepted) version++;', 'version++;'),
      false,
    ],
  ];
  for (const [name, code, expected] of variants) {
    if (!expected && code === source) throw new Error('Mutation did not match source: ' + name);
    await writeFile(join(scratch, 'pool-session.mjs'), code);
    let passed = true;
    try {
      const output = execFileSync(process.execPath, [join(scratch, 'check-pool-session.mjs')], {
        encoding: 'utf8',
        timeout: 10_000,
        stdio: 'pipe',
      });
      if (expected) console.log(output.trim());
    } catch {
      passed = false;
    }
    if (passed !== expected) throw new Error('Unexpected verification result: ' + name);
    console.log(name + ': ' + (passed ? 'passed' : 'broken variant detected'));
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
