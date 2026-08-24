import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryUploadService } from './cloudinary-upload.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
    url: jest.fn(),
  },
}));

function configService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`missing ${key}`);
      return value;
    }),
  };
}

describe('CloudinaryUploadService', () => {
  afterEach(() => jest.clearAllMocks());

  it('configures the SDK and resolves the secure delivery URL', async () => {
    const config = configService({
      CLOUDINARY_ENABLED: 'true',
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
    });
    const uploadStream = cloudinary.uploader.upload_stream as unknown as jest.Mock;
    uploadStream.mockImplementation((options, callback) => ({
      end: (buffer: Buffer) => {
        expect(buffer).toEqual(Buffer.from('image'));
        expect(options).toEqual({
          resource_type: 'image',
          folder: 'elite-drive/cars',
        });
        callback(undefined, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/car.png',
        });
      },
    }));

    const service = new CloudinaryUploadService(config as never);

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'demo-cloud',
      api_key: 'api-key',
      api_secret: 'api-secret',
      secure: true,
    });
    await expect(service.uploadImage(Buffer.from('image'), 'cars')).resolves.toBe(
      'https://res.cloudinary.com/demo/image/upload/car.png',
    );
  });

  it('does not configure Cloudinary when the provider is disabled', () => {
    const service = new CloudinaryUploadService(
      configService({ CLOUDINARY_ENABLED: 'false' }) as never,
    );

    expect(service.isEnabled()).toBe(false);
    expect(cloudinary.config).not.toHaveBeenCalled();
  });

  it('uploads private images with authenticated delivery and signs them on access', async () => {
    const config = configService({
      CLOUDINARY_ENABLED: 'true',
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
    });
    const uploadStream = cloudinary.uploader.upload_stream as unknown as jest.Mock;
    uploadStream.mockImplementation((options, callback) => ({
      end: () => callback(undefined, {
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/authenticated/v123/elite-drive/customers/kyc/front/doc.png',
      }),
    }));
    const signedUrl = cloudinary.url as unknown as jest.Mock;
    signedUrl.mockReturnValue('https://res.cloudinary.com/demo/image/authenticated/s--signed--/v123/elite-drive/customers/kyc/front/doc.png');

    const service = new CloudinaryUploadService(config as never);
    await expect(service.uploadPrivateImage(Buffer.from('image'), 'customers/kyc/front')).resolves.toContain('/image/authenticated/');
    expect(uploadStream.mock.calls[0][0]).toEqual({
      resource_type: 'image',
      type: 'authenticated',
      folder: 'elite-drive/customers/kyc/front',
    });
    expect(service.resolvePrivateUrl('https://res.cloudinary.com/demo-cloud/image/authenticated/v123/elite-drive/customers/kyc/front/doc.png')).toContain('s--signed--');
    expect(signedUrl).toHaveBeenCalledWith('elite-drive/customers/kyc/front/doc', expect.objectContaining({
      type: 'authenticated',
      sign_url: true,
      version: 123,
      format: 'png',
    }));
  });

  it('classifies legacy public Cloudinary locators instead of signing them', () => {
    const service = new CloudinaryUploadService(configService({
      CLOUDINARY_ENABLED: 'true',
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
    }) as never);
    expect(service.classifyLocator('https://res.cloudinary.com/demo-cloud/image/upload/v1/elite-drive/customers/kyc/front/doc.png')).toBe('CLOUDINARY_LEGACY_PUBLIC');
  });
});
