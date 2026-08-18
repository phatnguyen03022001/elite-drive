import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CustomerProfileService } from './customer-profile.service';

function profileRow() {
  return {
    id: 'customer-1',
    email: 'customer@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '0900000000',
    avatar: 'https://trusted.example/existing.jpg',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    address: null,
    city: null,
    country: null,
    postalCode: null,
    customerLicenseNumber: 'OLD-LICENSE',
    customerLicenseExpiry: null,
    customerDateOfBirth: null,
    customerLicenseFrontUrl: null,
    customerLicenseBackUrl: null,
    ownerCompanyName: null,
    ownerTaxId: null,
    ownerBankAccountName: null,
    ownerBankAccountNumber: null,
    ownerBankCode: null,
    kyc: null,
  };
}

describe('CustomerProfileService invariants', () => {
  it('does not persist a client-controlled avatar URL or license identity fields', async () => {
    const row = profileRow();
    const user = {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({ id: row.id, role: row.role })
        .mockResolvedValueOnce(row),
      update: jest.fn().mockResolvedValue({ id: row.id }),
    };
    const db = { user } as unknown as PrismaService;
    const uploadService = {
      uploadFile: jest.fn(),
    } as unknown as UploadService;
    const service = new CustomerProfileService(db, uploadService);

    await service.updateProfile('customer-1', {
      firstName: 'Updated',
      avatar: 'https://tracker.example/pixel.gif',
      licenseNumber: 'ATTACKER-LICENSE',
      licenseExpiry: '2030-01-01',
    });

    const data = user.update.mock.calls[0][0].data;
    expect(data.firstName).toBe('Updated');
    expect(data.avatar).toBeUndefined();
    expect(data.customerLicenseNumber).toBeUndefined();
    expect(data.customerLicenseExpiry).toBeUndefined();
    expect(uploadService.uploadFile).not.toHaveBeenCalled();
  });

  it('persists an avatar only through the validated upload service', async () => {
    const row = profileRow();
    const user = {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({ id: row.id, role: row.role })
        .mockResolvedValueOnce({ ...row, avatar: 'https://cdn.example/avatar.jpg' }),
      update: jest.fn().mockResolvedValue({ id: row.id }),
    };
    const uploadService = {
      uploadFile: jest.fn().mockResolvedValue('https://cdn.example/avatar.jpg'),
    } as unknown as UploadService;
    const service = new CustomerProfileService(
      { user } as unknown as PrismaService,
      uploadService,
    );
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;

    await service.updateProfile('customer-1', {}, file);

    expect(uploadService.uploadFile).toHaveBeenCalledWith(file, 'avatars');
    expect(user.update.mock.calls[0][0].data.avatar).toBe(
      'https://cdn.example/avatar.jpg',
    );
  });
});
