import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const currentLock = resolve('package-lock.json');
const temp = mkdtempSync(join(tmpdir(), 'elite-client-lock-'));
const generatedLock = join(temp, 'package-lock.json');
copyFileSync(currentLock, generatedLock);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.dependencies.next = '16.3.1';
pkg.devDependencies['eslint-config-next'] = '16.3.1';
writeFileSync(join(temp, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

execFileSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['install', '--package-lock-only', '--ignore-scripts', '--no-fund', '--no-audit'],
  { cwd: temp, stdio: 'inherit' },
);

spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', 'fix', '--package-lock-only', '--ignore-scripts', '--no-fund'],
  { cwd: temp, stdio: 'inherit' },
);

const audit = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', '--omit=dev', '--json'],
  { cwd: temp, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);
try {
  const parsed = JSON.parse(audit.stdout || '{}');
  const counts = parsed?.metadata?.vulnerabilities ?? {};
  console.log(
    `SECURE_LOCK_AUDIT critical=${counts.critical ?? '?'} high=${counts.high ?? '?'} moderate=${counts.moderate ?? '?'} low=${counts.low ?? '?'}`,
  );
} catch {
  console.error('SECURE_LOCK_AUDIT parse failed');
  process.exit(2);
}

const secureLock = readFileSync(generatedLock);
const encoded = gzipSync(secureLock).toString('base64');
console.log(`SECURE_LOCK_JSON_BYTES=${secureLock.length}`);
console.log(`SECURE_LOCK_GZIP_BASE64_BYTES=${Buffer.byteLength(encoded)}`);
console.log('SECURE_LOCK_GZIP_BASE64_BEGIN');
for (let offset = 0; offset < encoded.length; offset += 4000) {
  console.log(encoded.slice(offset, offset + 4000));
}
console.log('SECURE_LOCK_GZIP_BASE64_END');
