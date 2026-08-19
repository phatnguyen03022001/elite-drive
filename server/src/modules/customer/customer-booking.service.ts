import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CarStatus,
  KYCStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/customer.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CREATE_ATTEMPTS = 3;

@Injectable()
export class CustomerBookingService {
  constructor(private readonly db: PrismaService) {}

  async createBooking(userId: string, dto: CreateBookingDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    if (startDate < todayUtc) {
      throw new BadRequestException('Không thể tạo booking trong quá khứ');
    }

    for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.db.$transaction(async (tx) => {
          const kyc = await tx.kYC.findUnique({
            where: { userId },
            select: { status: true },
          });
          if (!kyc || kyc.status !== KYCStatus.APPROVED) {
            throw new ForbiddenException(
              'Bạn cần hoàn tất xác thực danh tính (KYC) để đặt xe',
            );
          }

          const car = await tx.car.findFirst({
            where: {
              id: dto.carId,
              status: CarStatus.APPROVED,
              verificationStatus: VerificationStatus.APPROVED,
              isAvailable: true,
            },
            select: {
              id: true,
              pricePerDay: true,
              location: {
                select: { name: true, address: true, city: true },
              },
            },
          });
          if (!car) {
            throw new NotFoundException(
              'Xe không tồn tại hoặc chưa sẵn sàng để nhận booking',
            );
          }
          if (!car.location) {
            throw new BadRequestException(
              'Xe chưa được cấu hình địa điểm giao nhận',
            );
          }

          // Serialize competing booking transactions on the same car document.
          // A concurrent writer receives a transaction conflict; the retry then
          // observes the booking committed by the winner before inserting.
          await tx.car.update({
            where: { id: car.id },
            data: { updatedAt: new Date() },
            select: { id: true },
          });

          const bookingConflict = await tx.booking.findFirst({
            where: {
              carId: car.id,
              status: {
                notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED],
              },
              AND: [
                { startDate: { lt: endDate } },
                { endDate: { gt: startDate } },
              ],
            },
            select: { id: true },
          });
          if (bookingConflict) {
            throw new ConflictException(
              'Xe đã được đặt trong khoảng thời gian này',
            );
          }

          const blocked = await tx.availability.findFirst({
            where: {
              carId: car.id,
              date: { gte: startDate, lt: endDate },
              isAvailable: false,
            },
            select: { id: true },
          });
          if (blocked) {
            throw new ConflictException(
              'Xe không khả dụng trong khoảng thời gian này',
            );
          }

          if (!Number.isSafeInteger(car.pricePerDay) || car.pricePerDay <= 0) {
            throw new BadRequestException(
              'Giá thuê xe phải là số nguyên VND dương trước khi nhận booking',
            );
          }

          const days = Math.max(
            1,
            Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS),
          );
          const totalPrice = days * car.pricePerDay;
          if (!Number.isSafeInteger(totalPrice)) {
            throw new BadRequestException('Tổng tiền booking vượt giới hạn an toàn');
          }

          const bookingLocation = [
            car.location.name,
            car.location.address,
            car.location.city,
          ]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(', ');

          return tx.booking.create({
            data: {
              customerId: userId,
              carId: car.id,
              startDate,
              endDate,
              pickupLocation: bookingLocation,
              dropoffLocation: bookingLocation,
              notes: dto.notes?.trim() || undefined,
              totalPrice,
              status: BookingStatus.PENDING,
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < MAX_CREATE_ATTEMPTS) continue;
          throw new ConflictException(
            'Có booking khác vừa thay đổi lịch xe, vui lòng thử lại',
          );
        }
        throw error;
      }
    }

    throw new ConflictException('Không thể giữ lịch xe, vui lòng thử lại');
  }
}
