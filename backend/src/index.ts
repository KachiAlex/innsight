import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { tenantRouter } from './routes/tenants';
import { reservationRouter } from './routes/reservations';
import { roomRouter } from './routes/rooms';
import { folioRouter } from './routes/folios';
import { paymentRouter } from './routes/payments';
import { housekeepingRouter } from './routes/housekeeping';
import { maintenanceRouter } from './routes/maintenance';
import { shiftRouter } from './routes/shifts';
import { auditRouter } from './routes/audits';
import { alertRouter } from './routes/alerts';
import { reportRouter } from './routes/reports';
import { iotRouter } from './routes/iot';
import { uploadRouter } from './routes/upload';
import { ratePlanRouter } from './routes/ratePlans';
import { guestRouter } from './routes/guests';
import { guestEnhancedRouter } from './routes/guests-enhanced';
import { depositRouter } from './routes/deposits';
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
import { wagePlanRouter } from './routes/wagePlans';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads) - must be before API routes
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantRouter);
app.use('/api/tenants/:tenantId/reservations', reservationRouter);
app.use('/api/tenants/:tenantId/rooms', roomRouter);
app.use('/api/tenants/:tenantId/folios', folioRouter);
app.use('/api/tenants/:tenantId/payments', paymentRouter);
app.use('/api/tenants/:tenantId/housekeeping', housekeepingRouter);
app.use('/api/tenants/:tenantId/maintenance', maintenanceRouter);
app.use('/api/tenants/:tenantId/shifts', shiftRouter);
app.use('/api/tenants/:tenantId/audits', auditRouter);
app.use('/api/tenants/:tenantId/alerts', alertRouter);
app.use('/api/tenants/:tenantId/reports', reportRouter);
app.use('/api/tenants/:tenantId/upload', uploadRouter);
app.use('/api/tenants/:tenantId/rate-plans', ratePlanRouter);
app.use('/api/tenants/:tenantId/guests', guestRouter); // Legacy guest routes (default)
app.use('/api/tenants/:tenantId/guests-enhanced', guestEnhancedRouter); // Enhanced guest routes (after migration)
app.use('/api/tenants/:tenantId/deposits', depositRouter); // Deposit management
app.use('/api/tenants/:tenantId/group-bookings', groupBookingRouter); // Group bookings
app.use('/api/tenants/:tenantId/overbooking', overbookingRouter); // Overbooking management
app.use('/api/tenants/:tenantId/guest-requests', guestRequestsRouter); // Guest requests
app.use('/api/tenants/:tenantId/lost-found', lostFoundRouter); // Lost & found
app.use('/api/tenants/:tenantId/room-service', roomServiceRouter); // Room service
app.use('/api/tenants/:tenantId/analytics', analyticsRouter); // Analytics & BI
app.use('/api/tenants/:tenantId/automation', automationRouter); // Automation & Workflows
app.use('/api/tenants/:tenantId/calendar', calendarRouter);
app.use('/api/tenants/:tenantId/room-categories', roomCategoryRouter);
app.use('/api/tenants/:tenantId/group-bookings', groupBookingRouter);
app.use('/api/tenants/:tenantId/staff', staffRouter);
app.use('/api/tenants/:tenantId/settings', settingsRouter);
app.use('/api/tenants/:tenantId/wage-plans', wagePlanRouter);
app.use('/api/iot', iotRouter);
app.use('/api/tenants/:tenantId/iot', iotRouter);
app.use('/api/tenants/:tenantId/rooms/:roomId/occupancy', iotRouter);

// Error handling (must be last)
app.use(errorHandler);

// Export app for Firebase Functions
export { app };

// For local development, start the server
// Only start server if explicitly running locally (not in Firebase Functions)
// Firebase Functions sets K_SERVICE environment variable during discovery
// We only start the server if RUN_LOCAL_SERVER is explicitly 'true' AND we're not in Firebase Functions
const isFirebaseFunction = process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FUNCTION_NAME || process.env.FIREBASE_FUNCTIONS === 'true';
if (process.env.RUN_LOCAL_SERVER === 'true' && !isFirebaseFunction) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}
