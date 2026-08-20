import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { TripCheckinDto, TripCheckoutDto } from './dto/owner.dto';

@Injectable()
export class OwnerTripService {
  constructor(private readonly db: PrismaService) {}

  async getTrips(ownerId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.TripWhereInput = { car: { ownerId } };
    const [data, total] = await Promise.all([
      this.db.trip.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          booking: {
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
              contract: { select: { status: true, customerSignedAt: true } },
            },
          },
          car: { select: { id: true, name: true, licensePlate: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.trip.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async checkinTrip(ownerId: string, tripId: string, dto: TripCheckinDto) {
    return this.db.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({
        where: { id: tripId, car: { ownerId } },
        select: {
          id: true,
          bookingId: true,
          status: true,
          booking: {
            select: {
              status: true,
              contract: { select: { customerSignedAt: true } },
            },
          },
        },
      });
      if (!trip) throw new NotFoundException('Trip không tồn tại');
      if (trip.status !== 'UPCOMING') {
        throw new BadRequestException('Trip không ở trạng thái UPCOMING');
      }
      if (trip.booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Booking không còn ở trạng thái CONFIRMED');
      }
      if (!trip.booking.contract?.customerSignedAt) {
        throw new BadRequestException(
          'Khách hàng phải ký hợp đồng trước khi bàn giao xe',
        );
      }

      const bookingLock = await tx.booking.updateMany({
        where: { id: trip.bookingId, status: BookingStatus.CONFIRMED },
        data: { updatedAt: new Date() },
      });
      if (bookingLock.count !== 1) {
        throw new BadRequestException(
          'Booking vừa thay đổi; tải lại trước khi check-in',
        );
      }

      const claim = await tx.trip.updateMany({
        where: { id: tripId, status: 'UPCOMING' },
        data: {
          status: 'ONGOING',
          checkinTime: new Date(),
          startOdometer: dto.startOdometer,
          startFuelLevel: dto.startFuelLevel,
          pickupNotes: dto.pickupNotes,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Trip vừa thay đổi; tải lại trước khi check-in',
        );
      }

      return tx.trip.findUniqueOrThrow({ where: { id: tripId } });
    });
  }

  async checkoutTrip(ownerId: string, tripId: string, dto: TripCheckoutDto) {
    return this.db.$transaction(async (tx) => {
      const trip = await tx.trip.findFirst({
        where: { id: tripId, car: { ownerId } },
        select: {
          id: true,
          bookingId: true,
          status: true,
          startOdometer: true,
          booking: { select: { status: true } },
        },
      });
      if (!trip) throw new NotFoundException('Trip không tồn tại');
      if (trip.status !== 'ONGOING') {
        throw new BadRequestException('Trip không ở trạng thái ONGOING');
      }
      if (trip.booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Booking không còn ở trạng thái CONFIRMED');
      }
      if (
        trip.startOdometer !== null &&
        dto.endOdometer < trip.startOdometer
      ) {
        throw new BadRequestException(
          'Odometer khi trả xe không thể nhỏ hơn lúc nhận xe',
        );
      }

      const bookingLock = await tx.booking.updateMany({
        where: { id: trip.bookingId, status: BookingStatus.CONFIRMED },
        data: { updatedAt: new Date() },
      });
      if (bookingLock.count !== 1) {
        throw new BadRequestException(
          'Booking vừa thay đổi; tải lại trước khi checkout',
        );
      }

      const claim = await tx.trip.updateMany({
        where: { id: tripId, status: 'ONGOING' },
        data: {
          status: 'COMPLETED',
          checkoutTime: new Date(),
          endOdometer: dto.endOdometer,
          endFuelLevel: dto.endFuelLevel,
          dropoffNotes: dto.dropoffNotes,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Trip vừa thay đổi; tải lại trước khi checkout',
        );
      }

      const bookingComplete = await tx.booking.updateMany({
        where: { id: trip.bookingId, status: BookingStatus.CONFIRMED },
        data: { status: BookingStatus.COMPLETED },
      });
      if (bookingComplete.count !== 1) {
        throw new BadRequestException(
          'Không thể đồng bộ trạng thái booking sau khi trả xe',
        );
      }

      return tx.trip.findUniqueOrThrow({ where: { id: tripId } });
    });
  }
}
