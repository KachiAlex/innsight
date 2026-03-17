/**
 * Audit Logs Routes
 * Read-only audit log endpoints for superadmin viewing
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const auditLogsRouter = Router();

// Middleware to ensure admin access
auditLogsRouter.use(requireRole('iitech_admin'));

interface AuditLogQuery {
  dateRange?: '1h' | '24h' | '7d' | '30d';
  action?: string;
  entityType?: string;
  status?: 'success' | 'error';
  skip?: number;
  take?: number;
}

// Get audit logs with filtering
auditLogsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { dateRange = '24h', action, entityType, status, skip = 0, take = 100 } = req.query as any;

    const dateMap: { [key: string]: number } = {
      '1h': 1,
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };

    const hours = dateMap[dateRange] || 24;
    const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where: any = {
      createdAt: { gte: sinceTime },
    };

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (status === 'success') where.metadata = { path: 'status', equals: 'success' };
    if (status === 'error') where.metadata = { path: 'status', equals: 'error' };

    const [logs, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip as string, 10) || 0,
        take: Math.min(parseInt(take as string, 10) || 100, 1000),
        include: {
          // Include tenant and user info if available
        },
      }),
      prisma.audit.count({ where }),
    ]);

    res.json({
      data: logs.map((log) => ({
        id: log.id,
        tenantId: log.tenantId,
        tenantName: log.tenantId, // Would need tenant lookup
        userId: log.userId,
        userName: log.userId, // Would need user lookup
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        beforeState: log.beforeState,
        afterState: log.afterState,
        metadata: log.metadata,
        status: log.metadata?.status || 'success',
        createdAt: log.createdAt,
      })),
      total,
      skip: parseInt(skip as string, 10) || 0,
      take: Math.min(parseInt(take as string, 10) || 100, 1000),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log metrics
auditLogsRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalLogs, actionsLast24h, allLogs] = await Promise.all([
      prisma.audit.count(),
      prisma.audit.count({ where: { createdAt: { gte: last24h } } }),
      prisma.audit.findMany({
        where: { createdAt: { gte: last24h } },
        select: { action: true, metadata: true },
      }),
    ]);

    const errorCount = allLogs.filter((log) => log.metadata?.status === 'error').length;
    const errorRate = actionsLast24h > 0 ? Math.round((errorCount / actionsLast24h) * 100) : 0;

    // Top actions
    const actionCounts: { [key: string]: number } = {};
    allLogs.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    res.json({
      data: {
        totalLogs,
        actionsLast24h,
        errorRate,
        topActions,
      },
    });
  } catch (error) {
    console.error('Error fetching audit metrics:', error);
    res.status(500).json({ error: 'Failed to fetch audit metrics' });
  }
});

// Export audit logs as CSV
auditLogsRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const { dateRange = '24h', action, entityType, status, format = 'csv' } = req.query as any;

    const dateMap: { [key: string]: number } = {
      '1h': 1,
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };

    const hours = dateMap[dateRange] || 24;
    const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where: any = {
      createdAt: { gte: sinceTime },
    };

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const logs = await prisma.audit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    if (format === 'csv') {
      // CSV header
      const headers = [
        'ID',
        'Timestamp',
        'Action',
        'Entity Type',
        'Entity ID',
        'User',
        'Status',
        'Details',
      ];

      const rows = logs.map((log) => [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.entityType,
        log.entityId,
        log.userId || 'System',
        log.metadata?.status || 'success',
        `${log.action} on ${log.entityType}`,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell)).join(',')
        ),
      ].join('\n');

      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // JSON export
      res.set('Content-Type', 'application/json');
      res.set('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
      res.json(logs);
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Get single audit log details
auditLogsRouter.get('/:logId', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;

    const log = await prisma.audit.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({
      data: log,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});
