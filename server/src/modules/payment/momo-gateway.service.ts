import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { MomoIpnDto } from './dto/momo.dto';

interface CreateCheckoutInput {
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  returnReference?: string;
  extraData?: Record<string, string>;
}

interface MomoCreateResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl?: string;
  shortLink?: string;
}

interface MomoQueryResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount?: number;
  transId?: number;
  resultCode: number;
  message: string;
  responseTime: number;
  payType?: string;
}

@Injectable()
export class MomoGatewayService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('MOMO_ENABLED') === 'true';
    this.baseUrl = (
      this.config.get<string>('MOMO_BASE_URL') ?? 'https://test-payment.momo.vn'
    ).replace(/\/$/, '');
  }

  isEnabled() {
    return this.enabled;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<MomoCreateResponse> {
    this.assertEnabled();
    const partnerCode = this.required('MOMO_PARTNER_CODE');
    const accessKey = this.required('MOMO_ACCESS_KEY');
    const redirectUrl = this.buildRedirectUrl(input.returnReference);
    const ipnUrl = this.required('MOMO_IPN_URL');
    const requestType = 'payWithMethod';
    const extraData = input.extraData
      ? Buffer.from(JSON.stringify(input.extraData), 'utf8').toString('base64')
      : '';
    const amount = this.toVndInteger(input.amount);

    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${ipnUrl}`,
      `orderId=${input.orderId}`,
      `orderInfo=${input.orderInfo}`,
      `partnerCode=${partnerCode}`,
      `redirectUrl=${redirectUrl}`,
      `requestId=${input.requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    const payload = {
      partnerCode,
      partnerName: this.config.get<string>('MOMO_PARTNER_NAME') ?? 'Elite Drive',
      storeId: this.config.get<string>('MOMO_STORE_ID') ?? 'EliteDrive',
      requestType,
      ipnUrl,
      redirectUrl,
      orderId: input.orderId,
      amount,
      lang: 'vi',
      orderInfo: input.orderInfo,
      requestId: input.requestId,
      extraData,
      autoCapture: true,
      signature: this.sign(rawSignature),
    };

    const response = await this.post<MomoCreateResponse>(
      '/v2/gateway/api/create',
      payload,
    );
    if (response.resultCode !== 0 || !response.payUrl) {
      throw new BadGatewayException(
        `MoMo từ chối tạo giao dịch: ${response.message || response.resultCode}`,
      );
    }
    if (
      response.partnerCode !== partnerCode ||
      response.orderId !== input.orderId ||
      response.requestId !== input.requestId ||
      Number(response.amount) !== amount
    ) {
      throw new BadGatewayException('MoMo trả về dữ liệu giao dịch không khớp');
    }

    return response;
  }

  async queryStatus(orderId: string, requestId: string): Promise<MomoQueryResponse> {
    this.assertEnabled();
    const partnerCode = this.required('MOMO_PARTNER_CODE');
    const accessKey = this.required('MOMO_ACCESS_KEY');
    const rawSignature = [
      `accessKey=${accessKey}`,
      `orderId=${orderId}`,
      `partnerCode=${partnerCode}`,
      `requestId=${requestId}`,
    ].join('&');

    const response = await this.post<MomoQueryResponse>(
      '/v2/gateway/api/query',
      {
        partnerCode,
        requestId,
        orderId,
        lang: 'vi',
        signature: this.sign(rawSignature),
      },
    );

    if (response.partnerCode !== partnerCode || response.orderId !== orderId) {
      throw new BadGatewayException('MoMo trả về trạng thái không khớp giao dịch');
    }
    return response;
  }

  verifyIpn(payload: MomoIpnDto): boolean {
    this.assertEnabled();
    if (payload.partnerCode !== this.required('MOMO_PARTNER_CODE')) return false;

    const accessKey = this.required('MOMO_ACCESS_KEY');
    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${payload.amount}`,
      `extraData=${payload.extraData}`,
      `message=${payload.message}`,
      `orderId=${payload.orderId}`,
      `orderInfo=${payload.orderInfo}`,
      `orderType=${payload.orderType}`,
      `partnerCode=${payload.partnerCode}`,
      `payType=${payload.payType}`,
      `requestId=${payload.requestId}`,
      `responseTime=${payload.responseTime}`,
      `resultCode=${payload.resultCode}`,
      `transId=${payload.transId}`,
    ].join('&');

    const expected = Buffer.from(this.sign(rawSignature), 'hex');
    const actual = Buffer.from(payload.signature, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private buildRedirectUrl(returnReference?: string) {
    const configured = this.required('MOMO_REDIRECT_URL');
    if (!returnReference) return configured;

    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new ServiceUnavailableException('MOMO_REDIRECT_URL không hợp lệ');
    }
    url.searchParams.set('paymentId', returnReference);
    return url.toString();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35_000),
      });

      if (!response.ok) {
        throw new BadGatewayException(`MoMo HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `Không thể kết nối MoMo: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private sign(rawSignature: string): string {
    return createHmac('sha256', this.required('MOMO_SECRET_KEY'))
      .update(rawSignature)
      .digest('hex');
  }

  private toVndInteger(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền MoMo phải là số nguyên VND dương');
    }
    return amount;
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(`Thiếu cấu hình ${key}`);
    }
    return value;
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('MoMo sandbox chưa được bật');
    }
  }
}
