import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/customer.dto';

@Injectable()
export class CustomerSupportService {
  constructor(private readonly db: PrismaService) {}

  async createDispute(userId: string, dto: CreateDisputeDto) {
    const booking = dto.bookingId
      ? await this.db.booking.findFirst({
          where: { id: dto.bookingId, customerId: userId },
          select: { id: true },
        })
      : null;

    if (dto.bookingId && !booking) {
      throw new ForbiddenException('Booking không thuộc tài khoản hiện tại');
    }

    const type = dto.type.trim().toUpperCase();
    const title = dto.title.trim();
    return this.db.dispute.create({
      data: {
        bookingId: booking?.id ?? null,
        initiatedBy: userId,
        title: `[${type}] ${title}`,
        description: dto.description.trim(),
        status: 'OPEN',
      },
    });
  }

  getMyDisputes(userId: string) {
    return this.db.dispute.findMany({
      where: { initiatedBy: userId },
      include: {
        booking: { select: { car: { select: { name: true } } } },
        disputeMessages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, senderId: true, message: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
