import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize, resolve, sep } from 'node:path';

@Injectable()
export class UploadService {
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  constructor(private readonly configService: ConfigService) {}

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<string> {
    this.assertSafeImage(file);

    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 120);
    if (!safeFolder) {
      throw new BadRequestException('Thư mục upload không hợp lệ');
    }

    const targetDir = join(this.uploadRoot(), safeFolder);
    await mkdir(targetDir, { recursive: true });

    const extension = this.extensionFor(file.mimetype, file.originalname);
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(targetDir, filename), file.buffer, { flag: 'wx' });

    const publicBase = this.configService.get<string>('UPLOAD_PUBLIC_BASE_URL') || '/api/upload/files';
    return `${publicBase}/${safeFolder}/${filename}`;
  }

  async resolvePublicFile(relativePath: string): Promise<string> {
    const root = resolve(this.uploadRoot());
    const clean = normalize(relativePath).replace(/^([/\\])+/, '');
    const candidate = resolve(root, clean);

    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      throw new BadRequestException('Đường dẫn file không hợp lệ');
    }

    try {
      await access(candidate);
      return candidate;
    } catch {
      throw new NotFoundException('Không tìm thấy file');
    }
  }

  private uploadRoot(): string {
    const configured = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
    return join(process.cwd(), configured);
  }

  private extensionFor(mimetype: string, originalName: string): string {
    if (mimetype === 'image/jpeg') return '.jpg';
    if (mimetype === 'image/png') return '.png';
    if (mimetype === 'image/webp') return '.webp';
    return extname(originalName).toLowerCase();
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
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';

    const signatureMatchesMime =
      (file.mimetype === 'image/jpeg' && isJpeg) ||
      (file.mimetype === 'image/png' && isPng) ||
      (file.mimetype === 'image/webp' && isWebp);

    if (!signatureMatchesMime) {
      throw new BadRequestException('Nội dung file không khớp định dạng ảnh');
    }
  }
}
