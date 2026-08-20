import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private brevo?: BrevoClient;
  private transport: 'console' | 'brevo' = 'console';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const configured = this.configService.get<string>('MAIL_TRANSPORT')?.toLowerCase();
    this.transport = configured === 'brevo' ? 'brevo' : 'console';

    if (this.transport === 'brevo') {
      const apiKey = this.configService.get<string>('BREVO_API_KEY');
      if (!apiKey) {
        throw new Error('BREVO_API_KEY is required when MAIL_TRANSPORT=brevo');
      }

      this.brevo = new BrevoClient({
        apiKey,
        timeoutInSeconds: 30,
        maxRetries: 3,
      });
      this.logger.log('Mail transport: Brevo');
      return;
    }

    this.logger.warn('Mail transport: console (no external paid service required)');
  }

  async sendOtp(email: string, code: string, type: string): Promise<void> {
    if (this.transport === 'console') {
      this.logger.log(`[DEV MAIL] OTP ${type} for ${email}: ${code}`);
      return;
    }

    const sender = {
      name: this.configService.get<string>('EMAIL_FROM_NAME') || 'Elite Drive',
      email: this.configService.get<string>('EMAIL_FROM') || 'no-reply@example.com',
    };

    const payload = {
      sender,
      to: [{ email }],
      subject: `Elite Drive – Mã OTP (${type})`,
      htmlContent: `<p>Mã OTP của bạn là <strong>${code}</strong>. Mã có hiệu lực trong 5 phút.</p>`,
      textContent: `Elite Drive - Mã OTP (${type}): ${code}. Hiệu lực 5 phút.`,
      tags: ['otp', type.toLowerCase().replace(/\s+/g, '-')],
    };

    try {
      await this.brevo!.transactionalEmails.sendTransacEmail(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(`Gửi OTP thất bại cho ${email}: ${message}`);
      throw error;
    }
  }
}
