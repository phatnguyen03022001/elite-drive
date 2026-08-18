export interface TrustedOriginsConfig {
  exactOrigins: ReadonlySet<string>;
  allowVercelPreviews: boolean;
}

function normalizeOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildTrustedOrigins(
  frontendUrl?: string,
  allowVercelPreviews = false,
): TrustedOriginsConfig {
  const exactOrigins = new Set<string>([
    'https://elite-drive-iota.vercel.app',
    'http://localhost:3000',
  ]);

  const configuredOrigin = normalizeOrigin(frontendUrl);
  if (configuredOrigin) exactOrigins.add(configuredOrigin);

  return { exactOrigins, allowVercelPreviews };
}

export function isTrustedFrontendOrigin(
  origin: string,
  config: TrustedOriginsConfig,
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  if (config.exactOrigins.has(normalizedOrigin)) return true;
  if (!config.allowVercelPreviews) return false;

  const url = new URL(normalizedOrigin);
  return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
}
