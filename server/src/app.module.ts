import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';
import { validateEnvironment } from './config/env-contract';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { MailModule } from './modules/mail/mail.module';
import { OwnerModule } from './modules/owner/owner.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PublicModule } from './modules/public/public.module';
import { UploadModule } from './modules/upload/upload.module';
import { PrismaModule } from './prisma/prisma.module';

const LOCAL_PLATFORM_USER_ID = '000000000000000000000001';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
      load: [
        () => ({
          PLATFORM_USER_ID:
            process.env.PLATFORM_USER_ID ||
            (process.env.NODE_ENV !== 'production'
              ? LOCAL_PLATFORM_USER_ID
              : undefined),
        }),
      ],
    }),
    PrismaModule,
    AuthModule,
    CustomerModule,
    OwnerModule,
    AdminModule,
    PaymentModule,
    MailModule,
    PublicModule,
    UploadModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfOriginGuard,
    },
  ],
})
export class AppModule {}
