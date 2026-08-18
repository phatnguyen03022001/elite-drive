import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  BookingStatus,
  CarStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CarAvailabilityQueryDto,
  CarReviewQueryDto,
  PromotionQueryDto,
  PublicCarQueryDto,
} from './dto/public.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.CONFIRMED,
];

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<any> {
    if (!userId) {
      throw new UnauthorizedException('User identity is required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
    };
  }

  async getPromotions(query: PaginationDto & PromotionQueryDto) {
    const { page = 1, limit = 10, code } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionWhereInput = {
      isActive: true,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
      ...(code && { code: { equals: code, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getCars(query: PaginationDto & PublicCarQueryDto) {
    const {
      page = 1,
      limit = 10,
      city,
      categoryId,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      transmission,
    } = query;

    const skip = (page - 1) * limit;
    const hasDateRange = Boolean(startDate && endDate);

    const where: Prisma.CarWhereInput = {
      status: CarStatus.APPROVED,
      verificationStatus: VerificationStatus.APPROVED,
      isAvailable: true,
      ...(categoryId && { categoryId }),
      ...(city && {
        location: {
          is: {
            city: { contains: city, mode: 'insensitive' },
          },
        },
      }),
      ...(transmission && {
        transmission: { equals: transmission, mode: 'insensitive' },
      }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            pricePerDay: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          }
        : {}),
      ...(hasDateRange
        ? {
            bookings: {
              none: {
                status: { in: ACTIVE_BOOKING_STATUSES },
                startDate: { lte: endDate },
                endDate: { gte: startDate },
              },
            },
            availability: {
              none: {
                date: { gte: startDate, lte: endDate },
                isAvailable: false,
              },
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.car.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: { select: { name: true, imageUrl: true } },
          location: { select: { name: true, address: true, city: true } },
          owner: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          reviews: {
            select: {
              rating: true,
              content: true,
              createdAt: true,
              customer: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.car.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getCarDetail(id: string) {
    const car = await this.prisma.car.findFirst({
      where: {
        id,
        status: CarStatus.APPROVED,
        verificationStatus: VerificationStatus.APPROVED,
      },
      include: {
        category: true,
        location: true,
        owner: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            createdAt: true,
            _count: { select: { cars: true } },
          },
        },
        reviews: {
          include: {
            customer: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          where: { documentType: 'INSURANCE' },
        },
      },
    });

    if (!car) {
      throw new NotFoundException('Vehicle not found or not approved');
    }

    return car;
  }

  async getCarAvailability(
    carId: string,
    query: PaginationDto & CarAvailabilityQueryDto,
  ) {
    const car = await this.prisma.car.findFirst({
      where: {
        id: carId,
        status: CarStatus.APPROVED,
        verificationStatus: VerificationStatus.APPROVED,
      },
      select: { id: true, isAvailable: true },
    });

    if (!car) {
      throw new NotFoundException('Vehicle not found or not approved');
    }

    const { startDate, endDate } = query;
    if (!startDate || !endDate) {
      return { available: car.isAvailable };
    }

    const [bookingConflict, blockedDate] = await Promise.all([
      this.prisma.booking.findFirst({
        where: {
          carId,
          status: { in: ACTIVE_BOOKING_STATUSES },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      }),
      this.prisma.availability.findFirst({
        where: {
          carId,
          date: { gte: startDate, lte: endDate },
          isAvailable: false,
        },
        select: { id: true },
      }),
    ]);

    return {
      available: car.isAvailable && !bookingConflict && !blockedDate,
    };
  }

  async getCarReviews(
    carId: string,
    query: PaginationDto & CarReviewQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { carId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.review.count({ where: { carId } }),
    ]);

    return { data: items, total, page, limit };
  }

  async getReviewSummary() {
    const result = await this.prisma.review.aggregate({
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      averageRating: result._avg.rating ?? 0,
      totalReviews: result._count.rating,
    };
  }
}
