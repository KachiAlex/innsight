import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const maintenanceRouter = Router({ mergeParams: true });

// Maintenance feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
maintenanceRouter.all('*', (req, res, next) => {
  throw new AppError('Maintenance feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
