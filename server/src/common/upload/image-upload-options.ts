import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FORM_FIELD_BYTES = 64 * 1024;
const MAX_FORM_FIELD_NAME_BYTES = 100;
const MAX_FORM_FIELDS = 24;
const MAX_FORM_FILES = 3;
const MAX_MULTIPART_PARTS = MAX_FORM_FIELDS + MAX_FORM_FILES;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const imageUploadOptions: MulterOptions = {
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_FORM_FILES,
    fields: MAX_FORM_FIELDS,
    parts: MAX_MULTIPART_PARTS,
    fieldNameSize: MAX_FORM_FIELD_NAME_BYTES,
    fieldSize: MAX_FORM_FIELD_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype);
    callback(
      allowed ? null : new BadRequestException('Định dạng ảnh không hợp lệ'),
      allowed,
    );
  },
};
