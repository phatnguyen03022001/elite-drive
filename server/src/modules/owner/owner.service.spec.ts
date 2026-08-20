import { CarStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { OwnerService } from './owner.service';

describe('OwnerService listing invariants', () => {
  it('returns an edited listing to pending review', async () => {
    const prisma = {
      car: {
        findUnique: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
      },
    } as unknown as PrismaService;
    const upload = { uploadFile: jest.fn() } as unknown as UploadService;
    const service = new OwnerService(prisma, upload);

    await service.updateCar('owner-1', 'car-1', { name: 'Updated vehicle' });

    expect((prisma as any).car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: expect.objectContaining({
        name: 'Updated vehicle',
        status: CarStatus.PENDING,
        verificationStatus: VerificationStatus.PENDING,
        rejectionReason: null,
      }),
    });
  });
});
