import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service';

function createService(values: Record<string, string | undefined>) {
  const configService = {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`missing ${key}`);
      return value;
    }),
  };
  return new MailService(configService as never);
}

describe('MailService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs the OTP only for the local development fallback', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = createService({ NODE_ENV: 'development', BREVO_ENABLED: 'false' });

    await service.sendOtp('customer@example.com', '123456', 'register');

    expect(log).toHaveBeenCalledWith(
      '[LOCAL MAIL] OTP register for customer@example.com: 123456',
    );
  });

  it('sends transactional OTP email through Brevo when enabled', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 201 } as Response);
    const service = createService({
      NODE_ENV: 'production',
      BREVO_ENABLED: 'true',
      BREVO_API_KEY: 'brevo-test-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
      BREVO_SENDER_NAME: 'Elite Drive',
    });

    await service.sendOtp('customer@example.com', '654321', 'login');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'brevo-test-key' }),
      }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        sender: { name: 'Elite Drive', email: 'no-reply@example.com' },
        to: [{ email: 'customer@example.com' }],
        subject: 'Elite Drive verification code',
        textContent: expect.stringContaining('654321'),
      }),
    );
  });

  it('rejects when Brevo does not accept the message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
    const service = createService({
      NODE_ENV: 'production',
      BREVO_ENABLED: 'true',
      BREVO_API_KEY: 'bad-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
    });

    await expect(
      service.sendOtp('customer@example.com', '123456', 'login'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never logs an OTP in production when Brevo is disabled', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = createService({ NODE_ENV: 'production', BREVO_ENABLED: 'false' });

    await expect(
      service.sendOtp('customer@example.com', '123456', 'login'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('123456'));
  });
});
