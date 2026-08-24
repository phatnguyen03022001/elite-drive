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
  BlockCalendarDto,
  CreateCarDocumentDto,
  CreateCarDto,
  CreateKYCDto,
  CreatePricingDto,
  KYCStatusResponseDto,
  OwnerProfileResponseDto,
  UpdateCarDto,
  UpdateOwnerProfileDto,
} from './dto/owner.dto';

const MAX_CALENDAR_UPDATE_ATTEMPTS = 3;

@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async getProfile(userId: string): Promise<OwnerProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        ownerCompanyName: true,
        ownerTaxId: true,
        ownerBankAccountName: true,
        ownerBankAccountNumber: true,
        ownerBankCode: true,
        address: true,
        city: true,
        country: true,
        verificationStatus: true,
      },
    });
    if (!user) throw new NotFoundException('Owner không tồn tại');
    return {
      id: user.id,
      userId: user.id,
      companyName: user.ownerCompanyName,
      taxId: user.ownerTaxId,
      bankAccountName: user.ownerBankAccountName,
      bankAccountNumber: user.ownerBankAccountNumber,
      bankCode: user.ownerBankCode,
      address: user.address,
      city: user.city,
      country: user.country,
      verificationStatus: user.verificationStatus,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateOwnerProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Owner không tồn tại');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ownerCompanyName: dto.companyName,
        ownerTaxId: dto.taxId,
        ownerBankAccountName: dto.bankAccountName,
        ownerBankAccountNumber: dto.bankAccountNumber,
        ownerBankCode: dto.bankCode,
        address: dto.address,
        city: dto.city,
        country: dto.country,
      },
    });
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
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    if (user.role !== UserRole.OWNER) throw new ForbiddenException('Tài khoản không phải owner');
    const existing = await this.prisma.kYC.findUnique({ where: { userId } });
    if (existing?.status === KYCStatus.PENDING) throw new BadRequestException('Hồ sơ KYC đang chờ duyệt');

    const frontFile = files?.documentFront?.[0];
    const backFile = files?.documentBack?.[0];
    const faceFile = files?.faceImage?.[0];
    if (!frontFile || !backFile || !faceFile) throw new BadRequestException('Cần đủ mặt trước, mặt sau GTTT và ảnh chân dung');

    const [frontUrl, backUrl, faceUrl] = await Promise.all([
      this.uploadService.uploadPrivateImage(frontFile, 'owners/kyc/front'),
      this.uploadService.uploadPrivateImage(backFile, 'owners/kyc/back'),
      this.uploadService.uploadPrivateImage(faceFile, 'owners/kyc/faces'),
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
        data: { isVerified: false, verificationStatus: VerificationStatus.PENDING },
      });
      return kyc;
    });
    return this.resolveKycMedia(kyc);
  }

  async getKycStatus(userId: string): Promise<KYCStatusResponseDto> {
    const kyc = await this.prisma.kYC.findUnique({ where: { userId } });
    if (!kyc) return { status: KYCStatus.NONE, submittedAt: null };
    return this.resolveKycMedia({
      status: kyc.status,
      documentType: kyc.documentType ?? undefined,
      documentNumber: kyc.documentNumber ?? undefined,
      documentFrontUrl: kyc.documentFrontUrl ?? undefined,
      documentBackUrl: kyc.documentBackUrl ?? undefined,
      faceImageUrl: kyc.faceImageUrl ?? undefined,
      rejectionReason: kyc.rejectionReason ?? undefined,
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

  async createCar(
    userId: string,
    dto: CreateCarDto,
    files: { mainImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    await this.assertOwnerKycApproved(userId);
    const mainFile = files?.mainImage?.[0];
    if (!mainFile) throw new BadRequestException('Ảnh chính của xe là bắt buộc');
    const mainImageUrl = await this.uploadService.uploadFile(mainFile, 'cars/main');
    const imageUrls = files?.images?.length
      ? await Promise.all(files.images.map((file) => this.uploadService.uploadFile(file, 'cars/gallery')))
      : [];
    return this.prisma.car.create({
      data: {
        ownerId: userId,
        name: dto.name.trim(),
        brand: dto.brand.trim(),
        model: dto.model.trim(),
        year: dto.year,
        licensePlate: dto.licensePlate.trim().toUpperCase(),
        color: dto.color,
        transmission: dto.transmission,
        fuelType: dto.fuelType,
        seatCount: dto.seatCount,
        description: dto.description,
        pricePerDay: dto.pricePerDay,
        pricePerHour: dto.pricePerHour,
        pricePerWeek: dto.pricePerWeek,
        pricePerMonth: dto.pricePerMonth,
        categoryId: dto.categoryId,
        locationId: dto.locationId,
        mainImageUrl,
        imageUrls,
        status: CarStatus.PENDING,
        verificationStatus: VerificationStatus.PENDING,
        rejectionReason: null,
      },
    });
  }

  async getMyCars(userId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.CarWhereInput = { ownerId: userId };
    const [data, total] = await Promise.all([
      this.prisma.car.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.car.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateCar(
    userId: string,
    carId: string,
    dto: UpdateCarDto,
    files?: { mainImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    await this.assertOwnerCar(userId, carId);
    const hasListingChanges =
      Object.values(dto).some((value) => value !== undefined) ||
      Boolean(files?.mainImage?.[0] || files?.images?.length);
    const data: Prisma.CarUpdateInput = {
      name: dto.name,
      brand: dto.brand,
      model: dto.model,
      year: dto.year,
      licensePlate: dto.licensePlate?.trim().toUpperCase(),
      seatCount: dto.seatCount,
      pricePerDay: dto.pricePerDay,
      pricePerHour: dto.pricePerHour,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
      ...(hasListingChanges
        ? {
            status: CarStatus.PENDING,
            verificationStatus: VerificationStatus.PENDING,
            rejectionReason: null,
          }
        : {}),
    };
    if (files?.mainImage?.[0]) data.mainImageUrl = await this.uploadService.uploadFile(files.mainImage[0], 'cars/main');
    if (files?.images?.length) data.imageUrls = await Promise.all(files.images.map((file) => this.uploadService.uploadFile(file, 'cars/gallery')));
    return this.prisma.car.update({ where: { id: carId }, data });
  }

  async deleteCar(userId: string, carId: string) {
    return this.prisma.$transaction(async (tx) => {
      const car = await tx.car.findFirst({
        where: { id: carId, ownerId: userId },
        select: { id: true },
      });
      if (!car) {
        const existing = await tx.car.findUnique({
          where: { id: carId },
          select: { ownerId: true },
        });
        if (!existing) throw new NotFoundException('Không tìm thấy xe');
        throw new ForbiddenException('Bạn không có quyền quản lý xe này');
      }

      await tx.car.update({
        where: { id: carId },
        data: { updatedAt: new Date() },
        select: { id: true },
      });

      const bookingCount = await tx.booking.count({ where: { carId } });
      if (bookingCount > 0) {
        throw new BadRequestException('Xe đã có lịch sử booking và không thể hard-delete');
      }
      return tx.car.delete({ where: { id: carId } });
    });
  }

  async addCarDocument(userId: string, carId: string, dto: CreateCarDocumentDto) {
    await this.assertOwnerCar(userId, carId);
    return this.prisma.carDocument.create({
      data: {
        carId,
        documentType: dto.documentType.trim(),
        documentUrl: dto.documentUrl,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  async getCarDocuments(userId: string, carId: string) {
    await this.assertOwnerCar(userId, carId);
    return this.prisma.carDocument.findMany({ where: { carId }, orderBy: { uploadedAt: 'desc' } });
  }

  async updateCarPricing(userId: string, carId: string, dto: CreatePricingDto) {
    await this.assertOwnerCar(userId, carId);
    return this.prisma.car.update({
      where: { id: carId },
      data: {
        pricePerDay: dto.pricePerDay,
        pricePerHour: dto.pricePerHour,
        pricePerWeek: dto.pricePerWeek,
        pricePerMonth: dto.pricePerMonth,
        discountPercentage: dto.discountPercentage ?? 0,
      },
    });
  }

  async blockAvailability(userId: string, carId: string, dto: BlockCalendarDto) {
    const requestedDate = new Date(dto.date);
    if (!Number.isFinite(requestedDate.getTime())) {
      throw new BadRequestException('Ngày block lịch không hợp lệ');
    }
    const date = new Date(Date.UTC(
      requestedDate.getUTCFullYear(),
      requestedDate.getUTCMonth(),
      requestedDate.getUTCDate(),
    ));
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const isBlocked = dto.isBlocked ?? true;

    for (let attempt = 1; attempt <= MAX_CALENDAR_UPDATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const car = await tx.car.findFirst({
            where: { id: carId, ownerId: userId },
            select: { id: true },
          });
          if (!car) {
            const existing = await tx.car.findUnique({
              where: { id: carId },
              select: { ownerId: true },
            });
            if (!existing) throw new NotFoundException('Không tìm thấy xe');
            throw new ForbiddenException('Bạn không có quyền quản lý xe này');
          }

          await tx.car.update({
            where: { id: carId },
            data: { updatedAt: new Date() },
            select: { id: true },
          });

          if (isBlocked) {
            const bookingConflict = await tx.booking.findFirst({
              where: {
                carId,
                status: {
                  in: [
                    BookingStatus.PENDING,
                    BookingStatus.APPROVED,
                    BookingStatus.CONFIRMED,
                  ],
                },
                startDate: { lt: nextDate },
                endDate: { gt: date },
              },
              select: { id: true },
            });
            if (bookingConflict) {
              throw new BadRequestException(
                'Không thể block ngày đã có booking đang hoạt động',
              );
            }
          }

          return tx.availability.upsert({
            where: { carId_date: { carId, date } },
            update: {
              isAvailable: !isBlocked,
              blockedReason: isBlocked ? dto.blockedReason : null,
            },
            create: {
              carId,
              date,
              isAvailable: !isBlocked,
              blockedReason: isBlocked ? dto.blockedReason : null,
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < MAX_CALENDAR_UPDATE_ATTEMPTS) continue;
          throw new BadRequestException(
            'Lịch xe vừa thay đổi bởi yêu cầu khác, vui lòng thử lại',
          );
        }
        throw error;
      }
    }

    throw new BadRequestException('Không thể cập nhật lịch xe');
  }

  async getAvailability(userId: string, carId: string, startDate: Date, endDate: Date) {
    await this.assertOwnerCar(userId, carId);
    return this.prisma.availability.findMany({ where: { carId, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } });
  }

  async getDashboardOverview(userId: string) {
    const [cars, bookings, wallet, income] = await Promise.all([
      this.prisma.car.count({ where: { ownerId: userId } }),
      this.prisma.booking.count({ where: { car: { ownerId: userId } } }),
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.ownerTransaction.aggregate({ where: { ownerId: userId, type: 'RENTAL_INCOME', status: 'completed' }, _sum: { amount: true } }),
    ]);
    return { totalCars: cars, totalBookings: bookings, balance: wallet?.balance ?? 0, totalIncome: income._sum.amount ?? 0 };
  }

  async submitCarForReview(userId: string, carId: string) {
    await this.assertOwnerKycApproved(userId);
    const car = await this.prisma.car.findFirst({ where: { id: carId, ownerId: userId } });
    if (!car) throw new NotFoundException('Không tìm thấy xe');
    if (car.verificationStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException('Xe đã được phê duyệt');
    }
    return this.prisma.car.update({
      where: { id: carId },
      data: {
        status: CarStatus.PENDING,
        verificationStatus: VerificationStatus.PENDING,
        rejectionReason: null,
      },
    });
  }

  private async assertOwnerKycApproved(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundException('User không tồn tại');
    if (user.role !== UserRole.OWNER) throw new ForbiddenException('Bạn không phải là chủ xe');
    const kyc = await this.prisma.kYC.findUnique({ where: { userId }, select: { status: true } });
    if (kyc?.status !== KYCStatus.APPROVED) throw new ForbiddenException('KYC chưa được approved');
  }

  private async assertOwnerCar(userId: string, carId: string) {
    const car = await this.prisma.car.findUnique({ where: { id: carId }, select: { ownerId: true } });
    if (!car) throw new NotFoundException('Không tìm thấy xe');
    if (car.ownerId !== userId) throw new ForbiddenException('Bạn không có quyền quản lý xe này');
  }
}
