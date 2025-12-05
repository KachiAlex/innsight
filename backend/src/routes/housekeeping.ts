import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate } from '../utils/firestore';

export const housekeepingRouter = Router({ mergeParams: true });

const createTaskSchema = z.object({
  roomId: z.string(),
  taskType: z.enum(['cleaning', 'inspection', 'maintenance_prep']),
  assignedTo: z.string().optional(),
});

const completeTaskSchema = z.object({
  photos: z.array(z.string()).optional(),
  checklist: z.any().optional(),
  notes: z.string().optional(),
});

// GET /api/tenants/:tenantId/housekeeping
housekeepingRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomId, assignedTo } = req.query;
      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: FirebaseFirestore.Query = db.collection('housekeepingTasks')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (roomId) {
        query = query.where('roomId', '==', roomId);
      }
      if (assignedTo) {
        query = query.where('assignedTo', '==', assignedTo);
      }

      // Get all tasks first (for sorting)
      const allTasksSnapshot = await query.get();
      const total = allTasksSnapshot.size;

      // Sort by createdAt (desc)
      const sortedTasks = allTasksSnapshot.docs.sort((a, b) => {
        const aCreated = toDate(a.data().createdAt);
        const bCreated = toDate(b.data().createdAt);
        if (!aCreated || !bCreated) return 0;
        return bCreated.getTime() - aCreated.getTime();
      });

      // Apply pagination
      const skip = (page - 1) * limit;
      const paginatedTasks = sortedTasks.slice(skip, skip + limit);

      // Enrich with related data
      const tasks = await Promise.all(
        paginatedTasks.map(async (doc) => {
          const data = doc.data();
          const task: any = {
            id: doc.id,
            roomId: data.roomId,
            taskType: data.taskType,
            status: data.status || 'pending',
            assignedTo: data.assignedTo || null,
            completedBy: data.completedBy || null,
            photos: data.photos || [],
            checklist: data.checklist || null,
            notes: data.notes || null,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            completedAt: data.completedAt ? toDate(data.completedAt) : null,
          };

          // Fetch room data
          if (data.roomId) {
            try {
              const roomDoc = await db.collection('rooms').doc(data.roomId).get();
              if (roomDoc.exists) {
                const roomData = roomDoc.data();
                task.room = {
                  id: roomDoc.id,
                  roomNumber: roomData?.roomNumber || null,
                  roomType: roomData?.roomType || null,
                };
              }
            } catch (error) {
              console.error('Error fetching room:', error);
            }
          }

          // Fetch assigned staff data
          if (data.assignedTo) {
            try {
              const staffDoc = await db.collection('users').doc(data.assignedTo).get();
              if (staffDoc.exists) {
                const staffData = staffDoc.data();
                task.assignedStaff = {
                  id: staffDoc.id,
                  firstName: staffData?.firstName || null,
                  lastName: staffData?.lastName || null,
                };
              }
            } catch (error) {
              console.error('Error fetching assigned staff:', error);
            }
          }

          // Fetch completed staff data
          if (data.completedBy) {
            try {
              const staffDoc = await db.collection('users').doc(data.completedBy).get();
              if (staffDoc.exists) {
                const staffData = staffDoc.data();
                task.completedStaff = {
                  id: staffDoc.id,
                  firstName: staffData?.firstName || null,
                  lastName: staffData?.lastName || null,
                };
              }
            } catch (error) {
              console.error('Error fetching completed staff:', error);
            }
          }

          return task;
        })
      );

      const result = createPaginationResult(tasks, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching housekeeping tasks:', error);
      throw new AppError(
        `Failed to fetch housekeeping tasks: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/housekeeping
housekeepingRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createTaskSchema.parse(req.body);

      // Verify room exists
      const roomDoc = await db.collection('rooms').doc(data.roomId).get();
      if (!roomDoc.exists || roomDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      const taskRef = db.collection('housekeepingTasks').doc();
      const taskData = {
        tenantId,
        roomId: data.roomId,
        taskType: data.taskType,
        status: 'pending',
        assignedTo: data.assignedTo || null,
        completedBy: null,
        photos: [],
        checklist: null,
        notes: null,
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      };

      await taskRef.set(taskData);

      const roomData = roomDoc.data();
      const task = {
        id: taskRef.id,
        ...taskData,
        room: {
          id: roomDoc.id,
          roomNumber: roomData?.roomNumber || null,
          roomType: roomData?.roomType || null,
        },
        createdAt: toDate(taskData.createdAt),
        updatedAt: toDate(taskData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: taskRef.id,
        afterState: task,
      });

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating housekeeping task:', error);
      throw new AppError(
        `Failed to create housekeeping task: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/housekeeping/:id/complete
housekeepingRouter.post(
  '/:id/complete',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const taskId = req.params.id;
      const data = completeTaskSchema.parse(req.body);

      const taskDoc = await db.collection('housekeepingTasks').doc(taskId).get();

      if (!taskDoc.exists) {
        throw new AppError('Task not found', 404);
      }

      const taskData = taskDoc.data();
      if (taskData?.tenantId !== tenantId) {
        throw new AppError('Task not found', 404);
      }

      const beforeState = {
        id: taskDoc.id,
        ...taskData,
        createdAt: toDate(taskData.createdAt),
        updatedAt: toDate(taskData.updatedAt),
      };

      // Update task
      await taskDoc.ref.update({
        status: 'completed',
        completedBy: req.user!.id,
        completedAt: now(),
        photos: data.photos || [],
        checklist: data.checklist || null,
        notes: data.notes || null,
        updatedAt: now(),
      });

      // Update room status to clean
      if (taskData.roomId) {
        await db.collection('rooms').doc(taskData.roomId).update({
          status: 'clean',
          updatedAt: now(),
        });
      }

      // Get updated task
      const updatedDoc = await db.collection('housekeepingTasks').doc(taskId).get();
      const updatedData = updatedDoc.data();

      const afterState = {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
        completedAt: updatedData?.completedAt ? toDate(updatedData.completedAt) : null,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'complete_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: taskId,
        beforeState,
        afterState,
        metadata: {
          photos: data.photos,
        },
      });

      res.json({
        success: true,
        data: afterState,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error completing housekeeping task:', error);
      throw new AppError(
        `Failed to complete housekeeping task: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
