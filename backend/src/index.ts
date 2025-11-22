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
import { calendarRouter } from './routes/calendar';

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
app.use('/api/tenants/:tenantId/guests', guestRouter);
app.use('/api/tenants/:tenantId/calendar', calendarRouter);
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
