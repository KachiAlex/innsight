import { prisma } from '../../src/utils/prisma';
import { createAuditLog } from '../../src/utils/audit';

describe('createAuditLog', () => {
  it('stores the entry unattributed when the actor no longer exists', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Audit Fallback Tenant',
        slug: 'audit-fallback-tenant',
        email: 'audit-fallback@test.local',
      },
    });

    // Simulates a request authenticated by a JWT whose user row was deleted.
    await createAuditLog({
      tenantId: tenant.id,
      userId: '00000000-0000-0000-0000-000000000000',
      action: 'stale_user_action',
      entityType: 'tenant',
      entityId: tenant.id,
    });

    const audit = await prisma.audit.findFirst({
      where: { tenantId: tenant.id, action: 'stale_user_action' },
    });

    expect(audit).not.toBeNull();
    expect(audit?.userId).toBeNull();
  });

  it('stores the entry attributed when the user exists', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Audit Attributed Tenant',
        slug: 'audit-attributed-tenant',
        email: 'audit-attributed@test.local',
      },
    });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'audit-user@test.local',
        passwordHash: 'not-a-real-hash',
        firstName: 'Audit',
        lastName: 'User',
        role: 'owner',
        isActive: true,
      },
    });

    await createAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: 'attributed_action',
      entityType: 'tenant',
      entityId: tenant.id,
    });

    const audit = await prisma.audit.findFirst({
      where: { tenantId: tenant.id, action: 'attributed_action' },
    });

    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(user.id);
  });
});
