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

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
  });

  it('signs a full MoMo refund using the provider field order', async () => {
    const gateway = new MomoGatewayService(config);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          partnerCode: 'MOMO_TEST',
          orderId: 'RF-payment-1',
          requestId: 'RFR-payment-1',
          amount: 150000,
          transId: 999,
          resultCode: 0,
          message: 'Successful.',
          responseTime: 1721720663942,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await gateway.refund({
      orderId: 'RF-payment-1',
      requestId: 'RFR-payment-1',
      amount: 150000,
      transId: 4088878653,
      description: ' customer request ',
    });

    const request = fetchSpy.mock.calls[0];
    expect(String(request[0])).toBe('https://test-payment.momo.vn/v2/gateway/api/refund');
    const body = JSON.parse(String((request[1] as RequestInit).body)) as Record<string, unknown>;
    const rawSignature = [
      'accessKey=access-key',
      'amount=150000',
      'description=customer request',
      'orderId=RF-payment-1',
      'partnerCode=MOMO_TEST',
      'requestId=RFR-payment-1',
      'transId=4088878653',
    ].join('&');
    const signature = createHmac('sha256', 'secret-key')
      .update(rawSignature)
      .digest('hex');

    expect(body).toMatchObject({
      partnerCode: 'MOMO_TEST',
      orderId: 'RF-payment-1',
      requestId: 'RFR-payment-1',
      amount: 150000,
      transId: 4088878653,
      description: 'customer request',
      signature,
    });
  });

  it('signs refund status queries deterministically for retry recovery', async () => {
    const gateway = new MomoGatewayService(config);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          partnerCode: 'MOMO_TEST',
          orderId: 'RF-payment-1',
          requestId: 'RFR-payment-1',
          resultCode: 0,
          message: 'Successful.',
          responseTime: 1721720663942,
          refundTrans: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await gateway.queryRefund('RF-payment-1', 'RFR-payment-1');

    const body = JSON.parse(
      String((fetchSpy.mock.calls[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    const rawSignature = [
      'accessKey=access-key',
      'orderId=RF-payment-1',
      'partnerCode=MOMO_TEST',
      'requestId=RFR-payment-1',
    ].join('&');
    expect(body.signature).toBe(
      createHmac('sha256', 'secret-key').update(rawSignature).digest('hex'),
    );
  });
});
