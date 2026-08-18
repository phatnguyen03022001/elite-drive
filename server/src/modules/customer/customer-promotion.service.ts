import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';

const MIN_PAYABLE_VND = 1000;

@Injectable()
export class CustomerPromotionService {
  constructor(private readonly db: PrismaService) {}

  async getActivePromotions() {
    const now = new Date();
    return this.db.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyPromotion(userId: string, bookingId: string, promoCode: string) {
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          customerId: userId,
          status: BookingStatus.PENDING,
          promotionId: null,
        },
      });
      if (!booking) {
        throw new NotFoundException(
          'Booking không tồn tại, đã có khuyến mãi hoặc không còn có thể áp dụng mã',
        );
      }
      assertVndAmount(booking.totalPrice, {
        min: MIN_PAYABLE_VND,
        field: 'Tổng tiền booking',
      });

      const promotion = await tx.promotion.findUnique({
        where: { code: promoCode.trim().toUpperCase() },
      });
      if (!promotion) {
        throw new NotFoundException('Mã khuyến mãi không tồn tại');
      }

      const now = new Date();
      if (
        !promotion.isActive ||
        promotion.startDate > now ||
        promotion.endDate < now
      ) {
        throw new BadRequestException('Mã khuyến mãi không còn hiệu lực');
      }
      if (promotion.maxUses !== null && promotion.maxUses <= 0) {
        throw new BadRequestException('Mã khuyến mãi có giới hạn sử dụng không hợp lệ');
      }
      if (promotion.minBookingAmount !== null) {
        assertVndAmount(promotion.minBookingAmount, {
          allowZero: true,
          field: 'Giá trị booking tối thiểu',
        });
        if (booking.totalPrice < promotion.minBookingAmount) {
          throw new BadRequestException(
            `Booking tối thiểu ${promotion.minBookingAmount} VND`,
          );
        }
      }

      let requestedDiscount: number;
      if (promotion.discountType === 'PERCENTAGE') {
        if (
          !Number.isFinite(promotion.discountValue) ||
          promotion.discountValue <= 0 ||
          promotion.discountValue > 100
        ) {
          throw new BadRequestException('Phần trăm khuyến mãi không hợp lệ');
        }
        requestedDiscount = Math.round(
          (booking.totalPrice * promotion.discountValue) / 100,
        );
      } else if (promotion.discountType === 'FIXED') {
        assertVndAmount(promotion.discountValue, {
          field: 'Giá trị khuyến mãi cố định',
        });
        requestedDiscount = promotion.discountValue;
      } else {
        throw new BadRequestException('Loại khuyến mãi không được hỗ trợ');
      }

      const maximumDiscount = booking.totalPrice - MIN_PAYABLE_VND;
      const discountAmount = Math.min(requestedDiscount, maximumDiscount);
      assertVndAmount(discountAmount, {
        allowZero: true,
        field: 'Số tiền giảm giá',
      });
      const finalPrice = booking.totalPrice - discountAmount;
      assertVndAmount(finalPrice, {
        min: MIN_PAYABLE_VND,
        field: 'Giá sau khuyến mãi',
      });

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: booking.id,
          customerId: userId,
          status: BookingStatus.PENDING,
          promotionId: null,
          totalPrice: booking.totalPrice,
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

      const promotionClaim = await tx.promotion.updateMany({
        where: {
          id: promotion.id,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          ...(promotion.maxUses !== null
            ? { usedCount: { lt: promotion.maxUses } }
            : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (promotionClaim.count !== 1) {
        throw new BadRequestException(
          'Mã khuyến mãi vừa hết lượt hoặc không còn hiệu lực',
        );
      }

      return {
        originalPrice: booking.totalPrice,
        discountAmount,
        finalPrice,
        promoCode: promotion.code,
      };
    });
  }
}
