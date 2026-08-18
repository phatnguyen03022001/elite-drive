import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminController } from './admin.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminPaymentReconciliationController } from './admin-payment-reconciliation.controller';
import { AdminPromotionService } from './admin-promotion.service';
import { AdminWalletReconciliationController } from './admin-wallet-reconciliation.controller';
import { AdminService } from './admin.service';
import { CustomerModule } from '../customer/customer.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    CustomerModule,
    PaymentModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [
    AdminController,
    AdminPaymentReconciliationController,
    AdminWalletReconciliationController,
  ],
  providers: [AdminService, AdminFinanceService, AdminPromotionService],
  exports: [AdminService, AdminFinanceService, AdminPromotionService],
})
export class AdminModule {}
