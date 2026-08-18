import { BadRequestException } from '@nestjs/common';

export function assertVndAmount(
  amount: number,
  options: { min?: number; allowZero?: boolean; field?: string } = {},
): number {
  const { min = 0, allowZero = false, field = 'Số tiền' } = options;

  if (!Number.isSafeInteger(amount)) {
    throw new BadRequestException(`${field} phải là số nguyên VND hợp lệ`);
  }

  if ((!allowZero && amount <= 0) || amount < min) {
    throw new BadRequestException(`${field} không hợp lệ`);
  }

  return amount;
}

export function calculateVndPercent(amount: number, percent: number): number {
  assertVndAmount(amount, { field: 'Số tiền gốc' });
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new BadRequestException('Phần trăm không hợp lệ');
  }

  return Math.round((amount * percent) / 100);
}
