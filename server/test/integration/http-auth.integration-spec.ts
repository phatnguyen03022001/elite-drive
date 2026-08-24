import request from 'supertest';
import { createIntegrationApp, resetIntegrationDatabase } from './test-database';
import { IDS, PASSWORD, seedCar, seedUsers } from './fixtures';

describe('real Nest HTTP authentication composition', () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp());
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
    await seedUsers(prisma);
    await seedCar(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('proves readiness reaches the real Mongo database', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: 'ready', database: 'ok' });
      });
  });

  it('rejects unauthenticated access, accepts customer cookie, and denies owner role', async () => {
    await request(app.getHttpServer()).get('/api/customer/profile').expect(401);

    const customer = request.agent(app.getHttpServer());
    const login = await customer
      .post('/api/auth/login')
      .send({ email: 'integration.customer@example.com', password: PASSWORD })
      .expect(201);
    const cookies = login.headers['set-cookie'] as string[];
    expect(cookies.some((cookie) => cookie.startsWith('token='))).toBe(true);

    await customer
      .get('/api/customer/profile')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.email).toBe('integration.customer@example.com');
        expect(body.data.id).toBe(IDS.customer);
      });

    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/login')
      .send({ email: 'integration.owner@example.com', password: PASSWORD })
      .expect(201);
    await owner.get('/api/customer/profile').expect(403);
  });
});
