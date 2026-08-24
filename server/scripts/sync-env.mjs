import fs from 'node:fs/promises';
import path from 'node:path';

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MISSING_WARNING = '# ⚠ MISSING LOCAL VALUE — set before use';

export class EnvSyncError extends Error {}

function lineEnding(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

function parseLine(line, lineNumber) {
  if (/^\s*$/.test(line)) return { type: 'blank', text: line };
  if (/^\s*#/.test(line)) return { type: 'comment', text: line };

  const separator = line.indexOf('=');
  if (separator < 1) throw new EnvSyncError(`Malformed line ${lineNumber}`);
  const key = line.slice(0, separator);
  if (!KEY_PATTERN.test(key)) throw new EnvSyncError(`Malformed key on line ${lineNumber}`);
  return { type: 'assignment', key, rawValue: line.slice(separator + 1), text: line };
}

export function parseEnv(source) {
  const withoutFinalNewline = source.replace(/(?:\r\n|\n)+$/, '');
  const rawLines = withoutFinalNewline === '' ? [] : withoutFinalNewline.split(/\r\n|\n/);
  const lines = [];
  const entries = [];
  const keys = new Set();

  rawLines.forEach((line, index) => {
    const parsed = parseLine(line, index + 1);
    lines.push(parsed);
    if (parsed.type === 'assignment') {
      if (keys.has(parsed.key)) throw new EnvSyncError(`Duplicate key: ${parsed.key}`);
      keys.add(parsed.key);
      entries.push(parsed);
    }
  });

  return { entries, lines, newline: lineEnding(source) };
}

async function readInput(filePath, kind, allowMissing = false) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (allowMissing && error?.code === 'ENOENT') return '';
    if (error?.code === 'ENOENT') throw new EnvSyncError(`Missing ${kind}`);
    throw new EnvSyncError(`Unable to read ${kind}`);
  }
}

async function loadInputs({ examplePath, envPath }) {
  const exampleSource = await readInput(examplePath, 'template');
  const envSource = await readInput(envPath, 'local env', true);
  let envExists = true;
  try {
    await fs.stat(envPath);
  } catch (error) {
    if (error?.code === 'ENOENT') envExists = false;
    else throw new EnvSyncError('Unable to inspect local env');
  }
  return {
    example: parseEnv(exampleSource),
    env: parseEnv(envSource),
    envSource,
    envExists,
  };
}

function compare(example, env) {
  const templateKeys = new Set(example.entries.map((entry) => entry.key));
  const localKeys = new Set(env.entries.map((entry) => entry.key));
  return {
    missing: example.entries.filter((entry) => !localKeys.has(entry.key)).map((entry) => entry.key),
    extra: env.entries.filter((entry) => !templateKeys.has(entry.key)).map((entry) => entry.key),
  };
}

export async function checkEnv(paths) {
  const { example, env } = await loadInputs(paths);
  return compare(example, env);
}

export function renderEnv(example, env, renderOverride) {
  if (renderOverride) return renderOverride(example, env);
  const localValues = new Map(env.entries.map((entry) => [entry.key, entry.rawValue]));
  const warnedKeys = new Set();
  for (let index = 1; index < env.lines.length; index += 1) {
    const line = env.lines[index];
    if (line.type === 'assignment' && line.rawValue === '' && env.lines[index - 1].text === MISSING_WARNING) warnedKeys.add(line.key);
  }
  const output = [];
  for (const line of example.lines) {
    if (line.type === 'assignment') {
      if (!localValues.has(line.key) || warnedKeys.has(line.key)) output.push(MISSING_WARNING);
      output.push(`${line.key}=${localValues.get(line.key) ?? ''}`);
    } else {
      output.push(line.text);
    }
  }
  while (output.at(-1) === '') output.pop();
  return output.join(example.newline) + example.newline;
}

async function writeAtomically(envPath, output, mode) {
  const directory = path.dirname(envPath);
  const temporaryPath = path.join(directory, `.${path.basename(envPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    const handle = await fs.open(temporaryPath, 'wx', mode);
    try {
      await handle.writeFile(output, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.chmod(temporaryPath, mode);
    await fs.rename(temporaryPath, envPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    if (error instanceof EnvSyncError) throw error;
    throw new EnvSyncError('Unable to write local env');
  }
}

export async function syncEnv(paths) {
  const { example, env, envExists } = await loadInputs(paths);
  const comparison = compare(example, env);
  const output = renderEnv(example, env, paths.render);
  let mode = 0o600;
  if (envExists) {
    try {
      mode = (await fs.stat(paths.envPath)).mode & 0o777;
    } catch {
      throw new EnvSyncError('Unable to inspect local env');
    }
  }
  await writeAtomically(paths.envPath, output, mode);
  return comparison;
}

function parseArguments(args) {
  const mode = args.includes('--check') ? 'check' : args.includes('--sync') ? 'sync' : null;
  if (!mode) throw new EnvSyncError('Use --check or --sync');
  const valueAfter = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  return {
    mode,
    examplePath: valueAfter('--example', path.resolve('.env.example')),
    envPath: valueAfter('--env', path.resolve('.env')),
  };
}

function printKeys(io, label, keys) {
  if (keys.length > 0) io.stdout(`${label}:\n${keys.map((key) => `  ${key}`).join('\n')}`);
}

export async function main(args = process.argv.slice(2), io = { stdout: console.log, stderr: console.error }) {
  try {
    const options = parseArguments(args);
    const result = options.mode === 'check'
      ? await checkEnv(options)
      : await syncEnv(options);
    printKeys(io, 'Missing', result.missing);
    printKeys(io, options.mode === 'sync' ? 'Removed' : 'Extra', result.extra);
    const drift = result.missing.length > 0 || result.extra.length > 0;
    if (options.mode === 'check') {
      if (!drift) io.stdout('Environment is structurally synchronized.');
      return drift ? 1 : 0;
    }
    io.stdout('Environment synchronized.');
    return 0;
  } catch (error) {
    io.stderr(error instanceof EnvSyncError ? error.message : 'Environment operation failed');
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
