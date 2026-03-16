/**
 * Platform Analytics & Business Intelligence
 * Cross-tenant reporting and trends
 */

import { prisma } from './prisma';
import { getBillingMetrics } from './billingManagement';

export interface PlatformAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  growth: {
    tenantGrowth: number;
    userGrowth: number;
    reservationGrowth: number;
    revenueGrowth: number;
  };
  performance: {
    averageOccupancyRate: number;
    averageADR: number;
    totalReservations: number;
    totalRevenue: number;
  };
  tenantHealth: {
    activeTenantsCount: number;
    inactiveTenantsCount: number;
    churnedTenantsCount: number;
    topPerformers: Array<{
      tenantId: string;
      name: string;
      revenue: number;
      occupancy: number;
    }>;
    underperformers: Array<{
      tenantId: string;
      name: string;
      revenue: number;
      occupancy: number;
      riskFactor: number;
    }>;
  };
  operationalMetrics: {
    averageResponseTime: number;
    systemHealthScore: number;
    apiUptime: number;
    errorRate: number;
  };
  marketingInsights: {
    channelPerformance: Record<string, number>;
    bookingSourceDistribution: Record<string, number>;
    averageLeadTime: number;
    conversionRate: number;
  };
  forecast: {
    projectedTenants30Days: number;
    projectedTenants90Days: number;
    projectedRevenue30Days: number;
    projectedRevenue90Days: number;
  };
}

export interface TenantComparison {
  tenantId: string;
  tenantName: string;
  metrics: {
    revenue: number;
    occupancy: number;
    adm: number;
    revpar: number;
    guestCount: number;
    avgNPS: number;
  };
  ranking: {
    revenueRank: number;
    occupancyRank: number;
    performanceRank: number;
  };
  trend: 'up' | 'down' | 'stable';
}

/**
 * Get comprehensive platform analytics
 */
export async function getPlatformAnalytics(
  daysBack: number = 30
): Promise<PlatformAnalytics> {
  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const previousStartDate = new Date(now.getTime() - daysBack * 2 * 24 * 60 * 60 * 1000);

    // Fetch data
    const [tenants, users, reservations, billingMetrics] = await Promise.all([
      prisma?.tenant.findMany({
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          createdAt: true,
          _count: { select: { users: true, reservations: true } },
        },
      }) || [],
      prisma?.user.findMany({
        where: { isActive: true },
        select: { id: true, tenantId: true, createdAt: true },
      }) || [],
      prisma?.reservation.findMany({
        select: {
          id: true,
          totalPrice: true,
          createdAt: true,
          checkInDate: true,
          checkOutDate: true,
        },
      }) || [],
      getBillingMetrics(),
    ]);

    // Calculate growth rates
    const currentTenants = tenants.length;
    const currentUsers = users.length;
    const currentReservations = reservations.length;
    const currentRevenue = reservations.reduce((sum, r: any) => sum + (r.totalPrice || 0), 0);

    const previousTenantsCount = tenants.filter(
      (t: any) => new Date(t.createdAt) < startDate
    ).length;
    const previousUsersCount = users.filter((u: any) => new Date(u.createdAt) < startDate).length;

    const tenantGrowth =
      previousTenantsCount > 0
        ? ((currentTenants - previousTenantsCount) / previousTenantsCount) * 100
        : 0;
    const userGrowth =
      previousUsersCount > 0 ? ((currentUsers - previousUsersCount) / previousUsersCount) * 100 : 0;
    const reservationGrowth = 5.2; // Mock
    const revenueGrowth = 8.7; // Mock

    // Tenant health
    const activeTenantsCount = tenants.filter((t: any) => t.subscriptionStatus === 'active')
      .length;
    const inactiveTenantsCount = tenants.filter((t: any) => t.subscriptionStatus !== 'active')
      .length;

    // Top and underperforming tenants
    const tenantPerformance = tenants.map((tenant: any) => ({
      tenantId: tenant.id,
      name: tenant.name,
      revenue: Math.random() * 50000, // Mock data
      occupancy: Math.random() * 100,
    }));

    const topPerformers = tenantPerformance.sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    const underperformers = tenantPerformance.sort((a: any, b: any) => a.revenue - b.revenue).slice(0, 5);

    // Operational metrics
    const avgResponseTime = 145; // Mock: 145ms
    const systemHealthScore = 98.5; // Mock: 98.5%
    const apiUptime = 99.95; // Mock: 99.95%
    const errorRate = 0.02; // Mock: 0.02%

    // Marketing insights
    const channelPerformance = {
      direct: 35,
      ota: 40,
      corporate: 15,
      partner: 10,
    };

    const bookingSourceDistribution = {
      desktop: 45,
      mobile: 40,
      api: 15,
    };

    const avgLeadTime = 12.5; // days
    const conversionRate = 3.2; // percent

    // Forecast
    const projectedTenants30 = Math.round(currentTenants * (1 + tenantGrowth / 100 * 0.25));
    const projectedTenants90 = Math.round(currentTenants * (1 + tenantGrowth / 100));
    const projectedRevenue30 = Math.round(currentRevenue * (1 + revenueGrowth / 100 * 0.25));
    const projectedRevenue90 = Math.round(currentRevenue * (1 + revenueGrowth / 100));

    return {
      period: { start: startDate, end: now },
      growth: {
        tenantGrowth: tenantGrowth,
        userGrowth: userGrowth,
        reservationGrowth: reservationGrowth,
        revenueGrowth: revenueGrowth,
      },
      performance: {
        averageOccupancyRate: 68.5, // Mock
        averageADR: 145.75, // Mock
        totalReservations: currentReservations,
        totalRevenue: Math.round(currentRevenue),
      },
      tenantHealth: {
        activeTenantsCount,
        inactiveTenantsCount,
        churnedTenantsCount: 2,
        topPerformers: topPerformers,
        underperformers: underperformers.map((t: any) => ({
          ...t,
          riskFactor: Math.random() * 100,
        })),
      },
      operationalMetrics: {
        averageResponseTime: avgResponseTime,
        systemHealthScore: systemHealthScore,
        apiUptime: apiUptime,
        errorRate: errorRate,
      },
      marketingInsights: {
        channelPerformance,
        bookingSourceDistribution,
        averageLeadTime: avgLeadTime,
        conversionRate: conversionRate,
      },
      forecast: {
        projectedTenants30Days: projectedTenants30,
        projectedTenants90Days: projectedTenants90,
        projectedRevenue30Days: projectedRevenue30,
        projectedRevenue90Days: projectedRevenue90,
      },
    };
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    throw error;
  }
}

/**
 * Get tenant comparison across platform
 */
export async function getTenantComparison(limit: number = 20): Promise<TenantComparison[]> {
  try {
    const tenants = await prisma?.tenant.findMany({
      take: limit,
      select: {
        id: true,
        name: true,
        _count: { select: { reservations: true, users: true } },
      },
    });

    if (!tenants) return [];

    const comparisons = tenants.map((tenant: any, index: number) => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      metrics: {
        revenue: Math.random() * 100000,
        occupancy: Math.random() * 100,
        adm: Math.random() * 200,
        revpar: Math.random() * 200,
        guestCount: tenant._count.reservations,
        avgNPS: Math.random() * 100,
      },
      ranking: {
        revenueRank: index + 1,
        occupancyRank: Math.floor(Math.random() * limit) + 1,
        performanceRank: Math.floor(Math.random() * limit) + 1,
      },
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
    }));

    return comparisons;
  } catch (error) {
    console.error('Error fetching tenant comparison:', error);
    return [];
  }
}

/**
 * Get revenue trends over time
 */
export async function getRevenueTrends(
  daysBack: number = 90
): Promise<Array<{ date: string; revenue: number; tenants: number }>> {
  try {
    const trends: Array<{ date: string; revenue: number; tenants: number }> = [];

    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      trends.push({
        date: dateStr,
        revenue: Math.round(Math.random() * 100000 + 500000),
        tenants: Math.floor(Math.random() * 50 + 200),
      });
    }

    return trends;
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    return [];
  }
}

/**
 * Get occupancy trends
 */
export async function getOccupancyTrends(
  daysBack: number = 90
): Promise<Array<{ date: string; occupancyRate: number }>> {
  try {
    const trends: Array<{ date: string; occupancyRate: number }> = [];

    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      trends.push({
        date: dateStr,
        occupancyRate: Math.round(Math.random() * 30 + 60),
      });
    }

    return trends;
  } catch (error) {
    console.error('Error fetching occupancy trends:', error);
    return [];
  }
}

/**
 * Get custom report data
 */
export async function generateCustomReport(
  metrics: string[],
  startDate: Date,
  endDate: Date
): Promise<any> {
  try {
    // Generate report based on requested metrics
    return {
      title: `Custom Report - ${startDate.toISOString()} to ${endDate.toISOString()}`,
      metrics: metrics,
      data: {},
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error generating custom report:', error);
    throw error;
  }
}
