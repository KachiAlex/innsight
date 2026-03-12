import request from 'supertest';
import { app } from '../../src/index';
import { authHeader } from '../helpers/auth';
import { prismaTestClient } from '../utils/prismaTestClient';

const buildTenantPayload = (overrides: Record<string, any> = {}) => {
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);

  return {
    name: `Test Hotel ${uniqueSuffix}`,
    slug: `test-hotel-${uniqueSuffix}`,
    email: `contact+${uniqueSuffix}@example.com`,
    phone: '+1234567890',
    address: '123 Test Street',
    ownerEmail: `owner+${uniqueSuffix}@example.com`,
    ownerPassword: 'SecurePass123!',
    ownerFirstName: 'Ada',
    ownerLastName: 'Lovelace',
    ...overrides,
  };
};

describe('Tenant creation flow (POST /api/tenants)', () => {
  it('creates tenant and owner user via Prisma', async () => {
    const payload = buildTenantPayload();

    const response = await request(app)
      .post('/api/tenants')
      .set(authHeader({ role: 'iitech_admin' }))
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      name: payload.name,
      slug: payload.slug,
      email: payload.email,
      subscriptionStatus: 'active',
    });

    const tenantInDb = await prismaTestClient.tenant.findUnique({
      where: { slug: payload.slug },
    });
    expect(tenantInDb).not.toBeNull();
    expect(tenantInDb?.email).toBe(payload.email);

    const ownerUser = await prismaTestClient.user.findFirst({
      where: {
        tenantId: tenantInDb!.id,
        role: 'owner',
      },
    });
    expect(ownerUser).not.toBeNull();
    expect(ownerUser?.email).toBe(payload.ownerEmail);
    expect(ownerUser?.firstName).toBe(payload.ownerFirstName);
  });

  it('rejects duplicate tenant slugs with a 400 error', async () => {
    const sharedSlug = `dupe-slug-${Date.now()}`;

    const firstPayload = buildTenantPayload({ slug: sharedSlug });
    await request(app)
      .post('/api/tenants')
      .set(authHeader({ role: 'iitech_admin' }))
      .send(firstPayload)
      .expect(201);

    const secondPayload = buildTenantPayload({
      slug: sharedSlug,
      ownerEmail: `second-owner+${Date.now()}@example.com`,
    });

    const duplicateResponse = await request(app)
      .post('/api/tenants')
      .set(authHeader({ role: 'iitech_admin' }))
      .send(secondPayload)
      .expect(400);

    expect(duplicateResponse.body.success).toBe(false);
    expect(duplicateResponse.body.error?.message).toMatch(/slug already exists/i);
  });
});
