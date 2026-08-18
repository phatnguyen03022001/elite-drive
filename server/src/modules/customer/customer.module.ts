import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { SecureCustomerService } from './secure-customer.service';

@Module({
  controllers: [CustomerController],
  providers: [
    SecureCustomerService,
    {
      provide: CustomerService,
      useExisting: SecureCustomerService,
    },
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
