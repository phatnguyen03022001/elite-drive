import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { OwnerBookingService } from './owner-booking.service';
import { OwnerController } from './owner.controller';
import { OwnerDisputeService } from './owner-dispute.service';
import { OwnerFinanceService } from './owner-finance.service';
import { OwnerService } from './owner.service';
import { OwnerTripService } from './owner-trip.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [OwnerController],
  providers: [
    OwnerService,
    OwnerFinanceService,
    OwnerBookingService,
    OwnerTripService,
    OwnerDisputeService,
  ],
  exports: [
    OwnerService,
    OwnerFinanceService,
    OwnerBookingService,
    OwnerTripService,
    OwnerDisputeService,
  ],
})
export class OwnerModule {}
