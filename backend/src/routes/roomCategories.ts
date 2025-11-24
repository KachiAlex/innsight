import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { db, now, toDate } from '../utils/firestore';

export const roomCategoryRouter = Router({ mergeParams: true });

const createRoomCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  totalRooms: z.number().int().min(0).optional(),
});

const updateRoomCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  totalRooms: z.number().int().min(0).optional(),
});

// GET /api/tenants/:tenantId/room-categories
roomCategoryRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;

      // Try to fetch with orderBy first, fall back to in-memory sort if index missing
      let categoriesSnapshot;
      try {
        categoriesSnapshot = await db.collection('roomCategories')
          .where('tenantId', '==', tenantId)
          .orderBy('name', 'asc')
          .get();
      } catch (orderByError: any) {
        // If orderBy fails (missing index), fetch all and sort in memory
        console.warn('orderBy failed for roomCategories, sorting in memory:', orderByError.message);
        try {
          const allCategoriesSnapshot = await db.collection('roomCategories')
            .where('tenantId', '==', tenantId)
            .get();
          const sortedDocs = allCategoriesSnapshot.docs.sort((a, b) => {
            const aName = a.data().name || '';
            const bName = b.data().name || '';
            return aName.localeCompare(bName);
          });
          categoriesSnapshot = {
            docs: sortedDocs,
            size: sortedDocs.length,
          } as any;
        } catch (queryError: any) {
          // If collection doesn't exist or query fails completely, return empty array
          console.warn('Error fetching roomCategories, returning empty data:', queryError.message);
          res.json({
            success: true,
            data: [],
          });
          return;
        }
      }

      // If collection is empty, return empty array
      if (!categoriesSnapshot || categoriesSnapshot.docs.length === 0) {
        res.json({
          success: true,
          data: [],
        });
        return;
      }

      const categories = categoriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });

      // Get room count for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          try {
            const roomsSnapshot = await db.collection('rooms')
              .where('tenantId', '==', tenantId)
              .where('categoryId', '==', category.id)
              .get();
            return {
              ...category,
              actualRoomCount: roomsSnapshot.size,
            };
          } catch (error) {
            return {
              ...category,
              actualRoomCount: 0,
            };
          }
        })
      );

      res.json({
        success: true,
        data: categoriesWithCounts,
      });
    } catch (error: any) {
      console.error('Error fetching room categories:', error);
      throw new AppError(
        `Failed to fetch room categories: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/room-categories/:id
roomCategoryRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const categoryId = req.params.id;

      const categoryDoc = await db.collection('roomCategories').doc(categoryId).get();

      if (!categoryDoc.exists) {
        throw new AppError('Room category not found', 404);
      }

      const categoryData = categoryDoc.data();
      if (categoryData?.tenantId !== tenantId) {
        throw new AppError('Room category not found', 404);
      }

      // Get room count
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('categoryId', '==', categoryId)
        .get();

      const category = {
        id: categoryDoc.id,
        ...categoryData,
        actualRoomCount: roomsSnapshot.size,
        createdAt: toDate(categoryData?.createdAt),
        updatedAt: toDate(categoryData?.updatedAt),
      };

      res.json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching room category:', error);
      throw new AppError(
        `Failed to fetch room category: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/room-categories
roomCategoryRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createRoomCategorySchema.parse(req.body);

      // Check if category name exists for this tenant
      const existingSnapshot = await db.collection('roomCategories')
        .where('tenantId', '==', tenantId)
        .where('name', '==', data.name)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        throw new AppError('Room category name already exists', 400);
      }

      // Create category
      const categoryRef = db.collection('roomCategories').doc();
      const categoryData = {
        tenantId,
        name: data.name,
        description: data.description || null,
        totalRooms: data.totalRooms || null,
        createdAt: now(),
        updatedAt: now(),
      };

      await categoryRef.set(categoryData);

      const category = {
        id: categoryRef.id,
        ...categoryData,
        actualRoomCount: 0,
        createdAt: toDate(categoryData.createdAt),
        updatedAt: toDate(categoryData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_room_category',
        entityType: 'room_category',
        entityId: categoryRef.id,
        afterState: category,
      });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating room category:', error);
      throw new AppError(
        `Failed to create room category: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/room-categories/:id
roomCategoryRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const categoryId = req.params.id;
      const data = updateRoomCategorySchema.parse(req.body);

      const categoryDoc = await db.collection('roomCategories').doc(categoryId).get();

      if (!categoryDoc.exists) {
        throw new AppError('Room category not found', 404);
      }

      const categoryData = categoryDoc.data();
      if (categoryData?.tenantId !== tenantId) {
        throw new AppError('Room category not found', 404);
      }

      // Check if name is being changed and if new name already exists
      if (data.name && data.name !== categoryData.name) {
        const existingSnapshot = await db.collection('roomCategories')
          .where('tenantId', '==', tenantId)
          .where('name', '==', data.name)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          throw new AppError('Room category name already exists', 400);
        }
      }

      const beforeState = {
        id: categoryDoc.id,
        ...categoryData,
        createdAt: toDate(categoryData?.createdAt),
        updatedAt: toDate(categoryData?.updatedAt),
      };

      // Update category
      const updateData: any = {
        updatedAt: now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.totalRooms !== undefined) updateData.totalRooms = data.totalRooms || null;

      await categoryDoc.ref.update(updateData);

      // Get updated category
      const updatedDoc = await db.collection('roomCategories').doc(categoryId).get();
      const updatedData = updatedDoc.data();

      // Get room count
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('categoryId', '==', categoryId)
        .get();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        actualRoomCount: roomsSnapshot.size,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_room_category',
        entityType: 'room_category',
        entityId: categoryId,
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
      console.error('Error updating room category:', error);
      throw new AppError(
        `Failed to update room category: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// DELETE /api/tenants/:tenantId/room-categories/:id
roomCategoryRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const categoryId = req.params.id;

      const categoryDoc = await db.collection('roomCategories').doc(categoryId).get();

      if (!categoryDoc.exists) {
        throw new AppError('Room category not found', 404);
      }

      const categoryData = categoryDoc.data();
      if (categoryData?.tenantId !== tenantId) {
        throw new AppError('Room category not found', 404);
      }

      // Check if any rooms are using this category
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('categoryId', '==', categoryId)
        .limit(1)
        .get();

      if (!roomsSnapshot.empty) {
        throw new AppError('Cannot delete category that has rooms assigned to it', 400);
      }

      const beforeState = {
        id: categoryDoc.id,
        ...categoryData,
        createdAt: toDate(categoryData?.createdAt),
        updatedAt: toDate(categoryData?.updatedAt),
      };

      await categoryDoc.ref.delete();

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_room_category',
        entityType: 'room_category',
        entityId: categoryId,
        beforeState,
      });

      res.json({
        success: true,
        message: 'Room category deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting room category:', error);
      throw new AppError(
        `Failed to delete room category: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

