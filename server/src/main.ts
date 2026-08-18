import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppSwaggerConfig } from './config/swagger/swagger.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  try {
    const prismaService = app.get(PrismaService);
    await prismaService.$connect();
    logger.log('Database connection established');
  } catch (error) {
    logger.error('Database connection failed', error);
  }

  if (process.env.NODE_ENV !== 'production') {
    AppSwaggerConfig.setup(app);
  }

  app.useGlobalPipes(GlobalValidationPipe);

  const configuredFrontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = new Set(
    [
      'https://elite-drive-iota.vercel.app',
      'http://localhost:3000',
      configuredFrontendUrl,
    ].filter((origin): origin is string => Boolean(origin)),
  );
  const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (allowVercelPreviews && origin.endsWith('.vercel.app'))
      ) {
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
  logger.log(`Elite Drive API listening on port ${port}`);
}

bootstrap();
