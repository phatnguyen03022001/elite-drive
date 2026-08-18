import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CustomerBookingService } from './customer-booking.service';
import { CustomerController } from './customer.controller';
import { CustomerPaymentService } from './customer-payment.service';
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
  providers: [CustomerService, CustomerPaymentService, CustomerBookingService],
  exports: [CustomerService, CustomerPaymentService, CustomerBookingService],
})
export class CustomerModule {}
