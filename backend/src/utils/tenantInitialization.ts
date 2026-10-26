import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Template for tenant initialization with default data
 */
interface TenantTemplate {
  name: string;
  roomCategories: Array<{ name: string; description: string }>;
  ratePlans: Array<{ name: string; description: string; baseRate: number }>;
}

const DEFAULT_TEMPLATE: TenantTemplate = {
  name: 'Standard Hotel',
  roomCategories: [
    {
      name: 'Standard',
      description: 'Comfortable room with essential amenities',
    },
    {
      name: 'Deluxe',
      description: 'Spacious room with premium amenities',
    },
    {
      name: 'Suite',
      description: 'Luxury suite with separate living area',
    },
  ],
  ratePlans: [
    {
      name: 'Weekday',
      description: 'Monday - Thursday rates',
      baseRate: 100,
    },
    {
      name: 'Weekend',
      description: 'Friday - Sunday rates',
      baseRate: 150,
    },
    {
      name: 'Corporate',
      description: 'Special rates for corporate bookings',
      baseRate: 120,
    },
  ],
};

/**
 * Initialize tenant with default data
 * Creates default room categories, rate plans, and shifts
 */
export const initializeTenant = async (
  tenantId: string,
  template: TenantTemplate = DEFAULT_TEMPLATE,
  client?: Prisma.TransactionClient | PrismaClient
): Promise<void> => {
  const db = client ?? prisma;
  if (!db) {
    throw new AppError('Database connection not initialized', 500);
  }

  try {
    // Create room categories
    const createdCategories: { id: string }[] = [];
    for (const category of template.roomCategories) {
      const created = await db.roomCategory.create({
        data: {
          tenantId,
          name: category.name,
          description: category.description,
        },
      });
      createdCategories.push(created);
    }

    // Create rate plans, each linked to the category at the same index
    for (let i = 0; i < template.ratePlans.length; i++) {
      const plan = template.ratePlans[i];
      await db.ratePlan.create({
        data: {
          tenantId,
          name: plan.name,
          description: plan.description,
          baseRate: plan.baseRate,
          categoryId: createdCategories[i % createdCategories.length]?.id ?? null,
        },
      });
    }

    // Shift instances are per-staff records created via Staff & Shifts —
    // there are no user accounts to attach them to at provisioning time.

    // Create default overbooking settings (disabled until configured)
    await db.overbookingSetting.create({
      data: {
        tenantId,
        allowOverbooking: false,
        maxOverbookingPercent: 5,
        alertThresholdPercent: 80,
        criticalThresholdPercent: 90,
      },
    });

    // Create default loyalty program
    await db.loyaltyProgram.create({
      data: {
        tenantId,
        pointsPerCurrency: 1,
      },
    });

    console.log(`✓ Initialized tenant ${tenantId} with default data`);
  } catch (error: any) {
    console.error(`Failed to initialize tenant ${tenantId}:`, error);
    throw error;
  }
};

/**
 * Get or create default settings for a tenant
 */
export const ensureTenantSettings = async (tenantId: string): Promise<void> => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  try {
    // Check if settings exist
    const existingSettings = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingSettings) {
      throw new AppError('Tenant not found', 404);
    }

    // Settings creation happens during initializeTenant
    // This is here for future extensibility
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    console.error('Error ensuring tenant settings:', error);
  }
};
