import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { GlobalValidationPipe } from '../../src/common/pipes/validation.pipe';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MomoGatewayService } from '../../src/modules/payment/momo-gateway.service';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function assertSafeIntegrationDatabase(): URL {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration database must be a local test database');
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('Integration database must be a local test database');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Integration database must be a local test database');
  }

  const databaseName = url.pathname.replace(/^\//, '');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (
    url.protocol !== 'mongodb:' ||
    !LOCAL_HOSTS.has(hostname) ||
    !/(test|integration)/i.test(databaseName) ||
    url.searchParams.get('replicaSet') !== 'rs0'
  ) {
    throw new Error('Integration database must be a local test database');
  }

  return url;
}

export function assertSafeDatabaseAuthority() {
  return assertSafeIntegrationDatabase();
}

export async function resetIntegrationDatabase(prisma: PrismaService) {
  assertSafeIntegrationDatabase();
  const collectionsResult = (await prisma.$runCommandRaw({
    listCollections: 1,
    nameOnly: true,
  })) as {
    cursor?: { firstBatch?: Array<{ name?: string }> };
  };

  for (const collection of collectionsResult.cursor?.firstBatch ?? []) {
    const name = collection.name;
    if (!name || name.startsWith('system.')) continue;

    await prisma.$runCommandRaw({
      delete: name,
      deletes: [{ q: {}, limit: 0 }],
    });
  }
}

export async function createIntegrationApp(
  momoGateway?: Partial<MomoGatewayService>,
): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  assertSafeIntegrationDatabase();
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (momoGateway) {
    moduleBuilder.overrideProvider(MomoGatewayService).useValue(momoGateway);
  }
  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(GlobalValidationPipe);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
