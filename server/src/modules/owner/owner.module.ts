import { Module } from '@nestjs/common';
import { OwnerController } from './owner.controller';
import { OwnerFinanceService } from './owner-finance.service';
import { OwnerService } from './owner.service';

@Module({
  controllers: [OwnerController],
  providers: [OwnerService, OwnerFinanceService],
  exports: [OwnerService, OwnerFinanceService],
})
export class OwnerModule {}
