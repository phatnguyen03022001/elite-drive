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
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, car: { ownerId } },
      select: {
        id: true,
        status: true,
        booking: { select: { status: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip không tồn tại');
    if (trip.status !== 'UPCOMING') {
      throw new BadRequestException('Trip không ở trạng thái UPCOMING');
    }
    if (trip.booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking không còn ở trạng thái CONFIRMED');
    }

    const claim = await this.db.trip.updateMany({
      where: {
        id: tripId,
        status: 'UPCOMING',
        car: { ownerId },
        booking: { status: BookingStatus.CONFIRMED },
      },
      data: {
        status: 'ONGOING',
        pickupAt: new Date(),
        startOdometer: dto.startOdometer,
        startFuelLevel: dto.startFuelLevel,
        pickupNotes: dto.pickupNotes,
      },
    });
    if (claim.count !== 1) {
      throw new BadRequestException(
        'Trip hoặc booking vừa thay đổi; tải lại trước khi check-in',
      );
    }

    return this.db.trip.findUniqueOrThrow({ where: { id: tripId } });
  }

  async checkoutTrip(ownerId: string, tripId: string, dto: TripCheckoutDto) {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, car: { ownerId } },
      select: {
        id: true,
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

    const claim = await this.db.trip.updateMany({
      where: {
        id: tripId,
        status: 'ONGOING',
        car: { ownerId },
        booking: { status: BookingStatus.CONFIRMED },
      },
      data: {
        status: 'COMPLETED',
        dropoffAt: new Date(),
        endOdometer: dto.endOdometer,
        endFuelLevel: dto.endFuelLevel,
        dropoffNotes: dto.dropoffNotes,
      },
    });
    if (claim.count !== 1) {
      throw new BadRequestException(
        'Trip hoặc booking vừa thay đổi; tải lại trước khi checkout',
      );
    }

    return this.db.trip.findUniqueOrThrow({ where: { id: tripId } });
  }
}
