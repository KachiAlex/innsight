import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const roomCategoryRouter = Router({ mergeParams: true });

const inventoryStatusValues = ['available', 'in_use', 'maintenance', 'retired'] as const;

const inventoryItemSchema = z.object({
  id: z.string().min(8).optional(),
  name: z.string().min(1).max(120),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().max(50).optional(),
  status: z.enum(inventoryStatusValues).optional(),
  notes: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
});

type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

const normalizeInventoryItems = (items?: InventoryItemInput[]) => {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: item.id || uuidv4(),
    name: item.name.trim(),
    quantity: Number(item.quantity ?? 0),
    unit: item.unit || null,
    status: item.status || 'available',
    notes: item.notes || null,
    imageUrl: item.imageUrl || null,
  }));
};

const createRoomCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  totalRooms: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  inventoryTemplate: z.array(inventoryItemSchema).optional(),
});

const updateRoomCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  totalRooms: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  inventoryTemplate: z.array(inventoryItemSchema).optional(),
});

// GET /api/tenants/:tenantId/room-categories
roomCategoryRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const categories = await prisma.roomCategory.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        include: {
          rooms: {
            select: {
              id: true,
            },
          },
          ratePlans: {
            select: {
              id: true,
            },
          },
        },
      });

      const transformedCategories = categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        totalRooms: category.totalRooms,
        roomCount: category.rooms.length,
        ratePlanCount: category.ratePlans.length,
        inventoryTemplate: category.inventoryTemplate,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }));

      res.json({
        success: true,
        data: transformedCategories,
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

const applyInventoryTemplateSchema = z.object({
  roomIds: z.array(z.string().min(1)).optional(),
  overwriteCustom: z.boolean().optional(),
});

roomCategoryRouter.post(
  '/:id/apply-inventory',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const categoryId = req.params.id;
      const { roomIds, overwriteCustom } = applyInventoryTemplateSchema.parse(req.body || {});

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Get category with inventory template
      const category = await prisma.roomCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category || category.tenantId !== tenantId) {
        throw new AppError('Category not found', 404);
      }

      if (!category.inventoryTemplate || !Array.isArray(category.inventoryTemplate)) {
        throw new AppError('No inventory template found for this category', 400);
      }

      // Get rooms to apply template to
      const rooms = await prisma.room.findMany({
        where: {
          tenantId,
          ...(roomIds && roomIds.length > 0 ? { id: { in: roomIds } } : { categoryId }),
        },
      });

      if (rooms.length === 0) {
        throw new AppError('No rooms found to apply template to', 404);
      }

      // Apply template to each room
      const updatePromises = rooms.map(room => 
        prisma.room.update({
          where: { id: room.id },
          data: {
            // Store inventory template in amenities field for now
            // This could be enhanced with a proper inventory table later
            amenities: {
              ...((room.amenities as any) || {}),
              inventoryTemplate: category.inventoryTemplate,
              templateAppliedAt: new Date().toISOString(),
            },
          },
        })
      );

      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: `Inventory template applied to ${rooms.length} rooms`,
        data: {
          roomsUpdated: rooms.length,
          templateItems: category.inventoryTemplate.length,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error applying inventory template:', error);
      throw new AppError(
        `Failed to apply inventory template: ${error.message || 'Database connection error'}`,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const category = await prisma.roomCategory.findUnique({
        where: { id: categoryId },
        include: {
          rooms: {
            select: {
              id: true,
            },
          },
          ratePlans: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!category || category.tenantId !== tenantId) {
        throw new AppError('Room category not found', 404);
      }

      const transformedCategory = {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        totalRooms: category.totalRooms,
        actualRoomCount: category.rooms.length,
        ratePlanCount: category.ratePlans.length,
        inventoryTemplate: category.inventoryTemplate,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };

      res.json({
        success: true,
        data: transformedCategory,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Check if category name already exists
      const existing = await prisma.roomCategory.findFirst({
        where: {
          tenantId,
          name: data.name,
        },
      });

      if (existing) {
        throw new AppError('Room category name already exists', 400);
      }

      // Create room category
      const category = await prisma.roomCategory.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description,
          totalRooms: data.totalRooms,
          color: data.color,
          inventoryTemplate: data.inventoryTemplate,
        },
      });

      const transformedCategory = {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        totalRooms: category.totalRooms,
        inventoryTemplate: category.inventoryTemplate,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_room_category',
        entityType: 'room_category',
        entityId: category.id,
        afterState: transformedCategory,
      });

      res.status(201).json({
        success: true,
        data: transformedCategory,
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

