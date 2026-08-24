import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CarStatus,
  KYCStatus,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import {
  BookingQueryDto,
  CreateKYCDto,
  CustomerProfileResponseDto,
  KYCStatusResponseDto,
  SearchCarQueryDto,
  TripQueryDto,
  TripStatusResponseDto,
  UpdateCustomerProfileDto,
} from './dto/customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async getProfile(userId: string): Promise<CustomerProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: { select: { status: true } } },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản người dùng');

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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const { firstName, lastName, phone, avatar, ...profileData } = dto;
    let avatarUrl: string | undefined;
    if (avatarFile) {
      avatarUrl = await this.uploadService.uploadFile(avatarFile, 'avatars');
    } else if (typeof avatar === 'string' && avatar.startsWith('http')) {
      avatarUrl = avatar;
    }

    const updateData: Prisma.UserUpdateInput = {
      firstName,
      lastName,
      phone,
      ...(avatarUrl ? { avatar: avatarUrl } : {}),
      address: profileData.address,
      city: profileData.city,
      country: profileData.country,
      postalCode: profileData.postalCode,
    };

    if (user.role === UserRole.CUSTOMER) {
      updateData.customerLicenseNumber = profileData.licenseNumber;
      updateData.customerLicenseExpiry = profileData.licenseExpiry
        ? new Date(profileData.licenseExpiry)
        : undefined;
      updateData.customerDateOfBirth = profileData.dateOfBirth
        ? new Date(profileData.dateOfBirth)
        : undefined;
    }

    await this.prisma.user.update({ where: { id: userId }, data: updateData });
    return this.getProfile(userId);
  }

  async submitKyc(
    userId: string,
    dto: CreateKYCDto,
    files: {
      documentFront?: Express.Multer.File[];
      documentBack?: Express.Multer.File[];
      faceImage?: Express.Multer.File[];
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const existing = await this.prisma.kYC.findUnique({ where: { userId } });
    if (existing?.status === KYCStatus.PENDING) {
      throw new BadRequestException('Hồ sơ KYC đang trong quá trình phê duyệt.');
    }

    const frontFile = files?.documentFront?.[0];
    const backFile = files?.documentBack?.[0];
    const faceFile = files?.faceImage?.[0];
    if (!frontFile || !backFile || !faceFile) {
      throw new BadRequestException(
        'Vui lòng cung cấp đủ: Mặt trước, mặt sau và ảnh chân dung.',
      );
    }

    const folderPath =
      user.role === UserRole.OWNER ? 'owners/kyc' : 'customers/kyc';
    const [frontUrl, backUrl, faceUrl] = await Promise.all([
      this.uploadService.uploadPrivateImage(frontFile, `${folderPath}/front`),
      this.uploadService.uploadPrivateImage(backFile, `${folderPath}/back`),
      this.uploadService.uploadPrivateImage(faceFile, `${folderPath}/faces`),
    ]);

    const kyc = await this.prisma.$transaction(async (tx) => {
      const kyc = await tx.kYC.upsert({
        where: { userId },
        update: {
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          documentFrontUrl: frontUrl,
          documentBackUrl: backUrl,
          faceImageUrl: faceUrl,
          status: KYCStatus.PENDING,
          submittedAt: new Date(),
          verifiedAt: null,
          rejectionReason: null,
        },
        create: {
          userId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          documentFrontUrl: frontUrl,
          documentBackUrl: backUrl,
          faceImageUrl: faceUrl,
          status: KYCStatus.PENDING,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isVerified: false,
          verificationStatus: VerificationStatus.PENDING,
          ...(user.role === UserRole.CUSTOMER
            ? { customerLicenseNumber: dto.documentNumber }
            : {}),
        },
      });
      return kyc;
    });
    return this.resolveKycMedia(kyc);
  }

  async getKycStatus(userId: string): Promise<KYCStatusResponseDto> {
    const kyc = await this.prisma.kYC.findUnique({ where: { userId } });
    if (!kyc) {
      return {
        status: KYCStatus.NONE,
        documentType: null,
        documentNumber: null,
        documentFrontUrl: null,
        documentBackUrl: null,
        faceImageUrl: null,
        rejectionReason: null,
        submittedAt: null,
      };
    }
    return this.resolveKycMedia({
      status: kyc.status,
      documentType: kyc.documentType,
      documentNumber: kyc.documentNumber,
      documentFrontUrl: kyc.documentFrontUrl,
      documentBackUrl: kyc.documentBackUrl,
      faceImageUrl: kyc.faceImageUrl,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
    });
  }

  private resolveKycMedia<T extends { documentFrontUrl?: string | null; documentBackUrl?: string | null; faceImageUrl?: string | null }>(kyc: T): T {
    return {
      ...kyc,
      documentFrontUrl: kyc.documentFrontUrl ? this.uploadService.resolvePrivateImageUrl(kyc.documentFrontUrl) : kyc.documentFrontUrl,
      documentBackUrl: kyc.documentBackUrl ? this.uploadService.resolvePrivateImageUrl(kyc.documentBackUrl) : kyc.documentBackUrl,
      faceImageUrl: kyc.faceImageUrl ? this.uploadService.resolvePrivateImageUrl(kyc.faceImageUrl) : kyc.faceImageUrl,
    };
  }

  async getBookings(userId: string, query: PaginationDto & BookingQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const where: Prisma.BookingWhereInput = {
      customerId: userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          car: {
            select: { id: true, name: true, brand: true, mainImageUrl: true },
          },
          contract: { select: { status: true, customerSignedAt: true } },
          reviews: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data: items, total, page, limit };
  }

  async getBookingDetail(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId: userId },
      include: {
        car: true,
        payments: { orderBy: { createdAt: 'desc' } },
        contract: true,
        trip: true,
        reviews: { where: { userId }, select: { id: true }, take: 1 },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    return booking;
  }

  async getPaymentByBooking(userId: string, bookingId: string) {
    return this.prisma.payment.findFirst({
      where: { bookingId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTrips(userId: string, query: PaginationDto & TripQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.TripWhereInput = {
      customerId: userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { booking: { include: { car: true } } },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return { data: items, total, page, limit };
  }

  async getTripStatus(
    userId: string,
    tripId: string,
  ): Promise<TripStatusResponseDto> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, customerId: userId },
      select: {
        id: true,
        status: true,
        checkinTime: true,
        checkoutTime: true,
      },
    });
    if (!trip) throw new NotFoundException('Không tìm thấy trip');
    return trip;
  }

  async getWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getWalletTransactions(userId: string, query: PaginationDto) {
    const wallet = await this.getWallet(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { data, total, page, limit };
  }

  async getMyReviews(userId: string, query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        include: {
          car: {
            select: { id: true, name: true, brand: true, mainImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);
    return { data, total, page, limit };
  }

  async searchCars(query: SearchCarQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw new BadRequestException('Khoảng thời gian thuê xe không hợp lệ');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const where: Prisma.CarWhereInput = {
      status: CarStatus.APPROVED,
      verificationStatus: VerificationStatus.APPROVED,
      isAvailable: true,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      bookings: {
        none: {
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.APPROVED,
              BookingStatus.CONFIRMED,
            ],
          },
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      },
      availability: {
        none: {
          isAvailable: false,
          date: { gte: startDate, lt: endDate },
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.car.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true, location: true },
      }),
      this.prisma.car.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
