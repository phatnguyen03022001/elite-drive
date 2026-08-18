import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { OwnerController } from './owner.controller';
import { OwnerFinanceService } from './owner-finance.service';
import { OwnerService } from './owner.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [OwnerController],
  providers: [OwnerService, OwnerFinanceService],
  exports: [OwnerService, OwnerFinanceService],
})
export class OwnerModule {}
