import { prisma } from './prisma';

interface RoomLogInput {
  tenantId: string;
  roomId: string;
  type: string;
  summary: string;
  details?: string | null;
  metadata?: Record<string, any> | null;
  user?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export async function createRoomLog({
  tenantId,
  roomId,
  type,
  summary,
  details = null,
  metadata = null,
  user = null,
}: RoomLogInput) {
  if (!tenantId || !roomId || !type || !summary) {
    return;
  }

  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }

  const createdAt = new Date();
  const log = await prisma.roomLog.create({
    data: {
      tenantId,
      roomId,
      type,
      summary,
      details,
      metadata: metadata || undefined,
      userId: user?.id || null,
      userName: user?.name || null,
      createdAt,
    },
  });

  try {
    await prisma.room.update({
      where: { id: roomId },
      data: {
        lastLogType: type,
        lastLogSummary: summary,
        lastLogUserName: user?.name || null,
        lastLogAt: createdAt,
      },
    });
  } catch (error) {
    console.warn(`Failed to update room ${roomId} last log metadata:`, error);
  }

  return {
    id: log.id,
    tenantId: log.tenantId,
    roomId: log.roomId,
    type: log.type,
    summary: log.summary,
    details: log.details,
    metadata: log.metadata,
    user: user
      ? {
          id: user.id || null,
          name: user.name || null,
        }
      : null,
    createdAt: log.createdAt,
  };
}

