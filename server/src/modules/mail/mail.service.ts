import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendOtp(email: string, code: string, type: string): Promise<void> {
    this.logger.log(`[LOCAL MAIL] OTP ${type} for ${email}: ${code}`);
  }
}
