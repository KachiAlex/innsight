/**
 * Superadmin Metrics & Analytics Utility
 * Aggregates cross-tenant KPIs and business intelligence for superadmin dashboard
 */

import { prisma } from './prisma';
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
 * Get comprehensive superadmin dashboard metrics
 */
export async function getSuperadminDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Fetch all base data
    const [
      tenants,
      users,
      rooms,
      reservations,
      tenantsThisMonth,
      tenantsLastMonth,
    ] = await Promise.all([
      prisma?.tenant.findMany({
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          createdAt: true,
          _count: { select: { users: true, rooms: true, reservations: true } },
        },
      }) || [],
      prisma?.user.findMany({
        select: {
          id: true,
          role: true,
          tenantId: true,
          isActive: true,
        },
      }) || [],
      prisma?.room.findMany({
        select: { id: true, tenantId: true },
      }) || [],
      prisma?.reservation.findMany({
        select: {
          id: true,
          tenantId: true,
          totalPrice: true,
          checkInDate: true,
          checkOutDate: true,
        },
      }) || [],
      prisma?.tenant.findMany({
        where: {
          createdAt: { gte: oneMonthAgo },
        },
        select: { id: true },
      }) || [],
      prisma?.tenant.findMany({
        where: {
          createdAt: {
            gte: twoMonthsAgo,
            lt: oneMonthAgo,
          },
        },
        select: { id: true },
      }) || [],
    ]);

    // Calculate Total Stats
    const activeTenants = tenants.filter(
      (t: any) => t.subscriptionStatus === 'active'
    ).length;
    const totalUsers = users.length;
    const activeUsers = users.filter((u: any) => u.isActive).length;
    const adminUsers = users.filter((u: any) => u.role === 'owner').length;

    // Calculate Revenue Metrics
    const totalRevenue = reservations.reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0);
    const averageRevenuePerTenant = tenants.length > 0 ? totalRevenue / tenants.length : 0;

    // Revenue growth calculation
    const thisMonthRevenue = reservations
      .filter(
        (r: any) =>
          r.checkOutDate && new Date(r.checkOutDate) >= oneMonthAgo
      )
      .reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0);

    const lastMonthRevenue = reservations
      .filter(
        (r: any) =>
          r.checkOutDate &&
          new Date(r.checkOutDate) >= twoMonthsAgo &&
          new Date(r.checkOutDate) < oneMonthAgo
      )
      .reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0);

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    // Occupancy metrics (simplified - would need more complex calculation in production)
    const averageOccupancyRate = calculateAverageOccupancy(reservations, rooms);
    const averageADR = reservations.length > 0 ? totalRevenue / reservations.length : 0;
    const averageREVPAR = rooms.length > 0 ? totalRevenue / rooms.length : 0;

    // Tenant metrics
    const tenantGrowthRate =
      tenantsLastMonth.length > 0
        ? ((tenantsThisMonth.length - tenantsLastMonth.length) / tenantsLastMonth.length) * 100
        : 0;

    const subscriptionCounts = {
      active: tenants.filter((t: any) => t.subscriptionStatus === 'active').length,
      suspended: tenants.filter((t: any) => t.subscriptionStatus === 'suspended').length,
      trial: tenants.filter((t: any) => t.subscriptionStatus === 'trial').length,
      inactive: tenants.filter((t: any) => t.subscriptionStatus === 'inactive').length,
    };

    // Alerts
    const alerts: Alert[] = [];
    if (averageOccupancyRate < 40) {
      alerts.push({
        id: 'low-occupancy-' + Date.now(),
        severity: 'warning',
        message: `Platform average occupancy is low (${averageOccupancyRate.toFixed(1)}%). Consider marketing initiatives.`,
        createdAt: now,
      });
    }
    if (subscriptionCounts.suspended > tenants.length * 0.1) {
      alerts.push({
        id: 'high-suspension-' + Date.now(),
        severity: 'warning',
        message: `High number of suspended tenants (${subscriptionCounts.suspended}). Review customer health.`,
        createdAt: now,
      });
    }

    // Timeline (recent significant events) - simplified
    const timeline: TimelineEvent[] = tenantsThisMonth
      .slice(0, 5)
      .map((t: any, idx: number) => ({
        id: `event-${idx}`,
        type: 'tenant_created' as const,
        title: `New tenant created`,
        description: 'A new tenant has been onboarded',
        tenantId: t.id,
        timestamp: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      }));

    return {
      totalStats: {
        totalTenants: tenants.length,
        activeTenants,
        totalUsers,
        totalRooms: rooms.length,
        totalReservations: reservations.length,
      },
      revenueMetrics: {
        totalRevenue,
        averageRevenuePerTenant: Math.round(averageRevenuePerTenant * 100) / 100,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        topRevenueTenantsCount: Math.min(5, tenants.length),
      },
      occupancyMetrics: {
        averageOccupancyRate: Math.round(averageOccupancyRate * 10) / 10,
        averageADR: Math.round(averageADR * 100) / 100,
        averageREVPAR: Math.round(averageREVPAR * 100) / 100,
      },
      tenantMetrics: {
        newTenantsThisMonth: tenantsThisMonth.length,
        newTenantsLastMonth: tenantsLastMonth.length,
        tenantGrowthRate: Math.round(tenantGrowthRate * 10) / 10,
        churnedTenants: 0, // Would need more complex churn calculation
        activeSubscriptions: subscriptionCounts,
      },
      userMetrics: {
        totalActiveUsers: activeUsers,
        totalAdminUsers: adminUsers,
        newfUsersThisMonth: users.filter(
          (u: any) => new Date(u.createdAt) >= oneMonthAgo
        ).length,
        averageUsersPerTenant: tenants.length > 0 ? totalUsers / tenants.length : 0,
      },
      alerts,
      timeline,
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
    const reservations = await prisma?.reservation.findMany({
      select: {
        tenantId: true,
        totalPrice: true,
      },
    });

    const tenantRevenue: Record<string, number> = {};
    (reservations || []).forEach((r: any) => {
      if (!tenantRevenue[r.tenantId]) {
        tenantRevenue[r.tenantId] = 0;
      }
      tenantRevenue[r.tenantId] += r.totalPrice || 0;
    });

    const sortedTenants = Object.entries(tenantRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);

    const topTenants = await Promise.all(
      sortedTenants.map(async ([tenantId, revenue]) => {
        const tenant = await prisma?.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, name: true, slug: true },
        });
        return {
          tenantId,
          tenantName: tenant?.name,
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
