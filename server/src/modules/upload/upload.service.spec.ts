import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CloudinaryUploadService } from './cloudinary-upload.service';
import { UploadService } from './upload.service';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function imageFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'car.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

function createService(options?: {
  cloudinaryEnabled?: boolean;
  uploadImage?: jest.Mock;
  uploadDir?: string;
}) {
  const values: Record<string, string> = {
    UPLOAD_DIR: options?.uploadDir ?? 'uploads-test',
    UPLOAD_PUBLIC_BASE_URL: '/api/upload/files',
  };
  const configService = {
    get: jest.fn((key: string) => values[key]),
  };
  const cloudinaryUploadService = {
    isEnabled: jest.fn(() => options?.cloudinaryEnabled ?? false),
    uploadImage: options?.uploadImage ?? jest.fn(),
  };

  return {
    service: new UploadService(
      configService as never,
      cloudinaryUploadService as unknown as CloudinaryUploadService,
    ),
    cloudinaryUploadService,
  };
}

describe('UploadService', () => {
  it('uses local filesystem storage when Cloudinary is disabled', async () => {
    const uploadDir = `uploads-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { service } = createService({ uploadDir });

    try {
      const url = await service.uploadFile(imageFile(), 'cars');
      expect(url).toMatch(/^\/api\/upload\/files\/cars\/[a-f0-9-]+\.png$/);
      const relative = url.replace('/api/upload/files/', '');
      await expect(access(join(process.cwd(), uploadDir, relative))).resolves.toBeUndefined();
    } finally {
      await rm(join(process.cwd(), uploadDir), { recursive: true, force: true });
    }
  });

  it('returns the Cloudinary secure URL when Cloudinary is enabled', async () => {
    const uploadImage = jest.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/car.png');
    const { service } = createService({ cloudinaryEnabled: true, uploadImage });

    await expect(service.uploadFile(imageFile(), 'cars')).resolves.toBe(
      'https://res.cloudinary.com/demo/image/upload/car.png',
    );
    expect(uploadImage).toHaveBeenCalledWith(png, 'cars');
  });

  it('maps provider failures to a safe service-unavailable error', async () => {
    const uploadImage = jest.fn().mockRejectedValue(new Error('sensitive-provider-detail'));
    const { service } = createService({ cloudinaryEnabled: true, uploadImage });

    let thrown: unknown;
    try {
      await service.uploadFile(imageFile(), 'cars');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as Error).message).toBe(
      'Không thể tải ảnh lên Cloudinary lúc này',
    );
    expect((thrown as Error).message).not.toContain('sensitive-provider-detail');
  });

  it('validates image content before calling Cloudinary', async () => {
    const uploadImage = jest.fn();
    const { service } = createService({ cloudinaryEnabled: true, uploadImage });
    const invalid = imageFile({ buffer: Buffer.from('not-a-png'), size: 9 });

    await expect(service.uploadFile(invalid, 'cars')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('resolves nested public files when Express 5 supplies wildcard segments as an array', async () => {
    const uploadDir = `uploads-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { service } = createService({ uploadDir });
    const relativePath = join('cars', 'nested.png');
    const absolutePath = join(process.cwd(), uploadDir, relativePath);

    try {
      await mkdir(join(process.cwd(), uploadDir, 'cars'), { recursive: true });
      await writeFile(absolutePath, png);

      await expect(
        service.resolvePublicFile(['cars', 'nested.png'] as never),
      ).resolves.toBe(absolutePath);
    } finally {
      await rm(join(process.cwd(), uploadDir), { recursive: true, force: true });
    }
  });
});
