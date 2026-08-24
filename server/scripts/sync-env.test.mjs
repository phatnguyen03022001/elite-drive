import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkEnv,
  main,
  parseEnv,
  renderEnv,
  syncEnv,
} from './sync-env.mjs';

const SECRET = 'SUPER_PRIVATE_TEST_VALUE_9f82d';

async function fixture(example, env = undefined) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-env-'));
  const examplePath = path.join(directory, '.env.example');
  const envPath = path.join(directory, '.env');
  await fs.writeFile(examplePath, example);
  if (env !== undefined) await fs.writeFile(envPath, env, { mode: 0o640 });
  return { directory, examplePath, envPath };
}

async function read(pathname) {
  return fs.readFile(pathname, 'utf8');
}

function capture() {
  const output = [];
  return { output, io: { stdout: (message) => output.push(String(message)), stderr: (message) => output.push(String(message)) } };
}

test('check reports structurally synchronized env', async () => {
  const paths = await fixture('# Database\nDATABASE_URL=template\n', 'DATABASE_URL=local\n');
  assert.deepEqual(await checkEnv(paths), { missing: [], extra: [] });
});

test('check reports missing and extra names without values', async () => {
  const paths = await fixture('A=template\nB=\n', `A=${SECRET}\nOLD=${SECRET}\n`);
  const result = await checkEnv(paths);
  assert.deepEqual(result, { missing: ['B'], extra: ['OLD'] });
  const captured = capture();
  assert.equal(await main(['--check', '--example', paths.examplePath, '--env', paths.envPath], captured.io), 1);
  assert.ok(captured.output.join('\n').includes('B'));
  assert.ok(captured.output.join('\n').includes('OLD'));
  assert.ok(!captured.output.join('\n').includes(SECRET));
});

test('CLI exit contract distinguishes check drift from successful sync', async () => {
  const paths = await fixture('A=template\nB=template-default\n', `A="${SECRET}"\nEXTRA=${SECRET}\n`);
  const checkOutput = capture();
  assert.equal(await main(['--check', '--example', paths.examplePath, '--env', paths.envPath], checkOutput.io), 1);
  assert.ok(!checkOutput.output.join('\n').includes(SECRET));

  const syncOutput = capture();
  assert.equal(await main(['--sync', '--example', paths.examplePath, '--env', paths.envPath], syncOutput.io), 0);
  assert.match(syncOutput.output.join('\n'), /Environment synchronized\./);
  assert.ok(!syncOutput.output.join('\n').includes(SECRET));
  assert.equal(await read(paths.envPath), `A="${SECRET}"\n# ⚠ MISSING LOCAL VALUE — set before use\nB=\n`);

  const malformed = await fixture('A=template\n', `A=${SECRET}\nexport B=bad\n`);
  const errorOutput = capture();
  assert.equal(await main(['--sync', '--example', malformed.examplePath, '--env', malformed.envPath], errorOutput.io), 2);
  assert.ok(!errorOutput.output.join('\n').includes(SECRET));
});

test('sync removes extra keys and adds missing keys empty with warnings', async () => {
  const paths = await fixture('# First\nA=template\n\n# Second\nB=default\n', `A=${SECRET}\nOLD=removed\n`);
  const result = await syncEnv(paths);
  assert.deepEqual(result, { missing: ['B'], extra: ['OLD'] });
  assert.equal(await read(paths.envPath), `# First\nA=${SECRET}\n\n# Second\n# ⚠ MISSING LOCAL VALUE — set before use\nB=\n`);
});

test('sync preserves raw values containing spaces, hashes, equals, and quotes', async () => {
  const paths = await fixture('A=template\nB=\n', `A="${SECRET} # == xyz"\nB='quoted value'\n`);
  await syncEnv(paths);
  assert.equal(await read(paths.envPath), `A="${SECRET} # == xyz"\nB='quoted value'\n`);
});

test('sync follows template comments and ordering, ignoring commented assignments', async () => {
  const paths = await fixture('# Header\n# PORT=8000\nZ=one\n\n# Tail\nA=two\n', 'A=local-a\nZ=local-z\n');
  await syncEnv(paths);
  assert.equal(await read(paths.envPath), '# Header\n# PORT=8000\nZ=local-z\n\n# Tail\nA=local-a\n');
  assert.deepEqual(parseEnv('# PORT=8000\n'), { entries: [], lines: [{ type: 'comment', text: '# PORT=8000' }], newline: '\n' });
});

test('duplicate template key fails before writing', async () => {
  const paths = await fixture('A=one\nA=two\n', 'ORIGINAL=keep\n');
  await assert.rejects(() => syncEnv(paths), /Duplicate key: A/);
  assert.equal(await read(paths.envPath), 'ORIGINAL=keep\n');
});

test('duplicate env key fails before writing', async () => {
  const paths = await fixture('A=one\n', 'A=first\nA=second\n');
  await assert.rejects(() => syncEnv(paths), /Duplicate key: A/);
  assert.equal(await read(paths.envPath), 'A=first\nA=second\n');
});

test('malformed or unsupported lines fail before writing', async () => {
  const paths = await fixture('A=one\n', 'A=keep\nexport B=bad\n');
  await assert.rejects(() => syncEnv(paths), /Unsupported|Malformed/);
  assert.equal(await read(paths.envPath), 'A=keep\nexport B=bad\n');
});

test('missing env check does not create and sync creates all keys empty with mode 0600', async () => {
  const paths = await fixture('A=template\nB=\n');
  assert.deepEqual(await checkEnv(paths), { missing: ['A', 'B'], extra: [] });
  assert.equal(fsSync.existsSync(paths.envPath), false);
  await syncEnv(paths);
  assert.equal(await read(paths.envPath), '# ⚠ MISSING LOCAL VALUE — set before use\nA=\n# ⚠ MISSING LOCAL VALUE — set before use\nB=\n');
  if (process.platform !== 'win32') assert.equal((await fs.stat(paths.envPath)).mode & 0o777, 0o600);
});

test('existing env mode is preserved', async () => {
  const paths = await fixture('A=template\n', 'A=local\n');
  if (process.platform === 'win32') return;
  await fs.chmod(paths.envPath, 0o640);
  await syncEnv(paths);
  assert.equal((await fs.stat(paths.envPath)).mode & 0o777, 0o640);
});

test('existing empty env mode is preserved', async () => {
  const paths = await fixture('A=template\n', '');
  if (process.platform === 'win32') return;
  await fs.chmod(paths.envPath, 0o640);
  await syncEnv(paths);
  assert.equal((await fs.stat(paths.envPath)).mode & 0o777, 0o640);
});

test('render failure leaves original target untouched', async () => {
  const paths = await fixture('A=template\n', 'A=original\n');
  await assert.rejects(() => syncEnv({ ...paths, render: () => { throw new Error('simulated render failure'); } }), /simulated render failure/);
  assert.equal(await read(paths.envPath), 'A=original\n');
});

test('sync is idempotent and does not create a backup', async () => {
  const paths = await fixture('# A\nA=template\nB=\n', `A=${SECRET}\n`);
  await syncEnv(paths);
  const first = await read(paths.envPath);
  await syncEnv(paths);
  assert.equal(await read(paths.envPath), first);
  assert.deepEqual((await fs.readdir(paths.directory)).sort(), ['.env', '.env.example']);
});

test('CLI never leaks values on check, sync, or error paths', async () => {
  const paths = await fixture('A=template\n', `A="${SECRET}"\nEXTRA=${SECRET}\n`);
  for (const args of [
    ['--check', '--example', paths.examplePath, '--env', paths.envPath],
    ['--sync', '--example', paths.examplePath, '--env', paths.envPath],
  ]) {
    const captured = capture();
    await main(args, captured.io);
    assert.ok(!captured.output.join('\n').includes(SECRET));
  }
  const bad = await fixture('A=one\nA=two\n', `A=${SECRET}\n`);
  const captured = capture();
  assert.equal(await main(['--sync', '--example', bad.examplePath, '--env', bad.envPath], captured.io), 2);
  assert.ok(!captured.output.join('\n').includes(SECRET));
});

test('missing template fails closed without creating env', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-env-'));
  const envPath = path.join(directory, '.env');
  await assert.rejects(() => syncEnv({ examplePath: path.join(directory, '.env.example'), envPath }), /Missing template/);
  assert.equal(fsSync.existsSync(envPath), false);
});
