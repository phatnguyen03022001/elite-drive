import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<string> {
    this.assertSafeImage(file);

    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 120);
    if (!safeFolder) {
      throw new BadRequestException('Thư mục upload không hợp lệ');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: safeFolder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result: UploadApiResponse) => {
          if (error || !result?.secure_url) {
            this.logger.error(
              'Cloudinary upload failed',
              error instanceof Error ? error.stack : undefined,
            );
            reject(
              new InternalServerErrorException(
                'Không thể upload ảnh lên Cloudinary',
              ),
            );
            return;
          }

          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private assertSafeImage(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File không hợp lệ');
    }

    if (file.size <= 0 || file.size > UploadService.MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh phải nhỏ hơn hoặc bằng 5MB');
    }

    if (!UploadService.ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG hoặc WebP');
    }

    const bytes = file.buffer;
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const isPng =
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    const isWebp =
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP';

    const signatureMatchesMime =
      (file.mimetype === 'image/jpeg' && isJpeg) ||
      (file.mimetype === 'image/png' && isPng) ||
      (file.mimetype === 'image/webp' && isWebp);

    if (!signatureMatchesMime) {
      throw new BadRequestException('Nội dung file không khớp định dạng ảnh');
    }
  }
}
