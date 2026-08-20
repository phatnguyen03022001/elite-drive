type RentalContractSource = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  pickupLocation: string;
  dropoffLocation: string;
  totalPrice: number;
};

function iso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function buildRentalContractContent(booking: RentalContractSource) {
  return [
    'ELITE DRIVE RENTAL AGREEMENT',
    '',
    `Booking ID: ${booking.id}`,
    `Rental start: ${iso(booking.startDate)}`,
    `Rental end: ${iso(booking.endDate)}`,
    `Pick-up: ${booking.pickupLocation}`,
    `Return: ${booking.dropoffLocation}`,
    `Recorded booking total: ${booking.totalPrice} VND`,
    '',
    'Customer acknowledgment',
    'The customer confirms the booking details above and agrees that the vehicle handover must not begin until this agreement has been acknowledged.',
    '',
    'This contract snapshot is generated from persisted booking data at payment confirmation time. Provider payment records and operational handover records remain the source of truth for money movement and vehicle condition.',
  ].join('\n');
}
