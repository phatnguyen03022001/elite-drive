import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoIpnDto } from './dto/momo.dto';
import { MomoGatewayService } from './momo-gateway.service';
import { PaymentService } from './payment.service';

describe('PaymentService MoMo invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  const payload: MomoIpnDto = {
    partnerCode: 'MOMO_TEST',
    orderId: 'PAY-ORDER-1',
    requestId: 'REQ-payment-1',
    amount: 150000,
    orderInfo: 'Elite Drive booking booking-1',
    orderType: 'momo_wallet',
    transId: 4088878653,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1721720663942,
    extraData: '',
    signature: 'a'.repeat(64),
  };

  it('rejects an IPN when signature verification fails before reading payment state', async () => {
    const db = {
      payment: { findFirst: jest.fn() },
    } as unknown as PrismaService;
    const momo = {
      verifyIpn: jest.fn().mockReturnValue(false),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    await expect(service.handleMomoIpn(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(
      (db as unknown as { payment: { findFirst: jest.Mock } }).payment.findFirst,
    ).not.toHaveBeenCalled();
  });

  it('rejects a validly signed IPN whose request id was not issued for the payment', async () => {
    const db = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment-1',
          transactionId: 'PAY-ORDER-1',
          amount: 150000,
          status: PaymentStatus.PENDING,
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const momo = {
      verifyIpn: jest.fn().mockReturnValue(true),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    await expect(
      service.handleMomoIpn({ ...payload, requestId: 'REQ-attacker-or-stale' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (db as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('rejects a successful provider query when the amount differs from local payment', async () => {
    const db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          userId: 'customer-1',
          transactionId: 'PAY-ORDER-1',
          amount: 150000,
          status: PaymentStatus.PENDING,
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        partnerCode: 'MOMO_TEST',
        orderId: 'PAY-ORDER-1',
        requestId: 'QUERY-payment-1',
        amount: 149000,
        resultCode: 0,
        message: 'Successful.',
        responseTime: Date.now(),
      }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    await expect(
      service.queryMomoStatus('customer-1', 'payment-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (db as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('reports the latest local terminal status when provider success races with a local transition', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'payment-1',
        userId: 'customer-1',
        transactionId: 'PAY-ORDER-1',
        amount: 150000,
        status: PaymentStatus.PENDING,
      })
      .mockResolvedValueOnce({
        status: PaymentStatus.FAILED,
        providerTransactionId: null,
      });
    const db = {
      payment: { findUnique, updateMany: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        partnerCode: 'MOMO_TEST',
        orderId: 'PAY-ORDER-1',
        requestId: 'QUERY-payment-1',
        amount: 150000,
        resultCode: 0,
        message: 'Successful.',
        transId: 4088878653,
        responseTime: Date.now(),
      }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.queryMomoStatus('customer-1', 'payment-1');

    expect(result.localStatus).toBe(PaymentStatus.FAILED);
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });
});
