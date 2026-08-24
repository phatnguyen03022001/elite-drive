import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
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
      data: { providerTransactionId: '4088878653' },
    }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'payment-1', status: PaymentStatus.FAILED }),
      data: {
        providerSuccessResultCode: 0,
        providerSuccessConflictAt: expect.any(Date),
      },
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

  it('backfills a valid provider identity after conflict evidence was already recorded', async () => {
    const conflictAt = new Date('2026-08-24T00:00:00.000Z');
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'payment-1', userId: 'customer-1', transactionId: 'PAY-ORDER-1', amount: 150000, status: PaymentStatus.FAILED,
      })
      .mockResolvedValueOnce({
        status: PaymentStatus.FAILED,
        providerTransactionId: null,
        providerSuccessConflictAt: conflictAt,
      });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = { payment: { findUnique, updateMany }, $transaction: jest.fn() } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        orderId: 'PAY-ORDER-1', requestId: 'QUERY-payment-1', amount: 150000,
        resultCode: 0, message: 'Successful.', transId: 222, responseTime: Date.now(),
      }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.queryMomoStatus('customer-1', 'payment-1');

    expect(result.localStatus).toBe(PaymentStatus.FAILED);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'payment-1', status: PaymentStatus.FAILED }),
      data: { providerTransactionId: '222' },
    }));
    expect(updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerSuccessConflictAt: expect.any(Date) }),
    }));
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });

  it('warns and preserves an existing provider identity when a different one arrives', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'payment-1', userId: 'customer-1', transactionId: 'PAY-ORDER-1', amount: 150000, status: PaymentStatus.FAILED,
      })
      .mockResolvedValueOnce({
        status: PaymentStatus.FAILED,
        providerTransactionId: '111',
        providerSuccessConflictAt: new Date('2026-08-24T00:00:00.000Z'),
      });
    const updateMany = jest.fn();
    const db = { payment: { findUnique, updateMany }, $transaction: jest.fn() } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        orderId: 'PAY-ORDER-1', requestId: 'QUERY-payment-1', amount: 150000,
        resultCode: 0, message: 'Successful.', transId: 222, responseTime: Date.now(),
      }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.queryMomoStatus('customer-1', 'payment-1');

    expect(result.localStatus).toBe(PaymentStatus.FAILED);
    expect(updateMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('111'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('222'));
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('durably records provider success when a pending payment cannot confirm its booking', async () => {
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
        status: PaymentStatus.PENDING,
        providerTransactionId: null,
        providerSuccessConflictAt: null,
      });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      payment: { findUnique, updateMany },
      $transaction: jest.fn().mockRejectedValue(
        new BadRequestException('Booking không còn có thể xác nhận thanh toán'),
      ),
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
      where: expect.objectContaining({ id: 'payment-1', status: PaymentStatus.PENDING }),
      data: expect.objectContaining({
        status: PaymentStatus.FAILED,
        providerTransactionId: '4088878653',
        providerSuccessResultCode: 0,
        providerSuccessConflictAt: expect.any(Date),
      }),
    }));
  });

  it('refunds a non-authoritative provider-success conflict without local escrow mutation', async () => {
    const payment = {
      id: 'payment-1',
      amount: 150000,
      paymentMethod: 'MOMO',
      status: PaymentStatus.FAILED,
      transactionId: 'PAY-ORDER-1',
      providerTransactionId: '4088878653',
      providerSuccessConflictAt: new Date(),
      refundOrderId: null,
      refundRequestId: null,
      bookingId: 'booking-1',
      createdAt: new Date('2026-08-24T00:00:00Z'),
      booking: { status: 'CANCELLED', trip: null },
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany,
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        resultCode: 0,
        amount: 150000,
        transId: 4088878653,
        message: 'Successful.',
      }),
      refund: jest.fn().mockResolvedValue({
        resultCode: 0,
        amount: 150000,
        transId: 700001,
        message: 'Refunded.',
      }),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.recoverMomoProviderSuccessConflict('payment-1');

    expect(result.disposition).toBe('REFUNDED');
    expect(result.localStatus).toBe(PaymentStatus.REFUNDED);
    expect(momo.refund).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'RF-payment-1',
      requestId: 'RFR-payment-1',
      transId: 4088878653,
    }));
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PaymentStatus.REFUNDED }),
    }));
  });

  it('quarantines a provider identity mismatch without refunding or overwriting evidence', async () => {
    const updateMany = jest.fn();
    const db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1', amount: 150000, paymentMethod: 'MOMO',
          status: PaymentStatus.FAILED, transactionId: 'PAY-ORDER-1',
          providerTransactionId: '111', providerSuccessConflictAt: new Date(),
          refundOrderId: null, refundRequestId: null, bookingId: 'booking-1',
          createdAt: new Date(), booking: { status: 'CANCELLED', trip: null },
        }),
        updateMany,
      },
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        resultCode: 0, amount: 150000, transId: 222, message: 'Successful.',
      }),
      refund: jest.fn(),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.recoverMomoProviderSuccessConflict('payment-1');

    expect(result.disposition).toBe('QUARANTINED');
    expect(momo.refund).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('resumes a provider refund after local process death without issuing refund twice', async () => {
    const payment = {
      id: 'payment-1', amount: 150000, paymentMethod: 'MOMO',
      status: PaymentStatus.FAILED, transactionId: 'PAY-ORDER-1',
      providerTransactionId: '4088878653', providerSuccessConflictAt: new Date(),
      refundOrderId: 'RF-payment-1', refundRequestId: 'RFR-payment-1',
      bookingId: 'booking-1', createdAt: new Date(),
      booking: { status: 'CANCELLED', trip: null },
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany,
      },
    } as unknown as PrismaService;
    const momo = {
      queryStatus: jest.fn().mockResolvedValue({
        resultCode: 0, amount: 150000, transId: 4088878653, message: 'Successful.',
      }),
      queryRefund: jest.fn().mockResolvedValue({
        resultCode: 0,
        refundTrans: [{
          orderId: 'RF-payment-1', amount: 150000, resultCode: 0, transId: 700001,
        }],
      }),
      refund: jest.fn(),
    } as unknown as MomoGatewayService;
    const service = new PaymentService(db, momo, config);

    const result = await service.recoverMomoProviderSuccessConflict('payment-1');

    expect(result.disposition).toBe('REFUNDED');
    expect(momo.queryRefund).toHaveBeenCalledWith('RF-payment-1', 'RFR-payment-1');
    expect(momo.refund).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PaymentStatus.REFUNDED }),
    }));
  });
});
