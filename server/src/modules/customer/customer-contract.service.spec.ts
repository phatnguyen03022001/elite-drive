import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerContractService } from './customer-contract.service';

describe('CustomerContractService invariants', () => {
  it('requires a confirmed booking before signing', async () => {
    const tx = {
      contract: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contract-1',
          customerSignedAt: null,
          booking: { status: BookingStatus.APPROVED, trip: null },
        }),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerContractService(db);

    await expect(
      service.signContract('customer-1', 'booking-1', { signatureData: 'sig' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('rejects signing once the trip is ongoing', async () => {
    const tx = {
      contract: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contract-1',
          customerSignedAt: null,
          booking: {
            status: BookingStatus.CONFIRMED,
            trip: { status: 'ONGOING' },
          },
        }),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerContractService(db);

    await expect(
      service.signContract('customer-1', 'booking-1', { signatureData: 'sig' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('returns an already signed contract without overwriting the signature', async () => {
    const existing = {
      id: 'contract-1',
      customerSignature: 'original',
      customerSignedAt: new Date(),
      booking: {
        status: BookingStatus.CONFIRMED,
        trip: { status: 'UPCOMING' },
      },
    };
    const tx = {
      contract: {
        findFirst: jest.fn().mockResolvedValue(existing),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerContractService(db);

    const result = await service.signContract('customer-1', 'booking-1', {
      signatureData: 'attacker-replacement',
    });

    expect(result).toBe(existing);
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('claims an unsigned contract conditionally', async () => {
    const tx = {
      contract: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contract-1',
          bookingId: 'booking-1',
          customerSignedAt: null,
          booking: {
            status: BookingStatus.CONFIRMED,
            trip: { status: 'UPCOMING' },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'contract-1',
          status: 'SIGNED',
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerContractService(db);

    await service.signContract('customer-1', 'booking-1', { signatureData: 'sig' });

    expect(tx.contract.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'contract-1',
        bookingId: 'booking-1',
        customerSignedAt: null,
      },
      data: {
        customerSignedAt: expect.any(Date),
        customerSignature: 'sig',
        status: 'SIGNED',
      },
    });
  });
});
