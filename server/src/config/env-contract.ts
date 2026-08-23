export const ENV_WARNINGS_KEY = '__ELITE_DRIVE_ENV_WARNINGS';

type EnvRecord = Record<string, unknown>;

interface ConfigReader {
  get<T = unknown>(key: string): T | undefined;
}

interface DiagnosticLogger {
  log(message: string): unknown;
  warn(message: string): unknown;
}

const KNOWN_ENV_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'APP_PORT',
  'APP_NAME',
  'API_PREFIX',
  'FRONTEND_URL',
  'ALLOW_VERCEL_PREVIEWS',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES_IN',
  'OTP_HASH_SECRET',
  'BCRYPT_ROUNDS',
  'PLATFORM_USER_ID',
  'MOCK_PAYMENTS_ENABLED',
  'UPLOAD_DIR',
  'UPLOAD_PUBLIC_BASE_URL',
  'SEED_PASSWORD',
  'CLOUDINARY_ENABLED',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'BREVO_ENABLED',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
  'MOMO_ENABLED',
  'MOMO_BASE_URL',
  'MOMO_PARTNER_CODE',
  'MOMO_ACCESS_KEY',
  'MOMO_SECRET_KEY',
  'MOMO_PARTNER_NAME',
  'MOMO_STORE_ID',
  'MOMO_REDIRECT_URL',
  'MOMO_IPN_URL',
]);

const MANAGED_KEY_PATTERN = /^(?:MOMO_|BREVO_|CLOUD(?:INARY|NARY)_|JWT_|OTP_|UPLOAD_|APP_|FRONTEND_|ALLOW_VERCEL_|MOCK_PAYMENTS_|PLATFORM_USER_|DATABASE_|MAIL_)/;
const BOOLEAN_KEYS = [
  'ALLOW_VERCEL_PREVIEWS',
  'MOCK_PAYMENTS_ENABLED',
  'CLOUDINARY_ENABLED',
  'BREVO_ENABLED',
  'MOMO_ENABLED',
] as const;

const KNOWN_INSECURE_SECRET_VALUES = new Set([
  'replace-with-a-long-random-secret',
  'replace-with-a-separate-long-random-secret',
  'elite-drive-key',
  'refresh-secret-key',
  'changeme',
  'change-me',
  'secret',
  'password',
]);

const PROVIDERS = [
  {
    name: 'Cloudinary',
    enabledKey: 'CLOUDINARY_ENABLED',
    credentialKeys: [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ],
  },
  {
    name: 'Brevo',
    enabledKey: 'BREVO_ENABLED',
    credentialKeys: ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'],
  },
  {
    name: 'MoMo',
    enabledKey: 'MOMO_ENABLED',
    credentialKeys: [
      'MOMO_PARTNER_CODE',
      'MOMO_ACCESS_KEY',
      'MOMO_SECRET_KEY',
      'MOMO_REDIRECT_URL',
      'MOMO_IPN_URL',
    ],
  },
] as const;

function valueOf(env: EnvRecord, key: string): string {
  const value = env[key];
  return typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim();
}

function isEnabled(env: EnvRecord, key: string): boolean {
  return valueOf(env, key).toLowerCase() === 'true';
}

function requireKey(env: EnvRecord, key: string, errors: string[]): void {
  if (!valueOf(env, key)) errors.push(`${key} is required`);
}

function validateUrl(env: EnvRecord, key: string, errors: string[]): void {
  const value = valueOf(env, key);
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${key} must use http:// or https://`);
    }
  } catch {
    errors.push(`${key} must be a valid absolute URL`);
  }
}

export function collectEnvironmentWarnings(env: EnvRecord): string[] {
  const warnings: string[] = [];
  const production = valueOf(env, 'NODE_ENV') === 'production';

  for (const provider of PROVIDERS) {
    if (isEnabled(env, provider.enabledKey)) continue;
    const configuredKeys = provider.credentialKeys.filter((key) =>
      Boolean(valueOf(env, key)),
    );
    if (configuredKeys.length) {
      warnings.push(
        `${provider.name} is disabled but credentials are configured: ${configuredKeys.join(', ')}`,
      );
    }
  }

  if (production && !isEnabled(env, 'CLOUDINARY_ENABLED')) {
    warnings.push(
      'CLOUDINARY_ENABLED=false in production; uploads use ephemeral local filesystem storage',
    );
  }
  if (production && !isEnabled(env, 'BREVO_ENABLED')) {
    warnings.push(
      'BREVO_ENABLED=false in production; OTP email delivery is unavailable',
    );
  }
  if (production && !isEnabled(env, 'MOMO_ENABLED')) {
    warnings.push(
      'MOMO_ENABLED=false in production; external MoMo checkout is disabled',
    );
  }

  if (production) {
    for (const key of ['JWT_SECRET', 'OTP_HASH_SECRET']) {
      const secret = valueOf(env, key);
      if (secret && secret.length < 32) {
        warnings.push(
          `${key} is shorter than the recommended 32 characters; rotate it`,
        );
      }
    }
    const jwtSecret = valueOf(env, 'JWT_SECRET');
    const otpSecret = valueOf(env, 'OTP_HASH_SECRET');
    if (jwtSecret && otpSecret && jwtSecret === otpSecret) {
      warnings.push('JWT_SECRET and OTP_HASH_SECRET should be separate values');
    }
  }

  for (const key of Object.keys(env).sort()) {
    if (KNOWN_ENV_KEYS.has(key) || key === ENV_WARNINGS_KEY) continue;
    if (MANAGED_KEY_PATTERN.test(key)) {
      warnings.push(`Unknown Elite Drive environment key: ${key}`);
    }
  }

  return warnings;
}

export function validateEnvironment(config: EnvRecord): EnvRecord {
  const errors: string[] = [];
  const production = valueOf(config, 'NODE_ENV') === 'production';

  requireKey(config, 'DATABASE_URL', errors);
  requireKey(config, 'JWT_SECRET', errors);
  requireKey(config, 'OTP_HASH_SECRET', errors);

  if (production) {
    requireKey(config, 'FRONTEND_URL', errors);
    requireKey(config, 'PLATFORM_USER_ID', errors);
  }

  for (const key of BOOLEAN_KEYS) {
    const value = valueOf(config, key);
    if (value && value !== 'true' && value !== 'false') {
      errors.push(`${key} must be either true or false`);
    }
  }

  for (const key of ['PORT', 'APP_PORT']) {
    const port = valueOf(config, key);
    if (
      port &&
      (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535)
    ) {
      errors.push(`${key} must be an integer between 1 and 65535`);
    }
  }

  const bcryptRounds = valueOf(config, 'BCRYPT_ROUNDS');
  if (
    bcryptRounds &&
    (!/^\d+$/.test(bcryptRounds) ||
      Number(bcryptRounds) < 4 ||
      Number(bcryptRounds) > 31)
  ) {
    errors.push('BCRYPT_ROUNDS must be an integer between 4 and 31');
  }

  if (production) {
    const platformUserId = valueOf(config, 'PLATFORM_USER_ID');
    if (platformUserId && !/^[a-f0-9]{24}$/i.test(platformUserId)) {
      errors.push('PLATFORM_USER_ID must be a 24-character MongoDB ObjectId');
    }
    for (const key of ['JWT_SECRET', 'OTP_HASH_SECRET']) {
      const secret = valueOf(config, key);
      if (secret && KNOWN_INSECURE_SECRET_VALUES.has(secret)) {
        errors.push(`${key} uses a known insecure placeholder/default value`);
      }
    }
  }

  for (const provider of PROVIDERS) {
    if (!isEnabled(config, provider.enabledKey)) continue;
    for (const key of provider.credentialKeys) requireKey(config, key, errors);
  }

  validateUrl(config, 'FRONTEND_URL', errors);
  if (isEnabled(config, 'MOMO_ENABLED')) {
    validateUrl(config, 'MOMO_BASE_URL', errors);
    validateUrl(config, 'MOMO_REDIRECT_URL', errors);
    validateUrl(config, 'MOMO_IPN_URL', errors);
  }

  if (errors.length) {
    throw new Error(
      `[ENV] Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    ...config,
    [ENV_WARNINGS_KEY]: collectEnvironmentWarnings(config),
  };
}

export function logEnvironmentDiagnostics(
  configService: ConfigReader,
  logger: DiagnosticLogger,
): void {
  const warnings = configService.get<string[]>(ENV_WARNINGS_KEY) ?? [];
  logger.log('[ENV] Environment contract validated');
  for (const warning of warnings) logger.warn(`[ENV] ${warning}`);
}
