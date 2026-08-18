import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MomoIpnDto } from './dto/momo.dto';
import { MomoGatewayService } from './momo-gateway.service';

describe('MomoGatewayService', () => {
  const values: Record<string, string> = {
    MOMO_ENABLED: 'true',
    MOMO_PARTNER_CODE: 'MOMO_TEST',
    MOMO_ACCESS_KEY: 'access-key',
    MOMO_SECRET_KEY: 'secret-key',
    MOMO_REDIRECT_URL: 'http://localhost:3000/customer/payment-result',
    MOMO_IPN_URL: 'https://example.test/api/payments/momo/ipn',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  it('accepts a correctly signed IPN and rejects a tampered amount', () => {
    const gateway = new MomoGatewayService(config);
    const payload: MomoIpnDto = {
      partnerCode: 'MOMO_TEST',
      orderId: 'PAY-123',
      requestId: 'REQ-123',
      amount: 150000,
      orderInfo: 'Elite Drive booking 123',
      orderType: 'momo_wallet',
      transId: 4088878653,
      resultCode: 0,
      message: 'Successful.',
      payType: 'qr',
      responseTime: 1721720663942,
      extraData: '',
      signature: '',
    };

    const rawSignature = [
      'accessKey=access-key',
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
    payload.signature = createHmac('sha256', 'secret-key')
      .update(rawSignature)
      .digest('hex');

    expect(gateway.verifyIpn(payload)).toBe(true);
    expect(gateway.verifyIpn({ ...payload, amount: 150001 })).toBe(false);
  });

  it('rejects a payWithMethod amount below the MoMo minimum before network I/O', async () => {
    const gateway = new MomoGatewayService(config);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      gateway.createCheckout({
        orderId: 'PAY-LOW-AMOUNT',
        requestId: 'REQ-LOW-AMOUNT',
        amount: 999,
        orderInfo: 'Low amount test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
