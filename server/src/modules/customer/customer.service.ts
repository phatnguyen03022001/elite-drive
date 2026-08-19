import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  KYCStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import {
  BookingQueryDto,
  ContractResponseDto,
  CreateDisputeDto,
  CreateKYCDto,
  CreateReviewDto,
  CustomerProfileResponseDto,
  KYCStatusResponseDto,
  SearchCarQueryDto,
  SignContractDto,
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
      this.uploadService.uploadFile(frontFile, `${folderPath}/front`),
      this.uploadService.uploadFile(backFile, `${folderPath}/back`),
      this.uploadService.uploadFile(faceFile, `${folderPath}/faces`),
    ]);

    return this.prisma.$transaction(async (tx) => {
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

      if (user.role === UserRole.CUSTOMER) {
        await tx.user.update({
          where: { id: userId },
          data: { customerLicenseNumber: dto.documentNumber },
        });
      }
      return kyc;
    });
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
    return {
      status: kyc.status,
      documentType: kyc.documentType,
      documentNumber: kyc.documentNumber,
      documentFrontUrl: kyc.documentFrontUrl,
      documentBackUrl: kyc.documentBackUrl,
      faceImageUrl: kyc.faceImageUrl,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
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
          car: { select: { id: true, name: true, brand: true, mainImageUrl: true } },
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
      select: { id: true, status: true },
    });
    if (!trip) throw new NotFoundException('Không tìm thấy trip');
    return trip;
  }

  async getContract(userId: string, bookingId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { bookingId, booking: { customerId: userId } },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  async signContract(
    userId: string,
    bookingId: string,
    dto: SignContractDto,
  ): Promise<ContractResponseDto> {
    const contract = await this.prisma.contract.findFirst({
      where: { bookingId, booking: { customerId: userId } },
      select: { bookingId: true },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');

    return this.prisma.contract.update({
      where: { bookingId: contract.bookingId },
      data: {
        customerSignedAt: new Date(),
        customerSignature: dto.signatureData,
        status: 'SIGNED',
      },
    });
  }

  async getWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getWalletTransactions(userId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { data: [], total: 0, page, limit };

    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { data, total, page, limit };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      if (booking.customerId !== userId) {
        throw new ForbiddenException('Không có quyền review booking này');
      }
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException(
          'Chỉ có thể đánh giá sau khi chuyến đi hoàn tất',
        );
      }
      if (booking.carId !== dto.carId) {
        throw new BadRequestException('Car không khớp với booking');
      }
      const existed = await this.prisma.review.findFirst({
        where: { bookingId: dto.bookingId },
        select: { id: true },
      });
      if (existed) throw new BadRequestException('Booking này đã được đánh giá');
    }

    return this.prisma.review.create({
      data: {
        userId,
        carId: dto.carId,
        bookingId: dto.bookingId ?? null,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
      },
    });
  }

  async getMyReviews(userId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ReviewWhereInput = { userId };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { car: { select: { name: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data: items, total, page, limit };
  }

  async createDispute(userId: string, dto: CreateDisputeDto) {
    const booking = dto.bookingId
      ? await this.prisma.booking.findFirst({
          where: { id: dto.bookingId, customerId: userId },
          select: { id: true },
        })
      : null;

    if (dto.bookingId && !booking) {
      throw new ForbiddenException('Booking không thuộc tài khoản hiện tại');
    }

    return this.prisma.dispute.create({
      data: {
        bookingId: booking?.id ?? null,
        initiatedBy: userId,
        title: `[${dto.type}] - ${booking?.id ?? 'Hỗ trợ chung'}`,
        description: dto.description,
        status: 'OPEN',
      },
    });
  }

  async getMyDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: { initiatedBy: userId },
      include: {
        booking: { select: { car: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchCars(query: SearchCarQueryDto) {
    const { startDate, endDate, locationId, categoryId, page = 1, limit = 20 } = query;
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate và endDate là bắt buộc');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Định dạng ngày không hợp lệ');
    }
    if (start >= end) throw new BadRequestException('endDate phải sau startDate');

    const where: Prisma.CarWhereInput = {
      isAvailable: true,
      verificationStatus: 'APPROVED',
      ...(locationId ? { locationId } : {}),
      ...(categoryId ? { categoryId } : {}),
      bookings: {
        none: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
          AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
        },
      },
      availability: {
        none: {
          date: { gte: start, lt: end },
          isAvailable: false,
        },
      },
    };

    const [cars, total] = await Promise.all([
      this.prisma.car.findMany({
        where,
        include: {
          reviews: { select: { rating: true } },
          location: true,
          category: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.car.count({ where }),
    ]);
    return { data: cars, total, page, limit };
  }

  async previewBookingPrice(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId: userId },
      include: { car: true },
    });
    if (!booking) throw new NotFoundException('Booking hoặc Car không tồn tại');

    const days =
      Math.ceil(
        (booking.endDate.getTime() - booking.startDate.getTime()) / 86400000,
      ) || 1;
    const basePrice = days * booking.car.pricePerDay;
    const discount = booking.discountAmount ?? 0;
    const insurance = booking.car.insurance ?? 0;
    const deposit = booking.car.depositRequired ?? 0;

    return {
      days,
      basePrice,
      insurance,
      deposit,
      discount,
      total: basePrice + insurance + deposit - discount,
    };
  }

  async confirmBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: userId,
        status: BookingStatus.CONFIRMED,
      },
      include: { trip: true },
    });
    if (!booking) throw new NotFoundException('Booking không tồn tại');
    if (!booking.trip) throw new BadRequestException('Trip chưa được tạo');
    return booking.trip;
  }

  async getActivePromotions() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyPromotion(userId: string, bookingId: string, promoCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          customerId: userId,
          status: BookingStatus.PENDING,
        },
      });
      if (!booking) {
        throw new NotFoundException('Booking không tồn tại hoặc đã thanh toán');
      }

      const promotion = await tx.promotion.findUnique({ where: { code: promoCode } });
      if (!promotion) throw new NotFoundException('Mã khuyến mãi không tồn tại');

      const now = new Date();
      if (!promotion.isActive || promotion.startDate > now || promotion.endDate < now) {
        throw new BadRequestException('Mã khuyến mãi không còn hiệu lực');
      }
      if (promotion.maxUses && promotion.usedCount >= promotion.maxUses) {
        throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
      }
      if (
        promotion.minBookingAmount &&
        booking.totalPrice < promotion.minBookingAmount
      ) {
        throw new BadRequestException(
          `Booking tối thiểu ${promotion.minBookingAmount} VND`,
        );
      }

      let discountAmount = 0;
      if (promotion.discountType === 'PERCENTAGE') {
        discountAmount = (booking.totalPrice * promotion.discountValue) / 100;
      } else if (promotion.discountType === 'FIXED') {
        discountAmount = promotion.discountValue;
      }
      discountAmount = Math.min(booking.totalPrice, Math.round(discountAmount));
      const finalPrice = booking.totalPrice - discountAmount;

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: booking.id,
          customerId: userId,
          status: BookingStatus.PENDING,
        },
        data: {
          promotionId: promotion.id,
          discountAmount,
          finalPrice,
          totalPrice: finalPrice,
        },
      });
      if (bookingClaim.count !== 1) {
        throw new BadRequestException('Booking đã thay đổi, vui lòng thử lại');
      }

      await tx.promotion.update({
        where: { id: promotion.id },
        data: { usedCount: { increment: 1 } },
      });

      return {
        originalPrice: booking.totalPrice,
        discountAmount,
        finalPrice,
        promoCode: promotion.code,
      };
    });
  }
}
