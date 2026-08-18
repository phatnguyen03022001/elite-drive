import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SecureAdminService } from './secure-admin.service';

// Controllers
import { AdminController } from './admin.controller';

// Shared

@Module({
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
