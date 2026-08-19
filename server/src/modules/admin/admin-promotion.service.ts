import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePromotionDto,
  PromotionQueryDto,
  UpdatePromotionDto,
} from './dto/admin.dto';

type PromotionDefinition = {
  discountType: string;
  discountValue: number;
  maxUses?: number | null;
  minBookingAmount?: number | null;
  startDate: Date;
  endDate: Date;
};

@Injectable()
export class AdminPromotionService {
  constructor(private readonly db: PrismaService) {}

  async create(dto: CreatePromotionDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertDefinition({
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxUses: dto.maxUses,
      minBookingAmount: dto.minBookingAmount,
      startDate,
      endDate,
    });

    try {
      return await this.db.promotion.create({
        data: {
          code: this.normalizeCode(dto.code),
          description: dto.description?.trim(),
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          maxUses: dto.maxUses,
          minBookingAmount: dto.minBookingAmount,
          startDate,
          endDate,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Mã khuyến mãi đã tồn tại');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const current = await this.db.promotion.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Khuyến mãi không tồn tại');

    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    const definition: PromotionDefinition = {
      discountType: dto.discountType ?? current.discountType,
      discountValue: dto.discountValue ?? current.discountValue,
      maxUses: dto.maxUses !== undefined ? dto.maxUses : current.maxUses,
      minBookingAmount:
        dto.minBookingAmount !== undefined
          ? dto.minBookingAmount
          : current.minBookingAmount,
      startDate,
      endDate,
    };
    this.assertDefinition(definition);

    try {
      return await this.db.promotion.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.discountType !== undefined
            ? { discountType: dto.discountType }
            : {}),
          ...(dto.discountValue !== undefined
            ? { discountValue: dto.discountValue }
            : {}),
          ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
          ...(dto.minBookingAmount !== undefined
            ? { minBookingAmount: dto.minBookingAmount }
            : {}),
          ...(dto.startDate !== undefined ? { startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Mã khuyến mãi đã tồn tại');
      }
      throw error;
    }
  }

  getAll(query: PromotionQueryDto) {
    return this.db.promotion.findMany({
      where: {
        isActive:
          query.isActive !== undefined
            ? String(query.isActive) === 'true'
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertDefinition(definition: PromotionDefinition) {
    if (
      Number.isNaN(definition.startDate.getTime()) ||
      Number.isNaN(definition.endDate.getTime()) ||
      definition.startDate >= definition.endDate
    ) {
      throw new BadRequestException('Khoảng thời gian khuyến mãi không hợp lệ');
    }

    if (definition.maxUses !== null && definition.maxUses !== undefined) {
      if (!Number.isSafeInteger(definition.maxUses) || definition.maxUses < 1) {
        throw new BadRequestException('maxUses phải là số nguyên dương');
      }
    }
    if (
      definition.minBookingAmount !== null &&
      definition.minBookingAmount !== undefined
    ) {
      assertVndAmount(definition.minBookingAmount, {
        allowZero: true,
        field: 'Giá trị booking tối thiểu',
      });
    }

    if (definition.discountType === 'PERCENTAGE') {
      if (
        !Number.isFinite(definition.discountValue) ||
        definition.discountValue <= 0 ||
        definition.discountValue > 100
      ) {
        throw new BadRequestException('Phần trăm giảm phải lớn hơn 0 và tối đa 100');
      }
      return;
    }
    if (definition.discountType === 'FIXED') {
      assertVndAmount(definition.discountValue, {
        field: 'Giá trị giảm cố định',
      });
      return;
    }
    throw new BadRequestException('Loại khuyến mãi không được hỗ trợ');
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalized)) {
      throw new BadRequestException(
        'Mã khuyến mãi phải dài 3-40 ký tự và chỉ gồm A-Z, 0-9, _ hoặc -',
      );
    }
    return normalized;
  }
}
