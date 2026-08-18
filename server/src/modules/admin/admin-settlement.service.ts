import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SettlementStatus,
  UserRole,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RunSettlementDto,
  SettlementHistoryQueryDto,
} from './dto/admin.dto';

@Injectable()
export class AdminSettlementService {
  constructor(private readonly db: PrismaService) {}

  async run(dto: RunSettlementDto) {
    const owners = await this.db.user.findMany({
      where: {
        role: UserRole.OWNER,
        ...(dto.ownerId ? { id: dto.ownerId } : {}),
      },
      select: { id: true },
    });
    if (dto.ownerId && owners.length === 0) {
      throw new NotFoundException('Owner không tồn tại');
    }

    const ownerIds = owners.map((owner) => owner.id);
    const { start, end } = this.periodRange(dto.period);
    const [earningRows, payoutRows] = await Promise.all([
      this.db.ownerTransaction.groupBy({
        by: ['ownerId'],
        where: {
          ownerId: { in: ownerIds },
          type: 'RENTAL_INCOME',
          status: 'completed',
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      this.db.ownerTransaction.groupBy({
        by: ['ownerId'],
        where: {
          ownerId: { in: ownerIds },
          type: 'WITHDRAW',
          status: 'completed',
          OR: [
            { processedAt: { gte: start, lt: end } },
            {
              processedAt: null,
              updatedAt: { gte: start, lt: end },
            },
            {
              processedAt: { isSet: false },
              updatedAt: { gte: start, lt: end },
            },
          ],
        },
        _sum: { amount: true },
      }),
    ]);

    const earningsByOwner = new Map(
      earningRows.map((row) => [row.ownerId, row._sum.amount ?? 0]),
    );
    const payoutsByOwner = new Map(
      payoutRows.map((row) => [row.ownerId, row._sum.amount ?? 0]),
    );

    let created = 0;
    let skipped = 0;

    for (const owner of owners) {
      const totalEarnings = earningsByOwner.get(owner.id) ?? 0;
      const totalPayouts = payoutsByOwner.get(owner.id) ?? 0;
      assertVndAmount(totalEarnings, {
        allowZero: true,
        field: 'Tổng thu nhập settlement',
      });
      assertVndAmount(totalPayouts, {
        allowZero: true,
        field: 'Tổng payout settlement',
      });

      const netAmount = totalEarnings - totalPayouts;
      if (!Number.isSafeInteger(netAmount)) {
        throw new BadRequestException('Net settlement không phải số nguyên VND an toàn');
      }

      const settlementId = createHash('sha256')
        .update(`settlement:${owner.id}:${dto.period}`)
        .digest('hex')
        .slice(0, 24);

      try {
        await this.db.settlement.create({
          data: {
            id: settlementId,
            ownerId: owner.id,
            period: dto.period,
            totalEarnings,
            totalPayouts,
            netAmount,
            status: SettlementStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
        created += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    return { success: true, created, skipped };
  }

  async getHistory(query: PaginationDto & SettlementHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SettlementWhereInput = {
      period: query.period,
      status: query.status,
      ownerId: query.ownerId,
    };

    const [items, total] = await Promise.all([
      this.db.settlement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.db.settlement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private periodRange(period: string) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
    if (!match) {
      throw new BadRequestException('period phải có dạng YYYY-MM');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }
}
