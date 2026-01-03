import { db, now, toDate } from './firestore';
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

  if (prisma) {
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

  const logRef = db.collection('roomLogs').doc();
  const logData = {
    tenantId,
    roomId,
    type,
    summary,
    details,
    metadata: metadata || null,
    user: user
      ? {
          id: user.id || null,
          name: user.name || null,
        }
      : null,
    createdAt: now(),
  };

  await logRef.set(logData);

  try {
    await db.collection('rooms').doc(roomId).update({
      lastLogType: type,
      lastLogSummary: summary,
      lastLogUserName: user?.name || null,
      lastLogAt: logData.createdAt,
    });
  } catch (error) {
    console.warn(`Failed to update room ${roomId} last log metadata:`, error);
  }

  return {
    id: logRef.id,
    ...logData,
    createdAt: toDate(logData.createdAt),
  };
}

