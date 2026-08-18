import { BadRequestException } from '@nestjs/common';
import { assertVndAmount, calculateVndPercent } from './vnd';

describe('VND money invariants', () => {
  it('accepts safe integer VND amounts', () => {
    expect(assertVndAmount(1000, { min: 1000 })).toBe(1000);
  });

  it('rejects fractional and unsafe amounts', () => {
    expect(() => assertVndAmount(1000.5)).toThrow(BadRequestException);
    expect(() => assertVndAmount(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      BadRequestException,
    );
  });

  it('allows zero only when explicitly requested', () => {
    expect(() => assertVndAmount(0)).toThrow(BadRequestException);
    expect(assertVndAmount(0, { allowZero: true })).toBe(0);
  });

  it('calculates percentage output as integer VND', () => {
    expect(calculateVndPercent(100001, 20)).toBe(20000);
    expect(Number.isSafeInteger(calculateVndPercent(100001, 20))).toBe(true);
  });
});
