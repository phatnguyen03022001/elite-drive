import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryUploadService } from './cloudinary-upload.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
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
});
