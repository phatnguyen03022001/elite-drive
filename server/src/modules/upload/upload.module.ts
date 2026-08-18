import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    {
      provide: 'CLOUDINARY',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return cloudinary.config({
          cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
          api_key: configService.get<string>('CLOUDINARY_API_KEY'),
          api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
        });
      },
    },
  ],
  exports: [UploadService, 'CLOUDINARY'],
})
export class UploadModule {}
