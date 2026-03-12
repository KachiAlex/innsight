/**
 * Analytics utility for tracking tenant creation metrics
 * Useful for monitoring and observability
 */

interface TenantCreationMetrics {
  tenantId: string;
  slug: string;
  createdById: string;
  timestamp: Date;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

const metricsBuffer: TenantCreationMetrics[] = [];

/**
 * Track tenant creation metrics
 */
export const trackTenantCreation = (metrics: TenantCreationMetrics) => {
  metricsBuffer.push(metrics);

  // Keep buffer manageable (last 100 events)
  if (metricsBuffer.length > 100) {
    metricsBuffer.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Tenant ${metrics.success ? '✓' : '✗'} ${metrics.slug}`, {
      duration: `${metrics.durationMs}ms`,
      error: metrics.errorCode,
    });
  }

  // TODO: Send to analytics service (e.g., DataDog, New Relic, Segment)
  // Example:
  // analytics.track('tenant.created', {
  //   tenantId: metrics.tenantId,
  //   duration: metrics.durationMs,
  //   success: metrics.success,
  // });
};

/**
 * Get recent tenant creation metrics
 */
export const getRecentMetrics = (limit: number = 10) => {
  return metricsBuffer.slice(-limit);
};

/**
 * Get tenant creation statistics
 */
export const getTenantCreationStats = () => {
  const total = metricsBuffer.length;
  const successful = metricsBuffer.filter((m) => m.success).length;
  const failed = total - successful;
  const avgDuration =
    total > 0 ? metricsBuffer.reduce((sum, m) => sum + m.durationMs, 0) / total : 0;

  const errorCounts: Record<string, number> = {};
  metricsBuffer.forEach((m) => {
    if (m.errorCode) {
      errorCounts[m.errorCode] = (errorCounts[m.errorCode] || 0) + 1;
    }
  });

  return {
    total,
    successful,
    failed,
    successRate: `${((successful / total) * 100).toFixed(2)}%`,
    avgDurationMs: `${avgDuration.toFixed(0)}ms`,
    errorCounts,
  };
};

/**
 * Clear metrics buffer (for testing)
 */
export const clearMetrics = () => {
  metricsBuffer.length = 0;
};
