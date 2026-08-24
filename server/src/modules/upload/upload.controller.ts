import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { imageUploadOptions } from '../../common/upload/image-upload-options';
import { UploadService } from './upload.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Upload')
@Controller('api/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'cars');
    return { url };
  }

  @Get('files/customers/kyc/*path')
  async getCustomerKycFile(@Param('path') path: string | string[], @Req() request: any, @Res() response: Response): Promise<void> {
    await this.sendAuthorizedKycFile(path, request.user, response);
  }

  @Get('files/owners/kyc/*path')
  async getOwnerKycFile(@Param('path') path: string | string[], @Req() request: any, @Res() response: Response): Promise<void> {
    await this.sendAuthorizedKycFile(path, request.user, response);
  }

  @Public()
  @Get('files/cars/*path')
  async getCarFile(@Param('path') path: string | string[], @Res() response: Response): Promise<void> {
    if (UploadService.isPrivateKycPath(['cars', ...(Array.isArray(path) ? path : [path])])) throw new NotFoundException('Không tìm thấy file');
    const filePath = await this.uploadService.resolvePublicFile(path);
    response.sendFile(filePath);
  }

  @Public()
  @Get('files/avatars/*path')
  async getAvatarFile(@Param('path') path: string | string[], @Res() response: Response): Promise<void> {
    if (UploadService.isPrivateKycPath(['avatars', ...(Array.isArray(path) ? path : [path])])) throw new NotFoundException('Không tìm thấy file');
    const filePath = await this.uploadService.resolvePublicFile(path);
    response.sendFile(filePath);
  }

  @Get('files/*path')
  async getFile(
    @Param('path') path: string | string[],
    @Req() request: any,
    @Res() response: Response,
  ): Promise<void> {
    if (UploadService.isPrivateKycPath(path)) {
      await this.sendAuthorizedKycFile(path, request.user, response);
      return;
    }
    const filePath = await this.uploadService.resolvePublicFile(path);
    response.sendFile(filePath);
  }

  private async sendAuthorizedKycFile(path: string | string[], user: { id: string; role: UserRole }, response: Response): Promise<void> {
    const parts = Array.isArray(path) ? path : [path];
    const cleanPath = parts.join('/');
    const base = this.configService.get<string>('UPLOAD_PUBLIC_BASE_URL') || '/api/upload/files';
    const reference = `${base}/${cleanPath}`;
    const kyc = await this.prisma.kYC.findFirst({
      where: {
        OR: [
          { documentFrontUrl: reference },
          { documentBackUrl: reference },
          { faceImageUrl: reference },
        ],
      },
      select: { userId: true, user: { select: { role: true } } },
    });
    if (!kyc || (user.role !== UserRole.ADMIN && (kyc.userId !== user.id || kyc.user.role !== user.role))) {
      throw new NotFoundException('Không tìm thấy file');
    }
    const filePath = await this.uploadService.resolvePublicFile(path);
    response.sendFile(filePath);
  }
}
