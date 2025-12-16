import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import admin from 'firebase-admin';

export const analyticsRouter = Router({ mergeParams: true });

// ============================================
// BUSINESS INTELLIGENCE DASHBOARD
// ============================================

// GET /api/tenants/:tenantId/analytics/dashboard - Get main dashboard metrics
analyticsRouter.get('/dashboard', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get key metrics
    const dashboardData = await Promise.all([
      getRevenueMetrics(tenantId, startDate, endDate),
      getOccupancyMetrics(tenantId, startDate, endDate),
      getGuestSatisfactionMetrics(tenantId, startDate, endDate),
      getOperationalMetrics(tenantId, startDate, endDate),
    ]);

    const [revenue, occupancy, satisfaction, operational] = dashboardData;

    // Calculate trends (compare with previous period)
    const previousPeriodStart = new Date(startDate);
    const previousPeriodEnd = new Date(startDate);

    if (period === '7d') {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 7);
    } else if (period === '30d') {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 30);
    } else if (period === '90d') {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 90);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 90);
    } else {
      previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
      previousPeriodEnd.setFullYear(previousPeriodEnd.getFullYear() - 1);
    }

    const previousRevenue = await getRevenueMetrics(tenantId, previousPeriodStart, previousPeriodEnd);

    // Calculate percentage changes
    const revenueChange = previousRevenue.totalRevenue > 0
      ? ((revenue.totalRevenue - previousRevenue.totalRevenue) / previousRevenue.totalRevenue) * 100
      : 0;

    res.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        revenue: {
          ...revenue,
          changePercent: Math.round(revenueChange * 100) / 100,
        },
        occupancy,
        satisfaction,
        operational,
        alerts: await getActiveAlerts(tenantId),
        trends: {
          revenue: await getRevenueTrend(tenantId, startDate, endDate),
          occupancy: await getOccupancyTrend(tenantId, startDate, endDate),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    throw new AppError(
      `Failed to fetch dashboard data: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/analytics/revenue - Detailed revenue analytics
analyticsRouter.get('/revenue', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const revenueData = await getRevenueBreakdown(tenantId, start, end, groupBy as string);

    res.json({
      success: true,
      data: revenueData,
    });
  } catch (error: any) {
    console.error('Error fetching revenue analytics:', error);
    throw new AppError(
      `Failed to fetch revenue analytics: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/analytics/guests - Guest behavior analytics
analyticsRouter.get('/guests', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const guestAnalytics = await Promise.all([
      getGuestDemographics(tenantId),
      getGuestPreferences(tenantId),
      getRepeatGuestMetrics(tenantId),
      getGuestSatisfactionTrends(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        demographics: guestAnalytics[0],
        preferences: guestAnalytics[1],
        repeatGuests: guestAnalytics[2],
        satisfaction: guestAnalytics[3],
      },
    });
  } catch (error: any) {
    console.error('Error fetching guest analytics:', error);
    throw new AppError(
      `Failed to fetch guest analytics: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/analytics/operations - Operational efficiency metrics
analyticsRouter.get('/operations', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const operationalData = await Promise.all([
      getHousekeepingMetrics(tenantId),
      getMaintenanceMetrics(tenantId),
      getGuestRequestMetrics(tenantId),
      getRoomServiceMetrics(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        housekeeping: operationalData[0],
        maintenance: operationalData[1],
        guestRequests: operationalData[2],
        roomService: operationalData[3],
      },
    });
  } catch (error: any) {
    console.error('Error fetching operational analytics:', error);
    throw new AppError(
      `Failed to fetch operational analytics: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// PREDICTIVE ANALYTICS
// ============================================

// GET /api/tenants/:tenantId/analytics/predictions/demand - Demand forecasting
analyticsRouter.get('/predictions/demand', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { days = 30 } = req.query;

    const predictions = await generateDemandForecast(tenantId, parseInt(days as string));

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error: any) {
    console.error('Error generating demand forecast:', error);
    throw new AppError(
      `Failed to generate demand forecast: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/analytics/predictions/revenue - Revenue forecasting
analyticsRouter.get('/predictions/revenue', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { days = 30 } = req.query;

    const predictions = await generateRevenueForecast(tenantId, parseInt(days as string));

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error: any) {
    console.error('Error generating revenue forecast:', error);
    throw new AppError(
      `Failed to generate revenue forecast: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// REAL-TIME MONITORING
// ============================================

// GET /api/tenants/:tenantId/analytics/realtime - Real-time operational status
analyticsRouter.get('/realtime', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const realtimeData = await Promise.all([
      getCurrentOccupancy(tenantId),
      getActiveReservations(tenantId),
      getPendingTasks(tenantId),
      getSystemHealth(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        occupancy: realtimeData[0],
        reservations: realtimeData[1],
        tasks: realtimeData[2],
        system: realtimeData[3],
      },
    });
  } catch (error: any) {
    console.error('Error fetching realtime data:', error);
    throw new AppError(
      `Failed to fetch realtime data: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getRevenueMetrics(tenantId: string, startDate: Date, endDate: Date) {
  try {
    // Room revenue from reservations
    const roomRevenueQuery = db.collection('reservations')
      .where('tenantId', '==', tenantId)
      .where('status', 'in', ['confirmed', 'checked_in', 'checked_out'])
      .where('checkInDate', '>=', toTimestamp(startDate))
      .where('checkInDate', '<=', toTimestamp(endDate));

    const roomRevenueSnapshot = await roomRevenueQuery.get();
    let roomRevenue = 0;
    roomRevenueSnapshot.docs.forEach(doc => {
      const data = doc.data();
      roomRevenue += Number(data.rate || 0);
    });

    // Room service revenue
    const roomServiceQuery = db.collection('room_service_orders')
      .where('tenantId', '==', tenantId)
      .where('status', '==', 'delivered')
      .where('requestedAt', '>=', toTimestamp(startDate))
      .where('requestedAt', '<=', toTimestamp(endDate));

    const roomServiceSnapshot = await roomServiceQuery.get();
    let roomServiceRevenue = 0;
    roomServiceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      roomServiceRevenue += Number(data.totalAmount || 0);
    });

    const totalRevenue = roomRevenue + roomServiceRevenue;

    return {
      totalRevenue,
      roomRevenue,
      roomServiceRevenue,
      averageDailyRate: roomRevenue / Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),
    };
  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    return { totalRevenue: 0, roomRevenue: 0, roomServiceRevenue: 0, averageDailyRate: 0 };
  }
}

async function getOccupancyMetrics(tenantId: string, startDate: Date, endDate: Date) {
  try {
    const totalRoomsQuery = db.collection('rooms').where('tenantId', '==', tenantId);
    const totalRoomsSnapshot = await totalRoomsQuery.get();
    const totalRooms = totalRoomsSnapshot.size;

    const occupiedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalRoomDays = totalRooms * occupiedDays;

    // Count occupied room days
    const reservationsQuery = db.collection('reservations')
      .where('tenantId', '==', tenantId)
      .where('status', 'in', ['confirmed', 'checked_in'])
      .where('checkInDate', '<=', toTimestamp(endDate))
      .where('checkOutDate', '>=', toTimestamp(startDate));

    const reservationsSnapshot = await reservationsQuery.get();
    let occupiedRoomDays = 0;

    reservationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const checkIn = toDate(data.checkInDate);
      const checkOut = toDate(data.checkOutDate);

      if (checkIn && checkOut) {
        const overlapStart = checkIn > startDate ? checkIn : startDate;
        const overlapEnd = checkOut < endDate ? checkOut : endDate;

        if (overlapStart < overlapEnd) {
          occupiedRoomDays += Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    });

    const occupancyRate = totalRoomDays > 0 ? (occupiedRoomDays / totalRoomDays) * 100 : 0;

    return {
      totalRooms,
      occupiedRoomDays,
      totalRoomDays,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
    };
  } catch (error) {
    console.error('Error calculating occupancy metrics:', error);
    return { totalRooms: 0, occupiedRoomDays: 0, totalRoomDays: 0, occupancyRate: 0 };
  }
}

async function getGuestSatisfactionMetrics(tenantId: string, startDate: Date, endDate: Date) {
  try {
    // This would typically come from guest feedback/surveys
    // For now, we'll use proxy metrics like request resolution time and repeat visits

    const requestsQuery = db.collection('guest_requests')
      .where('tenantId', '==', tenantId)
      .where('createdAt', '>=', toTimestamp(startDate))
      .where('createdAt', '<=', toTimestamp(endDate));

    const requestsSnapshot = await requestsQuery.get();
    const totalRequests = requestsSnapshot.size;

    let resolvedRequests = 0;
    let avgResolutionTime = 0;
    let urgentRequests = 0;

    requestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        resolvedRequests++;
      }
      if (data.priority === 'urgent') {
        urgentRequests++;
      }
    });

    const resolutionRate = totalRequests > 0 ? (resolvedRequests / totalRequests) * 100 : 0;
    const urgentResolutionRate = urgentRequests > 0 ? (resolvedRequests / urgentRequests) * 100 : 0;

    return {
      totalRequests,
      resolvedRequests,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      urgentRequests,
      urgentResolutionRate: Math.round(urgentResolutionRate * 100) / 100,
      avgResolutionTime,
    };
  } catch (error) {
    console.error('Error calculating guest satisfaction metrics:', error);
    return {
      totalRequests: 0,
      resolvedRequests: 0,
      resolutionRate: 0,
      urgentRequests: 0,
      urgentResolutionRate: 0,
      avgResolutionTime: 0,
    };
  }
}

async function getOperationalMetrics(tenantId: string, startDate: Date, endDate: Date) {
  try {
    const metrics = await Promise.all([
      // Housekeeping tasks
      db.collection('housekeeping_tasks')
        .where('tenantId', '==', tenantId)
        .where('createdAt', '>=', toTimestamp(startDate))
        .where('createdAt', '<=', toTimestamp(endDate))
        .get(),

      // Maintenance tickets
      db.collection('maintenance_tickets')
        .where('tenantId', '==', tenantId)
        .where('createdAt', '>=', toTimestamp(startDate))
        .where('createdAt', '<=', toTimestamp(endDate))
        .get(),

      // Guest requests
      db.collection('guest_requests')
        .where('tenantId', '==', tenantId)
        .where('createdAt', '>=', toTimestamp(startDate))
        .where('createdAt', '<=', toTimestamp(endDate))
        .get(),
    ]);

    const housekeepingTasks = metrics[0].size;
    const maintenanceTickets = metrics[1].size;
    const guestRequests = metrics[2].size;

    return {
      housekeepingTasks,
      maintenanceTickets,
      guestRequests,
      totalTasks: housekeepingTasks + maintenanceTickets + guestRequests,
    };
  } catch (error) {
    console.error('Error calculating operational metrics:', error);
    return {
      housekeepingTasks: 0,
      maintenanceTickets: 0,
      guestRequests: 0,
      totalTasks: 0,
    };
  }
}

async function getActiveAlerts(tenantId: string) {
  try {
    const alertsQuery = db.collection('smart_alerts')
      .where('tenantId', '==', tenantId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(5);

    const alertsSnapshot = await alertsQuery.get();
    return alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    }));
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    return [];
  }
}

async function getRevenueTrend(tenantId: string, startDate: Date, endDate: Date) {
  try {
    // Generate daily revenue data for the period
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trend: any[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRevenue = await getRevenueMetrics(tenantId, dayStart, dayEnd);

      trend.push({
        date: date.toISOString().split('T')[0],
        revenue: dayRevenue.totalRevenue,
      });
    }

    return trend;
  } catch (error) {
    console.error('Error calculating revenue trend:', error);
    return [];
  }
}

async function getOccupancyTrend(tenantId: string, startDate: Date, endDate: Date) {
  try {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trend: any[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const occupancy = await getOccupancyMetrics(tenantId, date, date);

      trend.push({
        date: date.toISOString().split('T')[0],
        occupancyRate: occupancy.occupancyRate,
      });
    }

    return trend;
  } catch (error) {
    console.error('Error calculating occupancy trend:', error);
    return [];
  }
}

async function getRevenueBreakdown(tenantId: string, startDate: Date, endDate: Date, groupBy: string) {
  // Implementation for detailed revenue breakdown
  return {
    total: 0,
    breakdown: [],
    trends: [],
  };
}

async function getGuestDemographics(tenantId: string) {
  // Implementation for guest demographics
  return {
    totalGuests: 0,
    countries: [],
    ageGroups: [],
    vipPercentage: 0,
  };
}

async function getGuestPreferences(tenantId: string) {
  // Implementation for guest preferences
  return {
    roomTypes: [],
    amenities: [],
    dietary: [],
  };
}

async function getRepeatGuestMetrics(tenantId: string) {
  // Implementation for repeat guest metrics
  return {
    repeatGuestRate: 0,
    averageVisits: 0,
    loyaltyTierDistribution: [],
  };
}

async function getGuestSatisfactionTrends(tenantId: string) {
  // Implementation for satisfaction trends
  return {
    overallRating: 0,
    trend: [],
    categories: [],
  };
}

async function getHousekeepingMetrics(tenantId: string) {
  // Implementation for housekeeping metrics
  return {
    totalTasks: 0,
    completedTasks: 0,
    averageCompletionTime: 0,
    roomTurnoverTime: 0,
  };
}

async function getMaintenanceMetrics(tenantId: string) {
  // Implementation for maintenance metrics
  return {
    totalTickets: 0,
    resolvedTickets: 0,
    averageResolutionTime: 0,
    preventiveMaintenance: 0,
  };
}

async function getGuestRequestMetrics(tenantId: string) {
  // Implementation for guest request metrics
  return {
    totalRequests: 0,
    resolvedRequests: 0,
    averageResolutionTime: 0,
    categoryBreakdown: [],
  };
}

async function getRoomServiceMetrics(tenantId: string) {
  // Implementation for room service metrics
  return {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    popularItems: [],
  };
}

async function generateDemandForecast(tenantId: string, days: number) {
  // Implementation for demand forecasting
  return {
    forecast: [],
    confidence: 0,
    factors: [],
  };
}

async function generateRevenueForecast(tenantId: string, days: number) {
  // Implementation for revenue forecasting
  return {
    forecast: [],
    confidence: 0,
    scenarios: [],
  };
}

async function getCurrentOccupancy(tenantId: string) {
  // Implementation for current occupancy
  return {
    occupied: 0,
    total: 0,
    percentage: 0,
  };
}

async function getActiveReservations(tenantId: string) {
  // Implementation for active reservations
  return {
    today: 0,
    upcoming: 0,
    checkIns: 0,
    checkOuts: 0,
  };
}

async function getPendingTasks(tenantId: string) {
  // Implementation for pending tasks
  return {
    housekeeping: 0,
    maintenance: 0,
    guestRequests: 0,
    total: 0,
  };
}

async function getSystemHealth(tenantId: string) {
  // Implementation for system health
  return {
    status: 'healthy',
    uptime: 0,
    alerts: 0,
    performance: 'good',
  };
}
