import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminService } from './admin.service';
import { CustomerModule } from '../customer/customer.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [CustomerModule, PaymentModule],
  controllers: [AdminController],
  providers: [AdminService, AdminFinanceService],
  exports: [AdminService, AdminFinanceService],
})
export class AdminModule {}
