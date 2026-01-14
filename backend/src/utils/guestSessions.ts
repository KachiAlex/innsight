import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

type GuestInfo = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

type EnsureGuestSessionOptions = {
  tenantId: string;
  sessionToken?: string;
  guest?: GuestInfo;
};

type MetadataPatch = Record<string, unknown>;

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TTL_MS = Number(process.env.GUEST_SESSION_TTL_MS ?? DEFAULT_SESSION_TTL_MS);

const buildGuestMetadata = (guest?: GuestInfo) => {
  if (!guest) {
    return undefined;
  }

  const guestInfo = Object.fromEntries(
    Object.entries({
      guestId: guest.id,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
    }).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  if (Object.keys(guestInfo).length === 0) {
    return undefined;
  }

  return {
    guestInfo,
  };
};

const mergeMetadata = (existing: Prisma.JsonValue | null | undefined, patch?: MetadataPatch) => {
  if (!patch || Object.keys(patch).length === 0) {
    return existing ?? Prisma.JsonNull;
  }

  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Prisma.JsonObject)
      : {};

  return {
    ...base,
    ...patch,
  };
};

export const ensureGuestSession = async ({
  tenantId,
  sessionToken,
  guest,
}: EnsureGuestSessionOptions): Promise<{ sessionToken: string; isNew: boolean }> => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const metadataPatch = buildGuestMetadata(guest);

  const existingSessionToken = sessionToken?.trim() || undefined;

  if (existingSessionToken) {
    const existing = await prisma.guestSession.findUnique({
      where: { sessionToken: existingSessionToken },
    });

    if (existing && existing.tenantId === tenantId) {
      if (existing.expiresAt <= now || existing.status === 'expired') {
        await prisma.guestSession.update({
          where: { sessionToken: existingSessionToken },
          data: {
            status: 'expired',
            updatedAt: now,
          },
        });
      } else {
        await prisma.guestSession.update({
          where: { sessionToken: existingSessionToken },
          data: {
            lastActivityAt: now,
            expiresAt,
            ...(guest?.id && !existing.guestId ? { guestId: guest.id } : {}),
            metadata: mergeMetadata(existing.metadata, metadataPatch),
          },
        });
        return { sessionToken: existingSessionToken, isNew: false };
      }
    }
  }

  const newToken = uuidv4();

  await prisma.guestSession.create({
    data: {
      tenantId,
      sessionToken: newToken,
      guestId: guest?.id ?? null,
      reservationId: null,
      expiresAt,
      lastActivityAt: now,
      status: 'active',
      metadata: metadataPatch ?? Prisma.JsonNull,
    },
  });

  return { sessionToken: newToken, isNew: true };
};

export const markSessionConverted = async (sessionToken: string, reservationId: string) => {
  if (!sessionToken || !prisma) {
    return;
  }

  await prisma.guestSession.updateMany({
    where: { sessionToken },
    data: {
      reservationId,
      status: 'converted',
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      metadata: mergeMetadata(null, { lastReservationId: reservationId }),
    },
  });
};

export const updateGuestSessionMetadata = async (
  sessionToken: string,
  metadataPatch: MetadataPatch
) => {
  if (!sessionToken || !metadataPatch || Object.keys(metadataPatch).length === 0 || !prisma) {
    return;
  }

  const session = await prisma.guestSession.findUnique({
    where: { sessionToken },
  });

  if (!session) {
    return;
  }

  await prisma.guestSession.update({
    where: { sessionToken },
    data: {
      metadata: mergeMetadata(session.metadata, metadataPatch),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
};
