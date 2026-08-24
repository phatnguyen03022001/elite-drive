import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main, syncEnv } from '../../server/scripts/sync-env.mjs';

const SECRET = 'CLIENT_FAKE_PRIVATE_VALUE_7c91e';
const clientDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(example, env) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'client-sync-env-'));
  const examplePath = path.join(directory, '.env.example');
  const envPath = path.join(directory, '.env.local');
  await fs.writeFile(examplePath, example);
  if (env !== undefined) await fs.writeFile(envPath, env);
  return { directory, examplePath, envPath };
}

function capture() {
  const output = [];
  return {
    output,
    io: {
      stdout: (message) => output.push(String(message)),
      stderr: (message) => output.push(String(message)),
    },
  };
}

test('syncs the client template into .env.local without copying template defaults', async () => {
  const paths = await fixture(
    'BACKEND_URL=template\nNEXT_PUBLIC_APP_URL=template\nNEXT_PUBLIC_MOMO_ENABLED=false\n',
    `BACKEND_URL=${SECRET}\nNEXT_PUBLIC_APP_URL=${SECRET}\nOLD_CLIENT_KEY=${SECRET}\n`,
  );

  const captured = capture();
  const result = await syncEnv(paths);

  assert.deepEqual(result, { missing: ['NEXT_PUBLIC_MOMO_ENABLED'], extra: ['OLD_CLIENT_KEY'] });
  assert.equal(
    await fs.readFile(paths.envPath, 'utf8'),
    `BACKEND_URL=${SECRET}\nNEXT_PUBLIC_APP_URL=${SECRET}\n# ⚠ MISSING LOCAL VALUE — set before use\nNEXT_PUBLIC_MOMO_ENABLED=\n`,
  );
  assert.ok(!captured.output.join('\n').includes(SECRET));
});

test('CLI preserves exit codes and never logs fake values', async () => {
  const paths = await fixture(`NEXT_PUBLIC_FOO=template\n`, `NEXT_PUBLIC_FOO=${SECRET}\nEXTRA=${SECRET}\n`);
  const check = capture();
  assert.equal(await main(['--check', '--example', paths.examplePath, '--env', paths.envPath], check.io), 1);
  assert.ok(!check.output.join('\n').includes(SECRET));

  const sync = capture();
  assert.equal(await main(['--sync', '--example', paths.examplePath, '--env', paths.envPath], sync.io), 0);
  assert.ok(!sync.output.join('\n').includes(SECRET));

  const afterSync = capture();
  assert.equal(await main(['--check', '--example', paths.examplePath, '--env', paths.envPath], afterSync.io), 0);
  assert.ok(!afterSync.output.join('\n').includes(SECRET));

  const malformed = await fixture('NEXT_PUBLIC_FOO=template\n', `NEXT_PUBLIC_FOO=${SECRET}\nexport BAD=value\n`);
  const error = capture();
  assert.equal(await main(['--sync', '--example', malformed.examplePath, '--env', malformed.envPath], error.io), 2);
  assert.ok(!error.output.join('\n').includes(SECRET));
});

test('client package scripts reuse the server engine and target only .env.local', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(clientDirectory, 'package.json'), 'utf8'));
  for (const scriptName of ['env:check', 'env:sync']) {
    const script = packageJson.scripts[scriptName];
    assert.match(script, /node \.\.\/server\/scripts\/sync-env\.mjs/);
    assert.match(script, /--example \.env\.example/);
    assert.match(script, /--env \.env\.local/);
    assert.doesNotMatch(script, /--env \.env(?:\s|$)/);
  }
});
