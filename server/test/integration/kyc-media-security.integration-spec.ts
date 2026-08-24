import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { KYCStatus, UserRole, VerificationStatus } from '@prisma/client';
import { createIntegrationApp, resetIntegrationDatabase } from './test-database';
import { PASSWORD } from './fixtures';

const ids = {
  customer: '507f1f77bcf86cd799439201',
  customerTwo: '507f1f77bcf86cd799439202',
  owner: '507f1f77bcf86cd799439203',
  ownerTwo: '507f1f77bcf86cd799439204',
  admin: '507f1f77bcf86cd799439205',
};
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('real HTTP KYC media access contract', () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];
  const uploadRoot = join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  const customerUrl = '/api/upload/files/customers/kyc/front/customer.png';
  const ownerUrl = '/api/upload/files/owners/kyc/front/owner.png';
  const carUrl = '/api/upload/files/cars/main/car.png';
  const galleryUrl = '/api/upload/files/cars/gallery/gallery.png';
  const avatarUrl = '/api/upload/files/avatars/avatar.png';

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(201);
    return agent;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp());
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
    const password = await bcrypt.hash(PASSWORD, 4);
    await prisma.user.createMany({
      data: [
        { id: ids.customer, email: 'kyc.customer@example.com', password, role: UserRole.CUSTOMER, isActive: true, isVerified: true, verificationStatus: VerificationStatus.APPROVED },
        { id: ids.customerTwo, email: 'kyc.customer.two@example.com', password, role: UserRole.CUSTOMER, isActive: true, isVerified: true, verificationStatus: VerificationStatus.APPROVED },
        { id: ids.owner, email: 'kyc.owner@example.com', password, role: UserRole.OWNER, isActive: true, isVerified: true, verificationStatus: VerificationStatus.APPROVED },
        { id: ids.ownerTwo, email: 'kyc.owner.two@example.com', password, role: UserRole.OWNER, isActive: true, isVerified: true, verificationStatus: VerificationStatus.APPROVED },
        { id: ids.admin, email: 'kyc.admin@example.com', password, role: UserRole.ADMIN, isActive: true, isVerified: true, verificationStatus: VerificationStatus.APPROVED },
      ],
    });
    await prisma.kYC.createMany({
      data: [
        { userId: ids.customer, status: KYCStatus.APPROVED, documentFrontUrl: customerUrl },
        { userId: ids.owner, status: KYCStatus.APPROVED, documentFrontUrl: ownerUrl },
      ],
    });
    await mkdir(join(uploadRoot, 'customers/kyc/front'), { recursive: true });
    await mkdir(join(uploadRoot, 'owners/kyc/front'), { recursive: true });
    await mkdir(join(uploadRoot, 'cars/main'), { recursive: true });
    await mkdir(join(uploadRoot, 'cars/gallery'), { recursive: true });
    await mkdir(join(uploadRoot, 'avatars'), { recursive: true });
    await writeFile(join(uploadRoot, 'customers/kyc/front/customer.png'), png);
    await writeFile(join(uploadRoot, 'owners/kyc/front/owner.png'), png);
    await writeFile(join(uploadRoot, 'cars/main/car.png'), png);
    await writeFile(join(uploadRoot, 'cars/gallery/gallery.png'), png);
    await writeFile(join(uploadRoot, 'avatars/avatar.png'), png);
  });

  afterEach(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies anonymous KYC access while preserving public car and avatar access', async () => {
    await request(app.getHttpServer()).get(customerUrl).expect(401);
    await request(app.getHttpServer()).get(carUrl).expect(200).expect(png);
    await request(app.getHttpServer()).get(galleryUrl).expect(200).expect(png);
    await request(app.getHttpServer()).get(avatarUrl).expect(200).expect(png);
  });

  it('enforces persisted ownership and admin access for customer and owner KYC', async () => {
    const customer = await login('kyc.customer@example.com');
    const customerTwo = await login('kyc.customer.two@example.com');
    const owner = await login('kyc.owner@example.com');
    const ownerTwo = await login('kyc.owner.two@example.com');
    const admin = await login('kyc.admin@example.com');

    await customer.get(customerUrl).expect(200).expect(png);
    await customerTwo.get(customerUrl).expect(404);
    await owner.get(customerUrl).expect(404);
    await owner.get(ownerUrl).expect(200).expect(png);
    await ownerTwo.get(ownerUrl).expect(404);
    await admin.get(customerUrl).expect(200).expect(png);
    await admin.get(ownerUrl).expect(200).expect(png);
  });

  it('cannot serve an orphan KYC file or bypass the protected namespace through traversal', async () => {
    await writeFile(join(uploadRoot, 'customers/kyc/front/orphan.png'), png);
    await request(app.getHttpServer()).get('/api/upload/files/customers/kyc/front/orphan.png').expect((response) => {
      expect([401, 404]).toContain(response.status);
    });
    await request(app.getHttpServer()).get('/api/upload/files/customers/kyc/%2e%2e/%2e%2e/outside.txt').expect((response) => {
      expect([400, 401, 404]).toContain(response.status);
    });
  });
});
