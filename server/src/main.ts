import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppSwaggerConfig } from './config/swagger/swagger.module';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Elite Drive API')
    .setDescription('Elite Drive marketplace API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  app.getHttpAdapter().get('/docs-json', (_req, res) => {
    res.json(swaggerDocument);
  });

  AppSwaggerConfig.setup(app);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

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

  const port = Number(process.env.APP_PORT ?? 8000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Elite Drive API listening on port ${port}`);
}

bootstrap();
