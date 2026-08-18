import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const imageUploadOptions: MulterOptions = {
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    const allowed = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype);
    callback(
      allowed ? null : new BadRequestException('Định dạng ảnh không hợp lệ'),
      allowed,
    );
  },
};
