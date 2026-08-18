import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CustomerBookingService } from './customer-booking.service';
import { CustomerCancellationService } from './customer-cancellation.service';
import { CustomerContractService } from './customer-contract.service';
import { CustomerController } from './customer.controller';
import { CustomerPaymentService } from './customer-payment.service';
import { CustomerPromotionService } from './customer-promotion.service';
import { CustomerReviewService } from './customer-review.service';
import { CustomerService } from './customer.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerPaymentService,
    CustomerBookingService,
    CustomerPromotionService,
    CustomerCancellationService,
    CustomerReviewService,
    CustomerContractService,
  ],
  exports: [
    CustomerService,
    CustomerPaymentService,
    CustomerBookingService,
    CustomerPromotionService,
    CustomerCancellationService,
    CustomerReviewService,
    CustomerContractService,
  ],
})
export class CustomerModule {}
