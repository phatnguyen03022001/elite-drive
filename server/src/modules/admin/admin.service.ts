import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CarStatus,
  DisputeStatus,
  KYCStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminKYCQueryDto,
  CreateCategoryDto,
  CreateLocationDto,
  CreatePromotionDto,
  PromotionQueryDto,
  RejectKYCDto,
  ReportDateRangeDto,
  ResolveDisputeDto,
  UpdatePromotionDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverviewReport() {
    const [users, cars, bookings, revenue] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.car.count(),
      this.prisma.booking.count(),
      this.prisma.ownerTransaction.aggregate({
        where: { type: 'RENTAL_INCOME', status: 'completed' },
        _sum: { amount: true },
      }),
    ]);
    return {
      totalUsers: users,
      totalCars: cars,
      totalBookings: bookings,
      totalRevenue: revenue._sum.amount ?? 0,
    };
  }

  async getBookingsReport(query: ReportDateRangeDto) {
    return this.prisma.booking.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      _count: { _all: true },
    });
  }

  async getRevenueReport(query: ReportDateRangeDto) {
    return this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      _sum: { amount: true },
    });
  }

  async getPendingCars() {
    return this.prisma.car.findMany({
      where: { verificationStatus: VerificationStatus.PENDING },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        category: true,
        location: true,
        documents: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async approveCar(carId: string) {
    const result = await this.prisma.car.updateMany({
      where: { id: carId, verificationStatus: VerificationStatus.PENDING },
      data: {
        verificationStatus: VerificationStatus.APPROVED,
        status: CarStatus.APPROVED,
      },
    });
    if (result.count !== 1) {
      throw new BadRequestException('Vehicle is not awaiting approval');
    }
  }

  async getAllCars(status?: string) {
    let verificationStatus: VerificationStatus | undefined;
    if (status) {
      if (!Object.values(VerificationStatus).includes(status as VerificationStatus)) {
        throw new BadRequestException('Invalid vehicle verification status');
      }
      verificationStatus = status as VerificationStatus;
    }

    return this.prisma.car.findMany({
      where: verificationStatus ? { verificationStatus } : {},
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async rejectCar(carId: string, reason: string) {
    const result = await this.prisma.car.updateMany({
      where: { id: carId, verificationStatus: VerificationStatus.PENDING },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        status: CarStatus.REJECTED,
        description: `Rejection reason: ${reason.trim()}`,
      },
    });
    if (result.count !== 1) {
      throw new BadRequestException('Vehicle is not awaiting approval');
    }
  }

  async getKycCustomers(query: PaginationDto & AdminKYCQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.KYCWhereInput = query.status
      ? { status: query.status }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.kYC.findMany({
        where,
        select: {
          id: true,
          userId: true,
          status: true,
          documentType: true,
          documentNumber: true,
          documentFrontUrl: true,
          documentBackUrl: true,
          faceImageUrl: true,
          verifiedAt: true,
          rejectionReason: true,
          submittedAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.kYC.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async approveKyc(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const kycClaim = await tx.kYC.updateMany({
        where: { userId, status: KYCStatus.PENDING },
        data: { status: KYCStatus.APPROVED, verifiedAt: new Date() },
      });
      if (kycClaim.count !== 1) {
        throw new BadRequestException('KYC is not awaiting review');
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verificationStatus: VerificationStatus.APPROVED,
        },
      });
    });
  }

  async rejectKyc(userId: string, dto: RejectKYCDto) {
    const result = await this.prisma.kYC.updateMany({
      where: { userId, status: KYCStatus.PENDING },
      data: {
        status: KYCStatus.REJECTED,
        rejectionReason: dto.rejectionReason.trim(),
      },
    });
    if (result.count !== 1) {
      throw new BadRequestException('KYC is not awaiting review');
    }
  }

  async createPromotion(dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        minBookingAmount: dto.minBookingAmount,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    const { startDate, endDate, code, ...rest } = dto;
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...rest,
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    });
  }

  async getPromotions(query: PromotionQueryDto) {
    return this.prisma.promotion.findMany({
      where: {
        isActive:
          query.isActive !== undefined
            ? String(query.isActive) === 'true'
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllDisputes(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          initiator: {
            select: { firstName: true, lastName: true, email: true },
          },
          booking: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dispute.count(),
    ]);
    return { items, total, page, limit };
  }

  async updateToInProgress(disputeId: string) {
    const result = await this.prisma.dispute.updateMany({
      where: { id: disputeId, status: DisputeStatus.OPEN },
      data: { status: DisputeStatus.IN_PROGRESS },
    });
    if (result.count !== 1) {
      throw new BadRequestException('Dispute is not open');
    }
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto) {
    if (![DisputeStatus.RESOLVED, DisputeStatus.CLOSED].includes(dto.status)) {
      throw new BadRequestException('Final dispute status must be RESOLVED or CLOSED');
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true },
    });
    if (!dispute) throw new NotFoundException('Không tìm thấy khiếu nại');

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: dto.status,
        resolution: dto.resolution.trim(),
        resolvedAt: new Date(),
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const baseSlug = this.slugify(dto.name);
    if (!baseSlug) throw new BadRequestException('Category name is invalid');

    let slug = baseSlug;
    let suffix = 2;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
      },
    });
  }

  async createLocation(dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        city: dto.city.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async getAllBookings(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
          car: { select: { name: true, licensePlate: true } },
        },
      }),
      this.prisma.booking.count(),
    ]);
    return { items, total, page, limit };
  }

  async getAllContracts(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true } },
              car: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.contract.count(),
    ]);
    return { items, total, page, limit };
  }

  async getUsers(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          verificationStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, page, limit };
  }

  async updateUserStatus(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
