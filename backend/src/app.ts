import express, { Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { tenantRouter } from './routes/tenants';
import { tenantAdminRouter } from './routes/tenant-admin';
import { reservationRouter } from './routes/reservations';
import { roomRouter } from './routes/rooms';
import { foliosRouter } from './routes/folios';
import { paymentsRouter } from './routes/payments';
import { housekeepingRouter } from './routes/housekeeping';
import { maintenanceRouter } from './routes/maintenance';
import { shiftRouter } from './routes/shifts';
import { auditRouter } from './routes/audits';
import { alertRouter } from './routes/alerts';
import { reportsRouter } from './routes/reports';
import { iotRouter } from './routes/iot';
import { uploadRouter } from './routes/upload';
import { uploadsDir } from './utils/upload';
import { ratePlanRouter } from './routes/ratePlans';
import { guestRouter } from './routes/guests';
import { guestEnhancedRouter } from './routes/guests-enhanced';
import { depositsRouter } from './routes/deposits';
import { groupBookingRouter } from './routes/group-bookings';
import { overbookingRouter } from './routes/overbooking';
import { guestRequestsRouter } from './routes/guest-requests';
import { lostFoundRouter } from './routes/lost-found';
import { roomServiceRouter } from './routes/room-service';
import { analyticsRouter } from './routes/analytics';
import { automationRouter } from './routes/automation';
import { calendarRouter } from './routes/calendar';
import { roomCategoryRouter } from './routes/roomCategories';
import { staffRouter } from './routes/staff';
import { settingsRouter } from './routes/settings';
import { webhooksRouter } from './routes/webhooks';
import { wagePlanRouter } from './routes/wagePlans';
import { meetingHallRouter } from './routes/halls';
import { publicPortalRouter } from './routes/public-portal';
import { publicPaymentsRouter } from './routes/public-payments';
import { superadminRouter } from './routes/superadmin';
import { settingsRouter as settingsAdminRouter } from './routes/settings-admin';
import { superadminUsersRouter } from './routes/superadmin-users';
import { billingRouter } from './routes/billing';
import { platformAnalyticsRouter } from './routes/platform-analytics';
// import { supportRouter } from './routes/support';
// import { apiKeysRouter } from './routes/api-keys';
// import { backupRouter } from './routes/backup';
// import { communicationsRouter } from './routes/communications';
import { auditLogsRouter } from './routes/audit-logs';
import { tenantQuickActionsRouter } from './routes/tenant-quick-actions';
import { systemHealthRouter } from './routes/system-health';
import resourceQuotasRouter from './routes/resource-quotas';
import dataRetentionRouter from './routes/data-retention';
import integrationsRouter from './routes/integrations';
import slaRouter from './routes/sla';
import roomStatusRouter from './routes/roomStatus';

const defaultOrigins = [
  'http://localhost:5173',
  'https://innsight-2025.web.app',
  'https://innsight-frontend.onrender.com',
  'https://innsightpms.netlify.app',
  'https://innsight-pms.vercel.app',
  'https://innsight-theta.vercel.app'
];

const buildAllowedOrigins = () => {
  const rawOrigins = (process.env.CORS_ORIGIN || defaultOrigins.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (!rawOrigins.includes('https://innsightpms.netlify.app')) {
    rawOrigins.push('https://innsightpms.netlify.app');
  }

  return rawOrigins;
};

const attachCorsHeaders = (req: Request, res: Response, allowedOrigins: string[]) => {
  const originHeader = req.headers.origin;
  if (originHeader && allowedOrigins.includes(originHeader)) {
    res.header('Access-Control-Allow-Origin', originHeader);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] ||
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Vary', 'Origin, Access-Control-Request-Headers');
};

export const createApp = () => {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();

  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    attachCorsHeaders(req, res, allowedOrigins);
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(helmet());
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  app.use('/api/', limiter);

  app.use('/api/public/payments', publicPaymentsRouter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/api/uploads', express.static(uploadsDir));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/tenants', tenantAdminRouter);
  app.use('/api/tenants', tenantRouter);
  app.use('/api/tenants/:tenantId/reservations', reservationRouter);
  app.use('/api/tenants/:tenantId/rooms', roomRouter);
  app.use('/api/rooms', roomStatusRouter);
  app.use('/api/tenants/:tenantId/folios', foliosRouter);
  app.use('/api/tenants/:tenantId/payments', paymentsRouter);
  app.use('/api/tenants/:tenantId/housekeeping', housekeepingRouter);
  app.use('/api/tenants/:tenantId/maintenance', maintenanceRouter);
  app.use('/api/tenants/:tenantId/shifts', shiftRouter);
  app.use('/api/tenants/:tenantId/audits', auditRouter);
  app.use('/api/tenants/:tenantId/alerts', alertRouter);
  app.use('/api/tenants/:tenantId/reports', reportsRouter);
  app.use('/api/tenants/:tenantId/upload', uploadRouter);
  app.use('/api/tenants/:tenantId/rate-plans', ratePlanRouter);
  app.use('/api/tenants/:tenantId/guests', guestRouter);
  app.use('/api/tenants/:tenantId/guests-enhanced', guestEnhancedRouter);
  app.use('/api/tenants/:tenantId/deposits', depositsRouter);
  app.use('/api/tenants/:tenantId/group-bookings', groupBookingRouter);
  app.use('/api/tenants/:tenantId/overbooking', overbookingRouter);
  app.use('/api/tenants/:tenantId/halls', meetingHallRouter);
  app.use('/api/tenants/:tenantId/guest-requests', guestRequestsRouter);
  app.use('/api/tenants/:tenantId/lost-found', lostFoundRouter);
  app.use('/api/tenants/:tenantId/room-service', roomServiceRouter);
  app.use('/api/tenants/:tenantId/analytics', analyticsRouter);
  app.use('/api/tenants/:tenantId/automation', automationRouter);
  app.use('/api/tenants/:tenantId/calendar', calendarRouter);
  app.use('/api/tenants/:tenantId/room-categories', roomCategoryRouter);
  app.use('/api/tenants/:tenantId/staff', staffRouter);
  app.use('/api/tenants/:tenantId/settings', settingsRouter);
  app.use('/api/tenants/:tenantId/webhooks', webhooksRouter);
  app.use('/api/tenants/:tenantId/wage-plans', wagePlanRouter);
  app.use('/api/iot', iotRouter);
  app.use('/api/tenants/:tenantId/iot', iotRouter);
  app.use('/api/tenants/:tenantId/rooms/:roomId/occupancy', iotRouter);
  app.use('/api/public/portal', publicPortalRouter);
  app.use('/api/superadmin', superadminRouter);
  app.use('/api/superadmin/users', superadminUsersRouter);
  app.use('/api/superadmin/settings', settingsAdminRouter);
  app.use('/api/superadmin/billing', billingRouter);
  app.use('/api/superadmin/analytics', platformAnalyticsRouter);
  // app.use('/api/superadmin/support', supportRouter);
  // app.use('/api/superadmin/api-keys', apiKeysRouter);
  // app.use('/api/superadmin/backup', backupRouter);
  // app.use('/api/superadmin/communications', communicationsRouter);
  app.use('/api/superadmin/audit-logs', auditLogsRouter);
  app.use('/api/superadmin/tenant-actions', tenantQuickActionsRouter);
  app.use('/api/superadmin/health', systemHealthRouter);
  app.use('/api/superadmin/tenant-quotas', resourceQuotasRouter);
  app.use('/api/superadmin/retention-policies', dataRetentionRouter);
  app.use('/api/superadmin/integrations', integrationsRouter);
  app.use('/api/superadmin/sla', slaRouter);

  app.use(errorHandler);

  return app;
};
