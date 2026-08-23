import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(email: string, code: string, type: string): Promise<void> {
    const brevoEnabled =
      this.configService.get<string>('BREVO_ENABLED') === 'true';

    if (!brevoEnabled) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'OTP email delivery is unavailable because Brevo is disabled',
        );
      }
      this.logger.log(`[LOCAL MAIL] OTP ${type} for ${email}: ${code}`);
      return;
    }

    const apiKey = this.configService.getOrThrow<string>('BREVO_API_KEY');
    const senderEmail =
      this.configService.getOrThrow<string>('BREVO_SENDER_EMAIL');
    const senderName =
      this.configService.get<string>('BREVO_SENDER_NAME') || 'Elite Drive';

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject: 'Elite Drive verification code',
          textContent: `Your Elite Drive ${type} verification code is ${code}.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Brevo HTTP ${response.status}`);
      }
    } catch {
      throw new ServiceUnavailableException(
        'Không thể gửi email OTP lúc này',
      );
    }
  }
}
