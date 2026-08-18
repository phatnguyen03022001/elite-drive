import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminController } from './admin.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminPaymentReconciliationController } from './admin-payment-reconciliation.controller';
import { AdminPromotionService } from './admin-promotion.service';
import { AdminRefundService } from './admin-refund.service';
import { AdminSettlementService } from './admin-settlement.service';
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
  providers: [
    AdminService,
    AdminFinanceService,
    AdminPromotionService,
    AdminRefundService,
    AdminSettlementService,
  ],
  exports: [
    AdminService,
    AdminFinanceService,
    AdminPromotionService,
    AdminRefundService,
    AdminSettlementService,
  ],
})
export class AdminModule {}
