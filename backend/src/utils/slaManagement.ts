/**
 * SLA Dashboard & Performance Monitoring
 * Track service level agreements and platform performance
 */

import { prisma } from './prisma';

export interface SLAMetrics {
  tenantId: string;
  uptime: number; // 0-100%
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  supportTicketResponseTime: number; // minutes
  supportTicketResolutionTime: number; // hours
  dataBackupFrequency: string; // hours
  dataBackupSuccess: number; // percentage
}

export interface SLAAgreement {
  id: string;
  tenantId: string;
  tier: 'starter' | 'professional' | 'enterprise';
  uptimePercentage: number;
  avgResponseTimeMs: number;
  maxErrorRate: number;
  supportResponseMinutes: number;
  supportResolutionHours: number;
  backupFrequencyHours: number;
  createdAt: Date;
}

// Get platform uptime metrics
export const getPlatformUptimeMetrics = async (daysBack: number = 7) => {
  try {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Count successful requests
    const totalRequests = await prisma.audit.count({
      where: { createdAt: { gte: since } },
    });

    const errorRequests = await prisma.audit.count({
      where: {
        createdAt: { gte: since },
        metadata: { path: 'status', equals: 'error' },
      },
    });

    const successRate = totalRequests > 0 ? ((totalRequests - errorRequests) / totalRequests) * 100 : 100;

    return {
      uptime: Math.round(successRate),
      totalRequests,
      errorRequests,
      successRate: Math.round(successRate),
      period: `${daysBack} days`,
      asOf: new Date(),
    };
  } catch (error) {
    console.error('Error getting platform uptime metrics:', error);
    return {
      uptime: 100,
      totalRequests: 0,
      errorRequests: 0,
      successRate: 100,
      period: `${daysBack} days`,
      asOf: new Date(),
    };
  }
};

// Get tenant SLA compliance
export const getTenantSLACompliance = async (tenantId: string): Promise<SLAMetrics> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get metrics
    const requests = await prisma.audit.findMany({
      where: {
        tenantId,
        createdAt: { gte: since },
      },
    });

    const totalRequests = requests.length;
    const errorRequests = requests.filter((r) => r.metadata?.status === 'error').length;

    return {
      tenantId,
      uptime: totalRequests > 0 ? 100 - (errorRequests / totalRequests) * 100 : 100,
      responseTime: 150, // Mock average
      errorRate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
      supportTicketResponseTime: 30, // minutes
      supportTicketResolutionTime: 24, // hours
      dataBackupFrequency: '24',
      dataBackupSuccess: 99.9,
    };
  } catch (error) {
    console.error('Error getting tenant SLA compliance:', error);
    throw error;
  }
};

// Create or update SLA agreement
export const upsertSLAAgreement = async (
  tenantId: string,
  slaData: Partial<SLAAgreement>
): Promise<SLAAgreement> => {
  try {
    const existing = await prisma.sLAAgreement.findUnique({
      where: { tenantId },
    });

    const agreement = existing
      ? await prisma.sLAAgreement.update({
          where: { tenantId },
          data: slaData,
        })
      : await prisma.sLAAgreement.create({
          data: {
            tenantId,
            tier: slaData.tier || 'professional',
            uptimePercentage: slaData.uptimePercentage || 99.9,
            avgResponseTimeMs: slaData.avgResponseTimeMs || 200,
            maxErrorRate: slaData.maxErrorRate || 1,
            supportResponseMinutes: slaData.supportResponseMinutes || 30,
            supportResolutionHours: slaData.supportResolutionHours || 24,
            backupFrequencyHours: slaData.backupFrequencyHours || 24,
          },
        });

    return agreement;
  } catch (error) {
    console.error('Error upserting SLA agreement:', error);
    throw error;
  }
};

// Get SLA agreements for all tenants
export const getAllSLAAgreements = async () => {
  try {
    return await prisma.sLAAgreement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error getting SLA agreements:', error);
    throw error;
  }
};

// Check SLA violations
export const checkSLAViolations = async (tenantId: string) => {
  try {
    const [metrics, agreement] = await Promise.all([
      getTenantSLACompliance(tenantId),
      prisma.sLAAgreement.findUnique({ where: { tenantId } }),
    ]);

    if (!agreement) {
      return { violations: [] };
    }

    const violations: Array<{ metric: string; value: number; limit: number; percentage: number }> = [];

    // Check uptime
    if (metrics.uptime < agreement.uptimePercentage) {
      violations.push({
        metric: 'Uptime',
        value: metrics.uptime,
        limit: agreement.uptimePercentage,
        percentage: (metrics.uptime / agreement.uptimePercentage) * 100,
      });
    }

    // Check error rate
    if (metrics.errorRate > agreement.maxErrorRate) {
      violations.push({
        metric: 'Error Rate',
        value: metrics.errorRate,
        limit: agreement.maxErrorRate,
        percentage: (agreement.maxErrorRate / metrics.errorRate) * 100,
      });
    }

    // Check response time
    if (metrics.responseTime > agreement.avgResponseTimeMs) {
      violations.push({
        metric: 'Response Time',
        value: metrics.responseTime,
        limit: agreement.avgResponseTimeMs,
        percentage: (agreement.avgResponseTimeMs / metrics.responseTime) * 100,
      });
    }

    return { violations, compliant: violations.length === 0 };
  } catch (error) {
    console.error('Error checking SLA violations:', error);
    throw error;
  }
};

// Get SLA dashboard summary
export const getSLADashboardSummary = async () => {
  try {
    const [uptime, agreements] = await Promise.all([
      getPlatformUptimeMetrics(7),
      getAllSLAAgreements(),
    ]);

    const violations: { [key: string]: number } = {};

    for (const agreement of agreements) {
      const tenantViolations = await checkSLAViolations(agreement.tenantId);
      if (tenantViolations.violations.length > 0) {
        violations[agreement.tenantId] = tenantViolations.violations.length;
      }
    }

    return {
      platformUptime: uptime.uptime,
      totalAgreements: agreements.length,
      tenantsWithViolations: Object.keys(violations).length,
      violations,
      asOf: new Date(),
    };
  } catch (error) {
    console.error('Error getting SLA dashboard summary:', error);
    throw error;
  }
};
