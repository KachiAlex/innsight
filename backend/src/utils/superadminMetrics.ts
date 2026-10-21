/**
 * Superadmin Metrics & Analytics Utility
 * Aggregates cross-tenant KPIs and business intelligence for superadmin dashboard
 */

import { prisma } from './prisma';
import { reservationRevenue } from './publicCheckout';
import { AppError } from '../middleware/errorHandler';

export interface DashboardMetrics {
  totalStats: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalRooms: number;
    totalReservations: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    averageRevenuePerTenant: number;
    revenueGrowth: number; // percentage change from last month
    topRevenueTenantsCount: number;
  };
  occupancyMetrics: {
    averageOccupancyRate: number;
    averageADR: number; // Average Daily Rate
    averageREVPAR: number; // Revenue Per Available Room
  };
  tenantMetrics: {
    newTenantsThisMonth: number;
    newTenantsLastMonth: number;
    tenantGrowthRate: number; // percentage
    churnedTenants: number; // suspended/inactive this month
    activeSubscriptions: {
      active: number;
      suspended: number;
      trial: number;
      inactive: number;
    };
  };
  userMetrics: {
    totalActiveUsers: number;
    totalAdminUsers: number;
    newfUsersThisMonth: number;
    averageUsersPerTenant: number;
  };
  alerts: Alert[];
  timeline: TimelineEvent[];
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  tenantId?: string;
  createdAt: Date;
}

export interface TimelineEvent {
  id: string;
  type: 'tenant_created' | 'suspend' | 'reactivate' | 'milestone';
  title: string;
  description: string;
  tenantId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Get simplified superadmin dashboard metrics (optimized for speed)
 */
export async function getSuperadminDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    // Simple parallel count queries - no complex aggregations
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalRooms,
      totalReservations,
    ] = await Promise.all([
      prisma?.tenant.count() || 0,
      prisma?.tenant.count({ where: { subscriptionStatus: 'active' } }) || 0,
      prisma?.user.count() || 0,
      prisma?.room.count() || 0,
      prisma?.reservation.count() || 0,
    ]);

    // Revenue = nightly rate x nights (Reservation has no totalPrice column)
    const revenueRows = await prisma?.reservation.findMany({
      select: { rate: true, checkInDate: true, checkOutDate: true },
    }) || [];
    const totalRevenue =
      Math.round(revenueRows.reduce((sum, r) => sum + reservationRevenue(r), 0) * 100) / 100;

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Simple counts for this month
    const [newTenantsThisMonth] = await Promise.all([
      prisma?.tenant.count({
        where: { createdAt: { gte: oneMonthAgo } },
      }) || 0,
    ]);

    // Subscription status counts
    const [activeCount, suspendedCount, trialCount] = await Promise.all([
      prisma?.tenant.count({ where: { subscriptionStatus: 'active' } }) || 0,
      prisma?.tenant.count({ where: { subscriptionStatus: 'suspended' } }) || 0,
      prisma?.tenant.count({ where: { subscriptionStatus: 'trial' } }) || 0,
    ]);

    // Simple derived metrics
    const averageRevenuePerTenant = totalTenants > 0 ? totalRevenue / totalTenants : 0;
    const averageADR = totalReservations > 0 ? totalRevenue / totalReservations : 0;
    const averageREVPAR = totalRooms > 0 ? totalRevenue / totalRooms : 0;

    return {
      totalStats: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalRooms,
        totalReservations,
      },
      revenueMetrics: {
        totalRevenue,
        averageRevenuePerTenant: Math.round(averageRevenuePerTenant * 100) / 100,
        revenueGrowth: 0, // Simplified - no month-over-month calculation
        topRevenueTenantsCount: Math.min(5, totalTenants),
      },
      occupancyMetrics: {
        averageOccupancyRate: 0, // Simplified - no complex calculation
        averageADR: Math.round(averageADR * 100) / 100,
        averageREVPAR: Math.round(averageREVPAR * 100) / 100,
      },
      tenantMetrics: {
        newTenantsThisMonth,
        newTenantsLastMonth: 0, // Simplified
        tenantGrowthRate: 0, // Simplified
        churnedTenants: 0,
        activeSubscriptions: {
          active: activeCount,
          suspended: suspendedCount,
          trial: trialCount,
          inactive: 0, // Simplified
        },
      },
      userMetrics: {
        totalActiveUsers: totalUsers, // Simplified
        totalAdminUsers: 0, // Simplified
        newfUsersThisMonth: 0, // Simplified
        averageUsersPerTenant: totalTenants > 0 ? totalUsers / totalTenants : 0,
      },
      alerts: [],
      timeline: [],
    };
  } catch (error: any) {
    console.error('Error calculating superadmin metrics:', error);
    throw new AppError('Failed to calculate dashboard metrics', 500);
  }
}

/**
 * Get top performing tenants by revenue
 */
export async function getTopTenantsByRevenue(limit: number = 5) {
  try {
    // Revenue = nightly rate x nights, aggregated per tenant in JS
    const revenueRows = await prisma?.reservation.findMany({
      select: { tenantId: true, rate: true, checkInDate: true, checkOutDate: true },
    }) || [];

    const revenueByTenant = new Map<string, number>();
    for (const r of revenueRows) {
      revenueByTenant.set(r.tenantId, (revenueByTenant.get(r.tenantId) || 0) + reservationRevenue(r));
    }

    const topTenants = await Promise.all(
      [...revenueByTenant.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(async ([tenantId, revenue]) => {
          const tenant = await prisma?.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, slug: true },
          });
          return {
            tenantId,
            tenantName: tenant?.name || 'Unknown',
            tenantSlug: tenant?.slug,
            totalRevenue: Math.round(revenue * 100) / 100,
          };
        })
    );

    return topTenants;
  } catch (error: any) {
    console.error('Error fetching top tenants:', error);
    throw new AppError('Failed to fetch top tenants', 500);
  }
}

/**
 * Helper: Calculate average occupancy across all rooms
 */
function calculateAverageOccupancy(
  reservations: any[],
  rooms: any[]
): number {
  if (rooms.length === 0) return 0;

  const occupiedRoomDays = new Set<string>();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  reservations.forEach((res: any) => {
    if (!res.checkInDate || !res.checkOutDate) return;

    const checkIn = new Date(res.checkInDate);
    const checkOut = new Date(res.checkOutDate);

    // Only count reservations in the last 30 days
    if (checkOut < thirtyDaysAgo || checkIn > now) return;

    for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      occupiedRoomDays.add(`${res.tenantId}-${d.toISOString().split('T')[0]}`);
    }
  });

  const totalRoomDays = rooms.length * 30;
  return (occupiedRoomDays.size / totalRoomDays) * 100;
}
