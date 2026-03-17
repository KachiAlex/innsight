/**
 * System Health Monitoring Utilities
 */

import { prisma } from './prisma';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  metrics: {
    activeTenants: number;
    totalUsers: number;
    errorRate: number;
    avgResponseTime: number;
    uptime: number;
    databaseStatus: 'connected' | 'disconnected';
  };
  alerts: Array<{
    severity: 'warning' | 'critical';
    message: string;
    component: string;
  }>;
}

export const getSystemHealth = async (): Promise<SystemHealth> => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get metrics
    const [activeTenants, recentErrors, totalUsers] = await Promise.all([
      prisma.tenant.count({ where: { subscriptionStatus: 'active' } }),
      prisma.audit.count({
        where: {
          createdAt: { gte: oneHourAgo },
          metadata: { path: 'status', equals: 'error' },
        },
      }),
      prisma.user.count(),
    ]);

    // Calculate error rate
    const totalActions = await prisma.audit.count({
      where: { createdAt: { gte: oneHourAgo } },
    });

    const errorRate = totalActions > 0 ? Math.round((recentErrors / totalActions) * 100) : 0;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const alerts: Array<{ severity: 'warning' | 'critical'; message: string; component: string }> = [];

    if (errorRate > 25) {
      status = 'critical';
      alerts.push({
        severity: 'critical',
        message: `High error rate detected: ${errorRate}%`,
        component: 'API',
      });
    } else if (errorRate > 10) {
      status = 'degraded';
      alerts.push({
        severity: 'warning',
        message: `Elevated error rate: ${errorRate}%`,
        component: 'API',
      });
    }

    if (activeTenants === 0) {
      status = 'critical';
      alerts.push({
        severity: 'critical',
        message: 'No active tenants detected',
        component: 'Tenants',
      });
    }

    return {
      status,
      timestamp: now,
      metrics: {
        activeTenants,
        totalUsers,
        errorRate,
        avgResponseTime: 150, // Mock value
        uptime: 99.9, // Mock value
        databaseStatus: 'connected',
      },
      alerts,
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'critical',
      timestamp: new Date(),
      metrics: {
        activeTenants: 0,
        totalUsers: 0,
        errorRate: 100,
        avgResponseTime: 0,
        uptime: 0,
        databaseStatus: 'disconnected',
      },
      alerts: [
        {
          severity: 'critical',
          message: 'Failed to retrieve system health metrics',
          component: 'System',
        },
      ],
    };
  }
};
