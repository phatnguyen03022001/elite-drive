import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import {
  buildTrustedOrigins,
  isTrustedFrontendOrigin,
} from './common/security/trusted-origins';
import { PrismaService } from './prisma/prisma.service';

const bootstrapLogger = new Logger('Bootstrap');
const MAX_REQUEST_TARGET_LENGTH = 4_096;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);

  try {
    await prismaService.$connect();
    bootstrapLogger.log('Database connection established');
  } catch (error) {
    bootstrapLogger.error(
      'Database connection failed; refusing to start an unhealthy API process',
      error instanceof Error ? error.stack : String(error),
    );
    await app.close();
    throw error;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestTarget = req.originalUrl || req.url || '';
    if (requestTarget.length > MAX_REQUEST_TARGET_LENGTH) {
      res.status(414).json({
        success: false,
        message: 'Request target quá dài',
      });
      return;
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const { AppSwaggerConfig } = await import('./config/swagger/swagger.module');
    AppSwaggerConfig.setup(app);
  }

  app.useGlobalPipes(GlobalValidationPipe);

  const trustedOrigins = buildTrustedOrigins(
    process.env.FRONTEND_URL,
    process.env.ALLOW_VERCEL_PREVIEWS === 'true',
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isTrustedFrontendOrigin(origin, trustedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS Error: Origin not allowed'));
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Accept',
  });

  const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8000);
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.log(`Elite Drive API listening on port ${port}`);
}

void bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    'Application bootstrap failed',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
