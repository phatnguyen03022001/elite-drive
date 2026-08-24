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

  it('persists a valid late provider success as a durable conflict while keeping FAILED', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'payment-1',
        userId: 'customer-1',
        transactionId: 'PAY-ORDER-1',
        amount: 150000,
        status: PaymentStatus.FAILED,
      })
      .mockResolvedValueOnce({
        status: PaymentStatus.FAILED,
        providerTransactionId: null,
      });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      payment: { findUnique, updateMany },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
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
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'payment-1', status: PaymentStatus.FAILED }),
      data: expect.objectContaining({
        providerSuccessResultCode: 0,
        providerTransactionId: '4088878653',
        providerSuccessConflictAt: expect.any(Date),
      }),
    }));
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });

  it('keeps late success conflict evidence idempotent and preserves existing provider identity', async () => {
    const conflictAt = new Date('2026-08-24T00:00:00.000Z');
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'payment-1', userId: 'customer-1', transactionId: 'PAY-ORDER-1', amount: 150000, status: PaymentStatus.FAILED,
      })
      .mockResolvedValueOnce({ status: PaymentStatus.FAILED, providerTransactionId: 'existing-trans-id', providerSuccessConflictAt: null })
      .mockResolvedValueOnce({
        id: 'payment-1', userId: 'customer-1', transactionId: 'PAY-ORDER-1', amount: 150000, status: PaymentStatus.FAILED,
      })
      .mockResolvedValueOnce({ status: PaymentStatus.FAILED, providerTransactionId: 'existing-trans-id', providerSuccessConflictAt: conflictAt });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = { payment: { findUnique, updateMany }, $transaction: jest.fn() } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn()
        .mockResolvedValue({ orderId: 'PAY-ORDER-1', requestId: 'QUERY-payment-1', amount: 150000, resultCode: 0, message: 'Successful.', transId: 999999, responseTime: Date.now() }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    await service.queryMomoStatus('customer-1', 'payment-1');
    await service.queryMomoStatus('customer-1', 'payment-1');

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ providerSuccessConflictAt: null }]),
      }),
      data: expect.objectContaining({ providerSuccessConflictAt: expect.any(Date) }),
    }));
    expect(updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerTransactionId: '999999' }),
    }));
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });
});
