import { Module } from '@nestjs/common';
import { MomoController } from './momo.controller';
import { MomoGatewayService } from './momo-gateway.service';
import { PaymentService } from './payment.service';

@Module({
  controllers: [MomoController],
  providers: [MomoGatewayService, PaymentService],
  exports: [MomoGatewayService, PaymentService],
})
export class PaymentModule {}
