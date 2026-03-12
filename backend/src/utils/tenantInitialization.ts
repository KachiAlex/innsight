import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Template for tenant initialization with default data
 */
interface TenantTemplate {
  name: string;
  roomCategories: Array<{ name: string; description: string }>;
  ratePlans: Array<{ name: string; description: string; baseRate: number; type: string }>;
  shifts: Array<{ name: string; startTime: string; endTime: string }>;
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
      type: 'standard',
    },
    {
      name: 'Weekend',
      description: 'Friday - Sunday rates',
      baseRate: 150,
      type: 'standard',
    },
    {
      name: 'Corporate',
      description: 'Special rates for corporate bookings',
      baseRate: 120,
      type: 'negotiated',
    },
  ],
  shifts: [
    {
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
    },
    {
      name: 'Afternoon',
      startTime: '14:00',
      endTime: '22:00',
    },
    {
      name: 'Night',
      startTime: '22:00',
      endTime: '06:00',
    },
  ],
};

/**
 * Initialize tenant with default data
 * Creates default room categories, rate plans, and shifts
 */
export const initializeTenant = async (
  tenantId: string,
  template: TenantTemplate = DEFAULT_TEMPLATE
): Promise<void> => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  try {
    // Create room categories
    for (const category of template.roomCategories) {
      await prisma.roomCategory.create({
        data: {
          tenantId,
          name: category.name,
          description: category.description,
        },
      });
    }

    // Create rate plans
    for (const plan of template.ratePlans) {
      await prisma.ratePlan.create({
        data: {
          tenantId,
          name: plan.name,
          description: plan.description,
          baseRate: plan.baseRate,
          type: plan.type as any,
        },
      });
    }

    // Create shifts
    for (const shift of template.shifts) {
      await prisma.shift.create({
        data: {
          tenantId,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
      });
    }

    // Create default overbooking settings
    await prisma.overbookingSetting.create({
      data: {
        tenantId,
        enableOverbooking: false,
        overbookingThreshold: 0,
        maxOverbookingPercentage: 5,
        notifyStaffAt: 80,
      },
    });

    // Create default loyalty program
    await prisma.loyaltyProgram.create({
      data: {
        tenantId,
        pointsPerDollar: 1,
        baseRewardTier: 'Silver',
        isDynamic: false,
      },
    });

    console.log(`✓ Initialized tenant ${tenantId} with default data`);
  } catch (error: any) {
    console.error(`Failed to initialize tenant ${tenantId}:`, error);
    // Don't throw - initialization is optional and shouldn't block tenant creation
    // Log to monitoring system instead
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
