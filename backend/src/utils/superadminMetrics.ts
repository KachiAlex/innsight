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

    // Use optimized aggregate queries instead of fetching all data
    const [
      tenantCounts,
      userCounts,
      roomCount,
      reservationAggregates,
      tenantsThisMonthCount,
      tenantsLastMonthCount,
      subscriptionStatusCounts,
      usersThisMonthCount,
    ] = await Promise.all([
      // Total and active tenant counts
      prisma?.tenant.aggregate({
        _count: { id: true },
        where: { subscriptionStatus: 'active' },
      }) || { _count: { id: 0 } },
      
      // Total and active user counts
      Promise.all([
        prisma?.user.count() || 0,
        prisma?.user.count({ where: { isActive: true } }) || 0,
        prisma?.user.count({ where: { role: 'owner' } }) || 0,
      ]),
      
      // Total room count
      prisma?.room.count() || 0,
      
      // Reservation aggregates for revenue metrics
      Promise.all([
        prisma?.reservation.aggregate({
          _sum: { totalPrice: true },
          _count: { id: true },
        }) || { _sum: { totalPrice: 0 }, _count: { id: 0 } },
        prisma?.reservation.aggregate({
          _sum: { totalPrice: true },
          where: {
            checkOutDate: { gte: oneMonthAgo },
          },
        }) || { _sum: { totalPrice: 0 } },
        prisma?.reservation.aggregate({
          _sum: { totalPrice: true },
          where: {
            checkOutDate: {
              gte: twoMonthsAgo,
              lt: oneMonthAgo,
            },
          },
        }) || { _sum: { totalPrice: 0 } },
      ]),
      
      // New tenants counts
      prisma?.tenant.count({
        where: { createdAt: { gte: oneMonthAgo } },
      }) || 0,
      
      prisma?.tenant.count({
        where: {
          createdAt: {
            gte: twoMonthsAgo,
            lt: oneMonthAgo,
          },
        },
      }) || 0,
      
      // Subscription status counts
      Promise.all([
        prisma?.tenant.count({ where: { subscriptionStatus: 'active' } }) || 0,
        prisma?.tenant.count({ where: { subscriptionStatus: 'suspended' } }) || 0,
        prisma?.tenant.count({ where: { subscriptionStatus: 'trial' } }) || 0,
        prisma?.tenant.count({ where: { subscriptionStatus: 'inactive' } }) || 0,
      ]),
      
      // New users this month
      prisma?.user.count({
        where: { createdAt: { gte: oneMonthAgo } },
      }) || 0,
    ]);

    const totalTenants = await prisma?.tenant.count() || 0;
    const activeTenants = tenantCounts._count.id;
    const [totalUsers, activeUsers, adminUsers] = userCounts;
    const totalRooms = roomCount;
    const [totalReservationsAgg, thisMonthRevenueAgg, lastMonthRevenueAgg] = reservationAggregates;
    const totalReservations = totalReservationsAgg._count.id;
    const totalRevenue = totalReservationsAgg._sum.totalPrice || 0;
    const thisMonthRevenue = thisMonthRevenueAgg._sum.totalPrice || 0;
    const lastMonthRevenue = lastMonthRevenueAgg._sum.totalPrice || 0;
    const newTenantsThisMonth = tenantsThisMonthCount;
    const newTenantsLastMonth = tenantsLastMonthCount;
    const [activeCount, suspendedCount, trialCount, inactiveCount] = subscriptionStatusCounts;
    const newUsersThisMonth = usersThisMonthCount;

    // Calculate derived metrics
    const averageRevenuePerTenant = totalTenants > 0 ? totalRevenue / totalTenants : 0;
    const revenueGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;
    const tenantGrowthRate = newTenantsLastMonth > 0
      ? ((newTenantsThisMonth - newTenantsLastMonth) / newTenantsLastMonth) * 100
      : 0;
    const averageADR = totalReservations > 0 ? totalRevenue / totalReservations : 0;
    const averageREVPAR = totalRooms > 0 ? totalRevenue / totalRooms : 0;
    const averageUsersPerTenant = totalTenants > 0 ? totalUsers / totalTenants : 0;

    // Simplified occupancy rate (placeholder - would need complex date range calculation)
    const averageOccupancyRate = 65.0; // Default placeholder

    const subscriptionCounts = {
      active: activeCount,
      suspended: suspendedCount,
      trial: trialCount,
      inactive: inactiveCount,
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
    if (suspendedCount > totalTenants * 0.1) {
      alerts.push({
        id: 'high-suspension-' + Date.now(),
        severity: 'warning',
        message: `High number of suspended tenants (${suspendedCount}). Review customer health.`,
        createdAt: now,
      });
    }

    // Timeline (simplified - fetch recent tenants)
    const recentTenants = await prisma?.tenant.findMany({
      where: { createdAt: { gte: oneMonthAgo } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }) || [];

    const timeline: TimelineEvent[] = recentTenants.map((t: any, idx: number) => ({
      id: `event-${idx}`,
      type: 'tenant_created' as const,
      title: `New tenant created`,
      description: 'A new tenant has been onboarded',
      tenantId: t.id,
      timestamp: t.createdAt,
    }));

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
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        topRevenueTenantsCount: Math.min(5, totalTenants),
      },
      occupancyMetrics: {
        averageOccupancyRate: Math.round(averageOccupancyRate * 10) / 10,
        averageADR: Math.round(averageADR * 100) / 100,
        averageREVPAR: Math.round(averageREVPAR * 100) / 100,
      },
      tenantMetrics: {
        newTenantsThisMonth,
        newTenantsLastMonth,
        tenantGrowthRate: Math.round(tenantGrowthRate * 10) / 10,
        churnedTenants: 0,
        activeSubscriptions: subscriptionCounts,
      },
      userMetrics: {
        totalActiveUsers: activeUsers,
        totalAdminUsers: adminUsers,
        newfUsersThisMonth: newUsersThisMonth,
        averageUsersPerTenant: Math.round(averageUsersPerTenant * 10) / 10,
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
    // Use Prisma's groupBy to calculate revenue per tenant efficiently
    const tenantRevenue = await prisma?.reservation.groupBy({
      by: ['tenantId'],
      _sum: {
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc',
        },
      },
      take: limit,
    }) || [];

    const topTenants = await Promise.all(
      tenantRevenue.map(async (tr: any) => {
        const tenant = await prisma?.tenant.findUnique({
          where: { id: tr.tenantId },
          select: { id: true, name: true, slug: true },
        });
        return {
          tenantId: tr.tenantId,
          tenantName: tenant?.name || 'Unknown',
          tenantSlug: tenant?.slug,
          totalRevenue: Math.round((tr._sum.totalPrice || 0) * 100) / 100,
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
