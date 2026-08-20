import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerBookingQueryDto, RejectBookingDto } from './dto/owner.dto';

@Injectable()
export class OwnerBookingService {
  constructor(private readonly db: PrismaService) {}

  async getBookings(ownerId: string, query: PaginationDto & OwnerBookingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.BookingWhereInput = {
      car: { ownerId },
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          car: { select: { name: true, licensePlate: true } },
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          payments: { select: { id: true, status: true, amount: true } },
        },
      }),
      this.db.booking.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  approveBooking(ownerId: string, bookingId: string) {
    return this.claimDecision(ownerId, bookingId, BookingStatus.APPROVED);
  }

  rejectBooking(ownerId: string, bookingId: string, dto: RejectBookingDto) {
    const reason =
      dto.reason?.trim() || 'Vehicle unavailable for the requested dates';
    return this.claimDecision(
      ownerId,
      bookingId,
      BookingStatus.REJECTED,
      reason,
    );
  }

  private async claimDecision(
    ownerId: string,
    bookingId: string,
    targetStatus: 'APPROVED' | 'REJECTED',
    decisionReason?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, car: { ownerId } },
        select: { id: true, status: true, promotionId: true },
      });
      if (!booking) {
        throw new NotFoundException(
          'Booking không tồn tại hoặc bạn không có quyền',
        );
      }
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException(
          `Không thể xử lý đơn đang ở trạng thái ${booking.status}`,
        );
      }

      const claim = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: BookingStatus.PENDING,
          car: { ownerId },
        },
        data: {
          status: targetStatus,
          ...(targetStatus === BookingStatus.REJECTED
            ? { decisionReason }
            : {}),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Booking đã được xử lý bởi một yêu cầu khác',
        );
      }

      if (
        targetStatus === BookingStatus.REJECTED &&
        booking.promotionId
      ) {
        await tx.promotion.updateMany({
          where: { id: booking.promotionId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: {
          car: { select: { name: true, licensePlate: true } },
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          payments: { select: { id: true, status: true, amount: true } },
        },
      });
    });
  }
}
