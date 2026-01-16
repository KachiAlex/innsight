import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate, snapshotToArray } from '../utils/firestore';
import { createRoomLog } from '../utils/roomLogs';
import { prisma } from '../utils/prisma';
import admin from 'firebase-admin';

export const roomRouter = Router({ mergeParams: true });

const getRequestUserName = (user?: any) => {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || null;
};

const decimalToNumber = (value?: Prisma.Decimal | number | null) =>
  value !== null && value !== undefined ? Number(value) : null;

const serializePrismaRoom = (room: any) => {
  const ratePlan = room.ratePlan
    ? {
        id: room.ratePlan.id,
        name: room.ratePlan.name,
        description: room.ratePlan.description || null,
        baseRate: decimalToNumber(room.ratePlan.baseRate),
        currency: room.ratePlan.currency,
      }
    : null;

  const category = room.category
    ? {
        id: room.category.id,
        name: room.category.name,
      }
    : null;

  const customRate = decimalToNumber(room.customRate);
  const effectiveRate = customRate ?? ratePlan?.baseRate ?? null;

  return {
    id: room.id,
    tenantId: room.tenantId,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    floor: room.floor,
    maxOccupancy: room.maxOccupancy,
    amenities: room.amenities,
    ratePlanId: room.ratePlanId,
    categoryId: room.categoryId,
    description: room.description,
    customRate,
    status: room.status,
    lastLogType: room.lastLogType,
    lastLogSummary: room.lastLogSummary,
    lastLogUserName: room.lastLogUserName,
    lastLogAt: room.lastLogAt,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    ratePlan,
    category,
    effectiveRate,
    _count: {
      reservations: room._count?.reservations ?? 0,
    },
  };
};

type RoomDocForReport = {
  roomNumber?: string;
  status?: string;
  lastLogAt?: admin.firestore.Timestamp | Date | null;
  lastLogSummary?: string | null;
  lastLogUserName?: string | null;
  [key: string]: any;
};

const createRoomSchema = z.object({
  roomNumber: z.string().min(1),
  roomType: z.string().min(1),
  floor: z.number().int().optional(),
  maxOccupancy: z.number().int().min(1),
  amenities: z.any().optional(),
  ratePlanId: z.string().uuid().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  customRate: z.number().positive().optional(),
});

// GET /api/tenants/:tenantId/rooms
roomRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomType, categoryId, floor } = req.query;

      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: admin.firestore.Query = db.collection('rooms')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (roomType) {
        query = query.where('roomType', '==', roomType);
      }
      if (categoryId) {
        if (categoryId === 'none') {
          query = query.where('categoryId', '==', null);
        } else {
          query = query.where('categoryId', '==', categoryId);
        }
      }
      if (floor) {
        const floorNumber = parseInt(floor as string, 10);
        if (!isNaN(floorNumber)) {
          query = query.where('floor', '==', floorNumber);
        }
      }

      // Get total count
      let totalSnapshot;
      let roomsSnapshot;
      
      try {
        totalSnapshot = await query.get();
        const total = totalSnapshot.size;

        // Apply pagination - try with orderBy first
        const skip = (page - 1) * limit;
        try {
          roomsSnapshot = await query
            .orderBy('roomNumber', 'asc')
            .offset(skip)
            .limit(limit)
            .get();
        } catch (orderByError: any) {
          // If orderBy fails (missing index), fetch all and sort in memory
          console.warn('orderBy failed, sorting in memory:', orderByError.message);
          const allRoomsSnapshot = await query.get();
          const sortedDocs = allRoomsSnapshot.docs.sort((a, b) => {
            const aRoomNumber = a.data().roomNumber || '';
            const bRoomNumber = b.data().roomNumber || '';
            return aRoomNumber.localeCompare(bRoomNumber);
          });
          roomsSnapshot = {
            docs: sortedDocs.slice(skip, skip + limit),
            size: totalSnapshot.size,
          } as any;
        }
      } catch (error: any) {
        // If collection doesn't exist or query fails completely
        console.warn('Error fetching rooms, returning empty data:', error.message);
        res.json({
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        });
        return;
      }

      const total = totalSnapshot.size;

      // Convert to array and enrich with ratePlan and reservation count
      const rooms = await Promise.all(
        roomsSnapshot.docs.map(async (doc) => {
          try {
            const roomData = doc.data();
            const roomId = doc.id;

            // Get rate plan if exists (don't fail if lookup fails)
            let ratePlan: { id: string; name: any; baseRate: number | null } | null = null;
            try {
              if (roomData.ratePlanId) {
                const ratePlanDoc = await db.collection('ratePlans').doc(roomData.ratePlanId).get();
                if (ratePlanDoc.exists) {
                  const ratePlanData = ratePlanDoc.data();
                  ratePlan = {
                    id: ratePlanDoc.id,
                    name: ratePlanData?.name || null,
                    baseRate: ratePlanData?.baseRate !== undefined && ratePlanData?.baseRate !== null
                      ? Number(ratePlanData.baseRate)
                      : null,
                  };
                }
              }
            } catch (error) {
              // Silently continue if rate plan lookup fails
              console.warn(`Error fetching rate plan for room ${roomId}:`, error);
            }

            // Get category if exists (don't fail if lookup fails)
            let category: { id: string; name: string } | null = null;
            try {
              if (roomData.categoryId) {
                const categoryDoc = await db.collection('roomCategories').doc(roomData.categoryId).get();
                if (categoryDoc.exists) {
                  const categoryData = categoryDoc.data();
                  category = {
                    id: categoryDoc.id,
                    name: categoryData?.name || null,
                  };
                }
              }
            } catch (error) {
              // Silently continue if category lookup fails
              console.warn(`Error fetching category for room ${roomId}:`, error);
            }

            // Get reservation count (don't fail if lookup fails)
            let reservationCount = 0;
            try {
              const reservationsSnapshot = await db.collection('reservations')
                .where('roomId', '==', roomId)
                .get();
              reservationCount = reservationsSnapshot.size;
            } catch (error) {
              // Silently continue if reservation lookup fails
              console.warn(`Error fetching reservations for room ${roomId}:`, error);
            }

            return {
              id: roomId,
              ...roomData,
              customRate: roomData.customRate ?? null,
              ratePlan,
              category,
              _count: {
                reservations: reservationCount,
              },
              createdAt: toDate(roomData.createdAt) || null,
              updatedAt: toDate(roomData.updatedAt) || null,
              lastLogType: roomData.lastLogType || null,
              lastLogSummary: roomData.lastLogSummary || null,
              lastLogUserName: roomData.lastLogUserName || null,
              lastLogAt: toDate(roomData.lastLogAt) || null,
              effectiveRate: roomData.customRate ?? ratePlan?.baseRate ?? null,
            };
          } catch (error: any) {
            console.error(`Error processing room ${doc.id}:`, error);
            // Return a minimal room object to prevent complete failure
            return {
              id: doc.id,
              ...doc.data(),
              ratePlan: null,
              _count: { reservations: 0 },
              createdAt: null,
              updatedAt: null,
            };
          }
        })
      );

      const result = createPaginationResult(rooms, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      throw new AppError(
        `Failed to fetch rooms: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

export const createAccountabilityReportForTenant = async (tenantId: string, generatedBy?: string | null) => {
  const roomsSnapshot = await db.collection('rooms').where('tenantId', '==', tenantId).get();
  const rooms = roomsSnapshot.docs.map((doc) => {
    const data = doc.data() as RoomDocForReport;
    return {
      id: doc.id,
      ...data,
    };
  });
  const thresholdMs = 6 * 60 * 60 * 1000;
  const nowTimestamp = now();
  const nowDate = nowTimestamp.toDate();
  const flaggedStatuses = new Set(['dirty', 'reserved', 'maintenance']);

  const staleRooms = rooms
    .map((room) => {
      const lastLogAt = toDate(room.lastLogAt);
      return {
        id: room.id,
        roomNumber: room.roomNumber || '',
        status: room.status || 'available',
        lastLogSummary: room.lastLogSummary || null,
        lastLogUserName: room.lastLogUserName || null,
        lastLogAt,
        isStale: !lastLogAt || nowDate.getTime() - lastLogAt.getTime() > thresholdMs,
      };
    })
    .filter((room) => room.isStale)
    .slice(0, 6)
    .map(({ isStale, ...rest }) => rest);

  const staleCount = staleRooms.length;
  const flaggedCount = rooms.filter((room) => flaggedStatuses.has(room.status || 'available')).length;
  const noLogCount = rooms.filter((room) => !room.lastLogAt).length;

  const reportData = {
    lastReportAt: nowTimestamp,
    generatedBy: generatedBy || null,
    staleCount,
    flaggedCount,
    noLogCount,
    staleRooms,
  };

  await db.collection('accountabilityReports').doc(tenantId).set(reportData, { merge: true });
  return reportData;
};

roomRouter.post(
  '/accountability-report',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const reportData = await createAccountabilityReportForTenant(tenantId, req.user?.id || null);
      res.json({
        success: true,
        data: reportData,
      });
    } catch (error: any) {
      console.error('Error generating accountability report:', error);
      throw new AppError(
        `Failed to generate accountability report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

roomRouter.get(
  '/accountability-report/latest',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const reportRef = db.collection('accountabilityReports').doc(tenantId);
      const reportDoc = await reportRef.get();
      if (!reportDoc.exists) {
        res.json({
          success: true,
          data: null,
        });
        return;
      }
      res.json({
        success: true,
        data: reportDoc.data(),
      });
    } catch (error: any) {
      console.error('Error fetching accountability report:', error);
      throw new AppError(
        `Failed to fetch accountability report: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id
roomRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const roomId = req.params.id;

      const roomDoc = await db.collection('rooms').doc(roomId).get();

      if (!roomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const roomData = roomDoc.data();
      if (roomData?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      // Get rate plan if exists
      let ratePlan: any = null;
      if (roomData?.ratePlanId) {
        const ratePlanDoc = await db.collection('ratePlans').doc(roomData.ratePlanId).get();
        if (ratePlanDoc.exists) {
          ratePlan = {
            id: ratePlanDoc.id,
            ...ratePlanDoc.data(),
          };
        }
      }

      // Get category if exists
      let category: { id: string; name: string } | null = null;
      if (roomData?.categoryId) {
        const categoryDoc = await db.collection('roomCategories').doc(roomData.categoryId).get();
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data();
          category = {
            id: categoryDoc.id,
            name: categoryData?.name || null,
          };
        }
      }

      // Get active reservations
      const reservationsSnapshot = await db.collection('reservations')
        .where('roomId', '==', roomId)
        .where('status', 'in', ['confirmed', 'checked_in'])
        .orderBy('checkInDate', 'asc')
        .get();

      const reservations = reservationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        checkInDate: toDate(doc.data().checkInDate),
        checkOutDate: toDate(doc.data().checkOutDate),
        createdAt: toDate(doc.data().createdAt),
        updatedAt: toDate(doc.data().updatedAt),
      }));

      const room = {
        id: roomDoc.id,
        ...roomData,
        customRate: roomData.customRate ?? null,
        ratePlan,
        category,
        reservations,
        createdAt: toDate(roomData?.createdAt),
        updatedAt: toDate(roomData?.updatedAt),
        effectiveRate: roomData.customRate ?? ratePlan?.baseRate ?? null,
      };

      res.json({
        success: true,
        data: room,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching room:', error);
      throw new AppError(
        `Failed to fetch room: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id/logs
roomRouter.get(
  '/:id/logs',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const roomId = req.params.id;

      const roomDoc = await db.collection('rooms').doc(roomId).get();
      if (!roomDoc.exists || roomDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      const { skip, take, page, limit } = getPaginationParams(req);

      const baseQuery = db.collection('roomLogs')
        .where('tenantId', '==', tenantId)
        .where('roomId', '==', roomId);

      let totalSnapshot;
      let logsSnapshot;

      try {
        totalSnapshot = await baseQuery.get();

        try {
          logsSnapshot = await baseQuery
            .orderBy('createdAt', 'desc')
            .offset(skip)
            .limit(take)
            .get();
        } catch (orderByError: any) {
          console.warn('orderBy failed for roomLogs, sorting in memory:', orderByError.message);
          const allLogsSnapshot = await baseQuery.get();
          const sortedDocs = allLogsSnapshot.docs.sort((a, b) => {
            const aCreated = a.data().createdAt;
            const bCreated = b.data().createdAt;
            if (!aCreated || !bCreated) return 0;
            const aDate = toDate(aCreated)?.getTime() || 0;
            const bDate = toDate(bCreated)?.getTime() || 0;
            return bDate - aDate;
          });
          logsSnapshot = {
            docs: sortedDocs.slice(skip, skip + take),
            size: sortedDocs.length,
          } as any;
        }
      } catch (error: any) {
        console.warn('Error fetching room logs, returning empty data:', error.message);
        res.json({
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        });
        return;
      }

      const total = totalSnapshot.size;
      const logs = logsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          summary: data.summary,
          details: data.details || null,
          metadata: data.metadata || null,
          user: data.user || null,
          createdAt: toDate(data.createdAt),
        };
      });

      const result = createPaginationResult(logs, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching room logs:', error);
      throw new AppError(
        `Failed to fetch room logs: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/rooms
roomRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createRoomSchema.parse(req.body);

      // Check if room number exists
      const existingSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('roomNumber', '==', data.roomNumber)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        throw new AppError('Room number already exists', 400);
      }

      // Validate categoryId if provided
      if (data.categoryId) {
        const categoryDoc = await db.collection('roomCategories').doc(data.categoryId).get();
        if (!categoryDoc.exists || categoryDoc.data()?.tenantId !== tenantId) {
          throw new AppError('Invalid room category', 400);
        }
      }

      // Create room
      const roomRef = db.collection('rooms').doc();
      const roomData = {
        tenantId,
        roomNumber: data.roomNumber,
        roomType: data.roomType,
        floor: data.floor || null,
        maxOccupancy: data.maxOccupancy,
        amenities: data.amenities || null,
        ratePlanId: data.ratePlanId || null,
        categoryId: data.categoryId || null,
        description: data.description || null,
        customRate: data.customRate ?? null,
        status: 'available',
        createdAt: now(),
        updatedAt: now(),
      };

      await roomRef.set(roomData);

      // Get rate plan if exists
      let ratePlan: any = null;
      if (data.ratePlanId) {
        const ratePlanDoc = await db.collection('ratePlans').doc(data.ratePlanId).get();
        if (ratePlanDoc.exists) {
          ratePlan = {
            id: ratePlanDoc.id,
            ...ratePlanDoc.data(),
          };
        }
      }

      // Get category if exists
      let category: { id: string; name: string } | null = null;
      if (data.categoryId) {
        const categoryDoc = await db.collection('roomCategories').doc(data.categoryId).get();
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data();
          category = {
            id: categoryDoc.id,
            name: categoryData?.name || null,
          };
        }
      }

      const room = {
        id: roomRef.id,
        ...roomData,
        ratePlan,
        category,
        createdAt: toDate(roomData.createdAt),
        updatedAt: toDate(roomData.updatedAt),
        effectiveRate: roomData.customRate ?? ratePlan?.baseRate ?? null,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_room',
        entityType: 'room',
        entityId: roomRef.id,
        afterState: room,
      });

      res.status(201).json({
        success: true,
        data: room,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating room:', error);
      throw new AppError(
        `Failed to create room: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/rooms/bulk
roomRouter.post(
  '/bulk',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { roomNumbers, roomType, floor, maxOccupancy, amenities, ratePlanId, categoryId, description } = req.body;

      // Validate required fields
      if (!roomNumbers || !Array.isArray(roomNumbers) || roomNumbers.length === 0) {
        throw new AppError('roomNumbers array is required', 400);
      }
      if (!roomType) {
        throw new AppError('roomType is required', 400);
      }
      if (!maxOccupancy) {
        throw new AppError('maxOccupancy is required', 400);
      }

      // Validate categoryId if provided
      let categoryDescription = description || null;
      if (categoryId) {
        const categoryDoc = await db.collection('roomCategories').doc(categoryId).get();
        if (!categoryDoc.exists || categoryDoc.data()?.tenantId !== tenantId) {
          throw new AppError('Invalid room category', 400);
        }
        // Use category description if no description provided
        if (!description && categoryDoc.data()?.description) {
          categoryDescription = categoryDoc.data()?.description;
        }
      }

      // Check for existing room numbers
      const existingRoomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .get();

      const existingRoomNumbers = new Set(
        existingRoomsSnapshot.docs.map(doc => doc.data().roomNumber)
      );

      const duplicateRoomNumbers = roomNumbers.filter((num: string) => existingRoomNumbers.has(num));
      if (duplicateRoomNumbers.length > 0) {
        throw new AppError(
          `Room numbers already exist: ${duplicateRoomNumbers.join(', ')}`,
          400
        );
      }

      // Create all rooms in batch
      const batch = db.batch();
      const createdRooms: any[] = [];
      const timestamp = now();

      for (const roomNumber of roomNumbers) {
        const roomRef = db.collection('rooms').doc();
        const roomData = {
          tenantId,
          roomNumber: String(roomNumber),
          roomType,
          floor: floor || null,
          maxOccupancy: parseInt(String(maxOccupancy), 10),
          amenities: amenities || null,
          ratePlanId: ratePlanId || null,
          categoryId: categoryId || null,
          description: categoryDescription,
          customRate: null,
          status: 'available',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        batch.set(roomRef, roomData);
        createdRooms.push({
          id: roomRef.id,
          roomNumber: String(roomNumber),
        });
      }

      // Commit batch
      await batch.commit();

      // Create audit log for bulk creation
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'bulk_create_rooms',
        entityType: 'room',
        entityId: createdRooms[0]?.id || 'bulk',
        afterState: {
          count: createdRooms.length,
          roomNumbers: createdRooms.map(r => r.roomNumber),
          roomType,
          categoryId,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          created: createdRooms.length,
          rooms: createdRooms,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating rooms in bulk:', error);
      throw new AppError(
        `Failed to create rooms: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/rooms/:id
roomRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const roomId = req.params.id;

      const roomDoc = await db.collection('rooms').doc(roomId).get();

      if (!roomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const roomData = roomDoc.data();
      if (roomData?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      const beforeState = {
        id: roomDoc.id,
        ...roomData,
        createdAt: toDate(roomData?.createdAt),
        updatedAt: toDate(roomData?.updatedAt),
      };

      // Validate categoryId if provided
      if (req.body.categoryId !== undefined) {
        if (req.body.categoryId) {
          const categoryDoc = await db.collection('roomCategories').doc(req.body.categoryId).get();
          if (!categoryDoc.exists || categoryDoc.data()?.tenantId !== tenantId) {
            throw new AppError('Invalid room category', 400);
          }
        }
      }

      // Update room
      const updateData: any = {
        ...req.body,
        updatedAt: now(),
      };

      // Handle null values properly
      if (updateData.categoryId === '') updateData.categoryId = null;
      if (updateData.description === '') updateData.description = null;
      if (updateData.customRate === '') updateData.customRate = null;
      if (updateData.customRate !== undefined && updateData.customRate !== null) {
        const parsedRate = Number(updateData.customRate);
        if (isNaN(parsedRate) || parsedRate <= 0) {
          throw new AppError('customRate must be a positive number', 400);
        }
        updateData.customRate = parsedRate;
      }

      await roomDoc.ref.update(updateData);

      // Get updated room
      const updatedDoc = await db.collection('rooms').doc(roomId).get();
      const updatedData = updatedDoc.data();

      // Get rate plan if exists
      let ratePlan: any = null;
      if (updatedData?.ratePlanId) {
        const ratePlanDoc = await db.collection('ratePlans').doc(updatedData.ratePlanId).get();
        if (ratePlanDoc.exists) {
          ratePlan = {
            id: ratePlanDoc.id,
            ...ratePlanDoc.data(),
          };
        }
      }

      // Get category if exists
      let category: { id: string; name: string } | null = null;
      if (updatedData?.categoryId) {
        const categoryDoc = await db.collection('roomCategories').doc(updatedData.categoryId).get();
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data();
          category = {
            id: categoryDoc.id,
            name: categoryData?.name || null,
          };
        }
      }

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        ratePlan,
        category,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
        effectiveRate: updatedData?.customRate ?? ratePlan?.baseRate ?? null,
      };

      if (req.body.status !== undefined && req.body.status !== roomData?.status) {
        const userName = getRequestUserName(req.user);
        await createRoomLog({
          tenantId,
          roomId,
          type: 'status_change',
          summary: `Room status changed from ${(roomData?.status || 'unknown').replace('_', ' ')} to ${String(req.body.status).replace('_', ' ')}`,
          metadata: {
            from: roomData?.status || null,
            to: req.body.status,
          },
          user: {
            id: req.user?.id || null,
            name: userName,
          },
        });
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_room',
        entityType: 'room',
        entityId: roomId,
        beforeState,
        afterState: updated,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating room:', error);
      throw new AppError(
        `Failed to update room: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);