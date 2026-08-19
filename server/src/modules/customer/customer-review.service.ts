import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/customer.dto';

@Injectable()
export class CustomerReviewService {
  constructor(private readonly db: PrismaService) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    try {
      return await this.db.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: dto.bookingId },
          select: {
            id: true,
            customerId: true,
            carId: true,
            status: true,
          },
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

        // Serialize review creation on the booking document so concurrent requests
        // cannot both pass the duplicate check before inserting.
        const bookingLock = await tx.booking.updateMany({
          where: {
            id: booking.id,
            customerId: userId,
            status: BookingStatus.COMPLETED,
          },
          data: { updatedAt: new Date() },
        });
        if (bookingLock.count !== 1) {
          throw new ConflictException(
            'Booking vừa thay đổi; tải lại trước khi đánh giá',
          );
        }

        const existed = await tx.review.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
        });
        if (existed) {
          throw new BadRequestException('Booking này đã được đánh giá');
        }

        return tx.review.create({
          data: {
            userId,
            carId: booking.carId,
            bookingId: booking.id,
            rating: dto.rating,
            title: dto.title?.trim(),
            content: dto.content?.trim(),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Có đánh giá khác vừa được tạo cho booking này; vui lòng tải lại',
        );
      }
      throw error;
    }
  }
}
