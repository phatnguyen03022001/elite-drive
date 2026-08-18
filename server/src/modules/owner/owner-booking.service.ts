import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerBookingQueryDto, RejectBookingDto } from './dto/owner.dto';

@Injectable()
export class OwnerBookingService {
  constructor(private readonly db: PrismaService) {}

  async getBookings(
    ownerId: string,
    query: PaginationDto & OwnerBookingQueryDto,
  ) {
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
    return this.claimDecision(
      ownerId,
      bookingId,
      BookingStatus.REJECTED,
      dto.reason,
    );
  }

  private async claimDecision(
    ownerId: string,
    bookingId: string,
    targetStatus: BookingStatus.APPROVED | BookingStatus.REJECTED,
    reason?: string,
  ) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId, car: { ownerId } },
      select: { id: true, status: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại hoặc bạn không có quyền');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Không thể xử lý đơn đang ở trạng thái ${booking.status}`,
      );
    }

    const claim = await this.db.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.PENDING,
        car: { ownerId },
      },
      data: {
        status: targetStatus,
        ...(targetStatus === BookingStatus.REJECTED && reason
          ? { notes: reason.trim() }
          : {}),
      },
    });
    if (claim.count !== 1) {
      throw new BadRequestException(
        'Booking đã được xử lý bởi một yêu cầu khác',
      );
    }

    return this.db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        car: { select: { name: true, licensePlate: true } },
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
  }
}
