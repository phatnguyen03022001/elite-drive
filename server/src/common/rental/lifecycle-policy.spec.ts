import { BookingStatus, PaymentStatus, TripStatus } from '@prisma/client';
import {
  bookingAllowsPayment,
  bookingTripAllowsPreStartCancellation,
  evaluateFullRefundEligibility,
  paymentMatchesBookingAmount,
} from './lifecycle-policy';

describe('rental lifecycle policy', () => {
  it('allows payment only for approved bookings', () => {
    expect(bookingAllowsPayment(BookingStatus.APPROVED)).toBe(true);

    for (const status of [
      BookingStatus.PENDING,
      BookingStatus.REJECTED,
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ]) {
      expect(bookingAllowsPayment(status)).toBe(false);
    }
  });

  it('matches payment and booking amounts exactly', () => {
    expect(paymentMatchesBookingAmount(100000, 100000)).toBe(true);
    expect(paymentMatchesBookingAmount(99999, 100000)).toBe(false);
  });

  it('allows full refund for completed, unreleased payment before trip start', () => {
    expect(
      evaluateFullRefundEligibility({
        paymentStatus: PaymentStatus.COMPLETED,
        releasedAt: null,
        tripStatus: TripStatus.UPCOMING,
      }),
    ).toEqual({ eligible: true, reason: 'ELIGIBLE' });
    expect(
      evaluateFullRefundEligibility({
        paymentStatus: PaymentStatus.COMPLETED,
        releasedAt: null,
        tripStatus: undefined,
      }),
    ).toEqual({ eligible: true, reason: 'ELIGIBLE' });
  });

  it.each([
    [PaymentStatus.COMPLETED, new Date(), TripStatus.UPCOMING, 'PAYMENT_RELEASED'],
    [PaymentStatus.PENDING, null, TripStatus.UPCOMING, 'PAYMENT_NOT_COMPLETED'],
    [PaymentStatus.COMPLETED, null, TripStatus.ONGOING, 'TRIP_STARTED'],
    [PaymentStatus.COMPLETED, null, TripStatus.COMPLETED, 'TRIP_STARTED'],
  ])('rejects ineligible full refund state', (paymentStatus, releasedAt, tripStatus, reason) => {
    expect(
      evaluateFullRefundEligibility({
        paymentStatus,
        releasedAt,
        tripStatus,
      }),
    ).toEqual({ eligible: false, reason });
  });

  it('allows cancellation only for the existing booking and trip states', () => {
    for (const status of [
      BookingStatus.PENDING,
      BookingStatus.APPROVED,
      BookingStatus.CONFIRMED,
    ]) {
      expect(bookingTripAllowsPreStartCancellation(status, undefined)).toBe(true);
      expect(bookingTripAllowsPreStartCancellation(status, TripStatus.UPCOMING)).toBe(true);
    }

    for (const status of [
      BookingStatus.REJECTED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ]) {
      expect(bookingTripAllowsPreStartCancellation(status, TripStatus.UPCOMING)).toBe(false);
    }
    expect(
      bookingTripAllowsPreStartCancellation(BookingStatus.CONFIRMED, TripStatus.ONGOING),
    ).toBe(false);
    expect(
      bookingTripAllowsPreStartCancellation(BookingStatus.CONFIRMED, TripStatus.COMPLETED),
    ).toBe(false);
  });
});
