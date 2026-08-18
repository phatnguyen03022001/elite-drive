import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerPaymentService } from './customer-payment.service';
import { CustomerService } from './customer.service';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, CustomerPaymentService],
  exports: [CustomerService, CustomerPaymentService],
})
export class CustomerModule {}
