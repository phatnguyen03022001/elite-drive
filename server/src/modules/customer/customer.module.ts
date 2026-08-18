import { Module } from '@nestjs/common';
import { CustomerBookingService } from './customer-booking.service';
import { CustomerController } from './customer.controller';
import { CustomerPaymentService } from './customer-payment.service';
import { CustomerService } from './customer.service';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, CustomerPaymentService, CustomerBookingService],
  exports: [CustomerService, CustomerPaymentService, CustomerBookingService],
})
export class CustomerModule {}
