import { Prisma } from '@prisma/client';
import { prismaTestClient } from '../utils/prismaTestClient';
import { v4 as uuidv4 } from 'uuid';

type TenantCreateInput = Prisma.TenantCreateInput;
type UserCreateInput = Prisma.UserUncheckedCreateInput;
type RoomCreateInput = Prisma.RoomUncheckedCreateInput;

export const createTenant = async (overrides: Partial<TenantCreateInput> = {}) => {
  const data: TenantCreateInput = {
    name: 'Test Hotel',
    slug: `test-hotel-${uuidv4()}`,
    email: 'contact@test-hotel.com',
    phone: '+1234567890',
    address: '123 Test Street',
    subscriptionStatus: 'active',
    ...overrides,
  };

  return prismaTestClient.tenant.create({
    data,
  });
};

export const createUser = async (
  tenantId: string,
  overrides: Partial<UserCreateInput> = {}
) => {
  const data: UserCreateInput = {
    tenantId,
    email: overrides.email || `staff-${uuidv4()}@example.com`,
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    role: 'owner',
    isActive: true,
    ...overrides,
  };

  return prismaTestClient.user.create({
    data,
  });
};

export const createRoom = async (
  tenantId: string,
  overrides: Partial<RoomCreateInput> = {}
) => {
  const data: RoomCreateInput = {
    tenantId,
    roomNumber: overrides.roomNumber || `10${Math.floor(Math.random() * 90) + 10}`,
    roomType: 'deluxe',
    maxOccupancy: 2,
    status: 'available',
    amenities: { wifi: true },
    ...overrides,
  };

  return prismaTestClient.room.create({
    data,
  });
};

export const setupTenantUserAndRoom = async () => {
  const tenant = await createTenant();
  const user = await createUser(tenant.id);
  const room = await createRoom(tenant.id);

  return { tenant, user, room };
};
