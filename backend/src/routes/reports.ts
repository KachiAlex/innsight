import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const reportsRouter = Router({ mergeParams: true });

// Reports feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
reportsRouter.all('*', (req, res, next) => {
  throw new AppError('Reports feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
