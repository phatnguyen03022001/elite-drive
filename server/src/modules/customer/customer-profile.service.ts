import { Injectable, NotFoundException } from '@nestjs/common';
import { KYCStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import {
  CustomerProfileResponseDto,
  UpdateCustomerProfileDto,
} from './dto/customer.dto';

@Injectable()
export class CustomerProfileService {
  constructor(
    private readonly db: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async getProfile(userId: string): Promise<CustomerProfileResponseDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        address: true,
        city: true,
        country: true,
        postalCode: true,
        customerLicenseNumber: true,
        customerLicenseExpiry: true,
        customerDateOfBirth: true,
        customerLicenseFrontUrl: true,
        customerLicenseBackUrl: true,
        ownerCompanyName: true,
        ownerTaxId: true,
        ownerBankAccountName: true,
        ownerBankAccountNumber: true,
        ownerBankCode: true,
        kyc: { select: { status: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      userCreatedAt: user.createdAt,
      userUpdatedAt: user.updatedAt,
      profile: {
        id: user.id,
        avatar: user.avatar,
        address: user.address,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode,
        profileUpdatedAt: user.updatedAt,
        ...(user.role === UserRole.CUSTOMER
          ? {
              licenseNumber: user.customerLicenseNumber,
              licenseExpiry: user.customerLicenseExpiry,
              dateOfBirth: user.customerDateOfBirth,
              licenseFrontUrl: user.customerLicenseFrontUrl,
              licenseBackUrl: user.customerLicenseBackUrl,
            }
          : {}),
        ...(user.role === UserRole.OWNER
          ? {
              companyName: user.ownerCompanyName,
              taxId: user.ownerTaxId,
              bankAccountName: user.ownerBankAccountName,
              bankAccountNumber: user.ownerBankAccountNumber,
              bankCode: user.ownerBankCode,
            }
          : {}),
      },
      kycStatus: user.kyc?.status ?? KYCStatus.NONE,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateCustomerProfileDto,
    avatarFile?: Express.Multer.File,
  ): Promise<CustomerProfileResponseDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const avatarUrl = avatarFile
      ? await this.uploadService.uploadFile(avatarFile, 'avatars')
      : undefined;

    const updateData: Prisma.UserUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      ...(avatarUrl ? { avatar: avatarUrl } : {}),
      address: dto.address,
      city: dto.city,
      country: dto.country,
      postalCode: dto.postalCode,
    };

    if (user.role === UserRole.CUSTOMER && dto.dateOfBirth) {
      updateData.customerDateOfBirth = new Date(dto.dateOfBirth);
    }

    await this.db.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true },
    });
    return this.getProfile(userId);
  }
}
