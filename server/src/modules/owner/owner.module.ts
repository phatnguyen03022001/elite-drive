import { Module } from '@nestjs/common';

import { OwnerService } from './owner.service';
import { SecureOwnerService } from './secure-owner.service';
import { OwnerController } from './owner.controller';

@Module({
  controllers: [OwnerController],
  providers: [
    SecureOwnerService,
    {
      provide: OwnerService,
      useExisting: SecureOwnerService,
    },
  ],
})
export class OwnerModule {}
