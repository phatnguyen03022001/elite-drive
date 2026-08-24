import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export type MediaLocatorClassification =
  | 'LOCAL_PRIVATE_REFERENCE'
  | 'CLOUDINARY_AUTHENTICATED'
  | 'CLOUDINARY_LEGACY_PUBLIC'
  | 'UNKNOWN';

@Injectable()
export class CloudinaryUploadService {
  private readonly enabled: boolean;
  private readonly cloudName?: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('CLOUDINARY_ENABLED') === 'true';
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!this.enabled) return;

    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  uploadImage(buffer: Buffer, folder: string): Promise<string> {
    return this.upload(buffer, folder);
  }

  uploadPrivateImage(buffer: Buffer, folder: string): Promise<string> {
    return this.upload(buffer, folder, 'authenticated');
  }

  classifyLocator(locator: string): MediaLocatorClassification {
    if (/^\/api\/upload\/files\/(?:customers|owners)\/kyc\//.test(locator)) {
      return 'LOCAL_PRIVATE_REFERENCE';
    }
    try {
      const parsed = new URL(locator);
      if (parsed.hostname !== 'res.cloudinary.com') return 'UNKNOWN';
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (this.cloudName && segments[0] !== this.cloudName) return 'UNKNOWN';
      const deliveryIndex = segments[1] === 'image' ? 2 : -1;
      if (deliveryIndex < 0) return 'UNKNOWN';
      const deliveryType = segments[deliveryIndex];
      const assetStart = deliveryIndex + 1 + (segments[deliveryIndex + 1]?.startsWith('v') ? 1 : 0);
      const assetPath = segments.slice(assetStart).join('/');
      const isKycAsset = /^elite-drive\/(customers|owners)\/kyc\/(front|back|faces)\/[^/]+$/.test(assetPath);
      if (deliveryType === 'authenticated' && isKycAsset) return 'CLOUDINARY_AUTHENTICATED';
      if (deliveryType === 'upload' && assetPath.includes('elite-drive/')) return 'CLOUDINARY_LEGACY_PUBLIC';
    } catch {
      return 'UNKNOWN';
    }
    return 'UNKNOWN';
  }

  resolvePrivateUrl(locator: string): string {
    const classification = this.classifyLocator(locator);
    if (classification === 'LOCAL_PRIVATE_REFERENCE') return locator;
    if (classification === 'CLOUDINARY_LEGACY_PUBLIC') {
      throw new ServiceUnavailableException('KYC media requires provider migration');
    }
    if (classification !== 'CLOUDINARY_AUTHENTICATED') {
      throw new NotFoundException('KYC media is unavailable');
    }

    const parsed = new URL(locator);
    const match = parsed.pathname.match(/\/image\/authenticated\/(?:v(\d+)\/)?(.+)$/);
    if (!match) throw new NotFoundException('KYC media is unavailable');
    const path = match[2];
    const extensionIndex = path.lastIndexOf('.');
    const publicId = extensionIndex > -1 ? path.slice(0, extensionIndex) : path;
    const format = extensionIndex > -1 ? path.slice(extensionIndex + 1) : undefined;
    return cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      version: match[1] ? Number(match[1]) : undefined,
      format,
      secure: true,
      sign_url: true,
    });
  }

  private upload(
    buffer: Buffer,
    folder: string,
    type?: 'authenticated',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          ...(type ? { type } : {}),
          folder: `elite-drive/${folder}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result?.secure_url) {
            reject(new Error('Cloudinary response did not include secure_url'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
