import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', '--omit=dev', '--json'],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  console.error('Unable to parse npm audit JSON.');
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(2);
}

if (!report?.metadata?.vulnerabilities || !report?.vulnerabilities) {
  console.error('npm audit did not return the expected report shape.');
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(2);
}

const counts = report.metadata.vulnerabilities;
const important = Object.entries(report.vulnerabilities)
  .filter(([, value]) => value && ['high', 'critical'].includes(value.severity))
  .map(([name, value]) => ({
    name,
    severity: value.severity,
    direct: Boolean(value.isDirect),
    via: Array.isArray(value.via)
      ? value.via.map((item) => (typeof item === 'string' ? item : item.title)).slice(0, 4)
      : [],
    fixAvailable:
      value.fixAvailable === true
        ? 'yes'
        : value.fixAvailable && typeof value.fixAvailable === 'object'
          ? `${value.fixAvailable.name}@${value.fixAvailable.version}${value.fixAvailable.isSemVerMajor ? ' (major)' : ''}`
          : 'no',
  }))
  .sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    if (a.direct !== b.direct) return a.direct ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

console.log(
  `Production dependency audit: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low.`,
);
for (const item of important) {
  console.log(
    `[${item.severity.toUpperCase()}] ${item.name} direct=${item.direct} fix=${item.fixAvailable}${item.via.length ? ` via=${item.via.join(' | ')}` : ''}`,
  );
}

process.exit(0);
