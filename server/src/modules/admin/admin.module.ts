import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SecureAdminService } from './secure-admin.service';
import { AdminController } from './admin.controller';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [CustomerModule],
  controllers: [AdminController],
  providers: [
    SecureAdminService,
    {
      provide: AdminService,
      useExisting: SecureAdminService,
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
