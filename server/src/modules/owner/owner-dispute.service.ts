import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOwnerDisputeDto } from './dto/owner-dispute.dto';

@Injectable()
export class OwnerDisputeService {
  constructor(private readonly db: PrismaService) {}

  async create(ownerId: string, dto: CreateOwnerDisputeDto) {
    const booking = dto.bookingId
      ? await this.db.booking.findFirst({
          where: { id: dto.bookingId, car: { ownerId } },
          select: { id: true },
        })
      : null;

    if (dto.bookingId && !booking) {
      throw new ForbiddenException(
        'Booking không thuộc đội xe của tài khoản hiện tại',
      );
    }

    const type = dto.type.trim().toUpperCase();
    const title = dto.title.trim();
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Nội dung hỗ trợ không được để trống');
    }

    return this.db.dispute.create({
      data: {
        bookingId: booking?.id ?? null,
        initiatedBy: ownerId,
        title: `[${type}] ${title}`,
        description,
        status: DisputeStatus.OPEN,
      },
    });
  }

  getVisibleDisputes(ownerId: string) {
    return this.db.dispute.findMany({
      where: {
        OR: [
          { initiatedBy: ownerId },
          { booking: { car: { ownerId } } },
        ],
      },
      include: {
        initiator: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            car: { select: { id: true, name: true, licensePlate: true } },
          },
        },
        disputeMessages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, senderId: true, message: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(userId: string, disputeId: string, message: string) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      throw new BadRequestException('Nội dung phản hồi không được để trống');
    }

    return this.db.$transaction(async (tx) => {
      const dispute = await tx.dispute.findFirst({
        where: {
          id: disputeId,
          OR: [
            { initiatedBy: userId },
            { booking: { car: { ownerId: userId } } },
          ],
        },
        select: { id: true, status: true },
      });
      if (!dispute) {
        throw new ForbiddenException(
          'Dispute không tồn tại hoặc bạn không có quyền',
        );
      }
      if (
        dispute.status !== DisputeStatus.OPEN &&
        dispute.status !== DisputeStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Dispute đã được giải quyết hoặc đóng, không thể phản hồi thêm',
        );
      }

      const claim = await tx.dispute.updateMany({
        where: {
          id: dispute.id,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_PROGRESS] },
        },
        data:
          dispute.status === DisputeStatus.OPEN
            ? { status: DisputeStatus.IN_PROGRESS }
            : { updatedAt: new Date() },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Dispute vừa thay đổi trạng thái, vui lòng tải lại',
        );
      }

      return tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: userId,
          message: normalizedMessage,
        },
      });
    });
  }
}
