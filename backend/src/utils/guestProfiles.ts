import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

export const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? null;

export const normalizePhone = (phone?: string | null) =>
  phone?.replace(/[^0-9+]/g, '').trim() ?? null;

type GuestProfileInput = {
  tenantId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export const upsertGuestProfile = async ({
  tenantId,
  name,
  email,
  phone,
}: GuestProfileInput) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const guestName = name?.trim() || 'Guest';
  const contactFilters: Prisma.GuestWhereInput[] = [];
  if (normalizedEmail) {
    contactFilters.push({ email: normalizedEmail });
  }
  if (normalizedPhone) {
    contactFilters.push({ phone: normalizedPhone });
  }

  let existingGuest = await prisma.guest.findFirst({
    where: {
      tenantId,
      ...(contactFilters.length ? { OR: contactFilters } : {}),
    },
  });

  if (existingGuest) {
    const updates: Prisma.GuestUpdateInput = {};
    if (guestName && guestName !== existingGuest.name) {
      updates.name = guestName;
    }
    if (normalizedEmail && !existingGuest.email) {
      updates.email = normalizedEmail;
    }
    if (normalizedPhone && !existingGuest.phone) {
      updates.phone = normalizedPhone;
    }

    if (Object.keys(updates).length > 0) {
      existingGuest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: updates,
      });
    }

    return existingGuest;
  }

  return prisma.guest.create({
    data: {
      tenantId,
      name: guestName,
      email: normalizedEmail,
      phone: normalizedPhone,
    },
  });
};
