import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SignContractDto } from './dto/customer.dto';

@Injectable()
export class CustomerContractService {
  constructor(private readonly db: PrismaService) {}

  async getContract(userId: string, bookingId: string) {
    const contract = await this.db.contract.findFirst({
      where: { bookingId, booking: { customerId: userId } },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  async signContract(userId: string, bookingId: string, dto: SignContractDto) {
    return this.db.$transaction(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: { bookingId, booking: { customerId: userId } },
        include: {
          booking: {
            select: {
              status: true,
              trip: { select: { status: true } },
            },
          },
        },
      });
      if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
      if (contract.booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException(
          'Chỉ có thể ký hợp đồng cho booking đã thanh toán và xác nhận',
        );
      }
      if (
        contract.booking.trip?.status === 'ONGOING' ||
        contract.booking.trip?.status === 'COMPLETED'
      ) {
        throw new BadRequestException(
          'Không thể ký hoặc thay đổi chữ ký sau khi chuyến đi đã bắt đầu',
        );
      }
      if (contract.customerSignedAt) {
        return contract;
      }

      const claim = await tx.contract.updateMany({
        where: {
          id: contract.id,
          bookingId,
          customerSignedAt: null,
        },
        data: {
          customerSignedAt: new Date(),
          customerSignature: dto.signatureData,
          status: 'SIGNED',
        },
      });
      if (claim.count !== 1) {
        const signed = await tx.contract.findUnique({ where: { id: contract.id } });
        if (signed?.customerSignedAt) return signed;
        throw new BadRequestException('Hợp đồng vừa thay đổi, vui lòng tải lại');
      }

      return tx.contract.findUniqueOrThrow({ where: { id: contract.id } });
    });
  }
}
