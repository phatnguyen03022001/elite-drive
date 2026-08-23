import {
  ENV_WARNINGS_KEY,
  collectEnvironmentWarnings,
  logEnvironmentDiagnostics,
  validateEnvironment,
} from './env-contract';

const validProduction = () => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'mongodb://localhost:27017/elitedrive',
  JWT_SECRET: 'a-production-jwt-secret-that-is-not-a-placeholder',
  OTP_HASH_SECRET: 'a-production-otp-secret-that-is-not-a-placeholder',
  FRONTEND_URL: 'https://elite-drive-iota.vercel.app',
  PLATFORM_USER_ID: '000000000000000000000001',
  CLOUDINARY_ENABLED: 'false',
  BREVO_ENABLED: 'false',
  MOMO_ENABLED: 'false',
});

describe('environment contract', () => {
  it('fails production startup when a required core key is missing', () => {
    const env = validProduction();
    delete (env as Partial<typeof env>).JWT_SECRET;

    expect(() => validateEnvironment(env)).toThrow('JWT_SECRET is required');
  });

  it('rejects known production placeholder secrets without echoing the value', () => {
    const env = {
      ...validProduction(),
      JWT_SECRET: 'replace-with-a-long-random-secret',
    };

    expect(() => validateEnvironment(env)).toThrow(
      'JWT_SECRET uses a known insecure placeholder/default value',
    );
    try {
      validateEnvironment(env);
    } catch (error) {
      expect(String(error)).not.toContain(env.JWT_SECRET);
    }
  });

  it.each<[string, Record<string, string>, string]>([
    ['Cloudinary', { CLOUDINARY_ENABLED: 'true' }, 'CLOUDINARY_CLOUD_NAME'],
    ['Brevo', { BREVO_ENABLED: 'true' }, 'BREVO_API_KEY'],
    ['MoMo', { MOMO_ENABLED: 'true' }, 'MOMO_PARTNER_CODE'],
  ])('fails when %s is enabled without required configuration', (_name, override, missingKey) => {
    expect(() => validateEnvironment({ ...validProduction(), ...override })).toThrow(
      `${missingKey} is required`,
    );
  });

  it('warns when disabled provider credentials are present', () => {
    const warnings = collectEnvironmentWarnings({
      ...validProduction(),
      CLOUDINARY_API_KEY: 'configured-secret-value',
    });

    expect(warnings).toContain(
      'Cloudinary is disabled but credentials are configured: CLOUDINARY_API_KEY',
    );
    expect(warnings.join(' ')).not.toContain('configured-secret-value');
  });

  it('warns about likely typo app keys but ignores platform variables', () => {
    const warnings = collectEnvironmentWarnings({
      ...validProduction(),
      CLOUDNARY_API_KEY: 'typo',
      MAIL_TRANSPORT: 'console',
      K_SERVICE: 'elite-drive-api',
      PATH: '/usr/bin',
      HOME: '/workspace',
    });

    expect(warnings).toContain('Unknown Elite Drive environment key: CLOUDNARY_API_KEY');
    expect(warnings).toContain('Unknown Elite Drive environment key: MAIL_TRANSPORT');
    expect(warnings.some((warning) => warning.includes('K_SERVICE'))).toBe(false);
    expect(warnings.some((warning) => warning.includes('PATH'))).toBe(false);
  });

  it('warns about weak secret length without logging the secret value', () => {
    const env = {
      ...validProduction(),
      JWT_SECRET: 'short-secret',
    };

    const warnings = collectEnvironmentWarnings(env);

    expect(warnings).toContain(
      'JWT_SECRET is shorter than the recommended 32 characters; rotate it',
    );
    expect(warnings.join(' ')).not.toContain('short-secret');
  });

  it('rejects an invalid production platform user id before startup', () => {
    expect(() =>
      validateEnvironment({ ...validProduction(), PLATFORM_USER_ID: 'atlas-project-id' }),
    ).toThrow('PLATFORM_USER_ID must be a 24-character MongoDB ObjectId');
  });

  it('stores safe startup warnings for ConfigService diagnostics', () => {
    const validated = validateEnvironment(validProduction());
    const logger = { log: jest.fn(), warn: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => validated[key]),
    };

    logEnvironmentDiagnostics(configService as never, logger);

    expect(configService.get).toHaveBeenCalledWith(ENV_WARNINGS_KEY);
    expect(logger.log).toHaveBeenCalledWith('[ENV] Environment contract validated');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('BREVO_ENABLED=false in production'),
    );
  });
});
