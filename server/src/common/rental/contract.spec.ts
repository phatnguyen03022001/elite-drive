import { buildRentalContractContent } from './contract';

describe('buildRentalContractContent', () => {
  it('creates a deterministic booking snapshot without external services', () => {
    const content = buildRentalContractContent({
      id: 'booking-1',
      startDate: new Date('2026-08-21T00:00:00.000Z'),
      endDate: new Date('2026-08-23T00:00:00.000Z'),
      pickupLocation: 'District 1',
      dropoffLocation: 'District 1',
      totalPrice: 2000000,
    });

    expect(content).toContain('Booking ID: booking-1');
    expect(content).toContain('2000000 VND');
    expect(content).toContain('2026-08-21T00:00:00.000Z');
  });
});
