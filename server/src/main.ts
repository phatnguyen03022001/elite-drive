import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppSwaggerConfig } from './config/swagger/swagger.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { PrismaService } from './prisma/prisma.service';

const bootstrapLogger = new Logger('Bootstrap');

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
  bootstrapLogger.log(`Elite Drive API listening on port ${port}`);
}

void bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    'Application bootstrap failed',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
