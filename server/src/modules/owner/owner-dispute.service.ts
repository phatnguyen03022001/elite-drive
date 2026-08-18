import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnerDisputeService {
  constructor(private readonly db: PrismaService) {}

  async respond(userId: string, disputeId: string, message: string) {
    return this.db.$transaction(async (tx) => {
      const dispute = await tx.dispute.findFirst({
        where: {
          id: disputeId,
          booking: { car: { ownerId: userId } },
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
          message: message.trim(),
        },
      });
    });
  }
}
