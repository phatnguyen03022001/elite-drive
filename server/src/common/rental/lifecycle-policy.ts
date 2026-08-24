import { BookingStatus, PaymentStatus, TripStatus } from '@prisma/client';

export function bookingAllowsPayment(status: BookingStatus): boolean {
  return status === BookingStatus.APPROVED;
}

export function paymentMatchesBookingAmount(
  paymentAmount: number,
  bookingAmount: number,
): boolean {
  return paymentAmount === bookingAmount;
}

type FullRefundEligibilityReason =
  | 'ELIGIBLE'
  | 'PAYMENT_NOT_COMPLETED'
  | 'PAYMENT_RELEASED'
  | 'TRIP_STARTED';

export function evaluateFullRefundEligibility(input: {
  paymentStatus: PaymentStatus;
  releasedAt?: Date | null;
  tripStatus?: TripStatus | null;
}): { eligible: boolean; reason: FullRefundEligibilityReason } {
  if (input.paymentStatus !== PaymentStatus.COMPLETED) {
    return { eligible: false, reason: 'PAYMENT_NOT_COMPLETED' };
  }
  if (input.releasedAt) {
    return { eligible: false, reason: 'PAYMENT_RELEASED' };
  }
  if (
    input.tripStatus === TripStatus.ONGOING ||
    input.tripStatus === TripStatus.COMPLETED
  ) {
    return { eligible: false, reason: 'TRIP_STARTED' };
  }
  return { eligible: true, reason: 'ELIGIBLE' };
}

type PreStartCancellationEligibilityReason =
  | 'ELIGIBLE'
  | 'BOOKING_NOT_CANCELLABLE'
  | 'TRIP_STARTED';

export function evaluatePreStartCancellationEligibility(
  bookingStatus: BookingStatus,
  tripStatus?: TripStatus | null,
): {
  eligible: boolean;
  reason: PreStartCancellationEligibilityReason;
} {
  if (
    tripStatus === TripStatus.ONGOING ||
    tripStatus === TripStatus.COMPLETED
  ) {
    return { eligible: false, reason: 'TRIP_STARTED' };
  }

  const bookingCanBeCancelled = new Set<BookingStatus>([
    BookingStatus.PENDING,
    BookingStatus.APPROVED,
    BookingStatus.CONFIRMED,
  ]).has(bookingStatus);
  if (!bookingCanBeCancelled) {
    return { eligible: false, reason: 'BOOKING_NOT_CANCELLABLE' };
  }
  return { eligible: true, reason: 'ELIGIBLE' };
}
