import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const analyticsRouter = Router({ mergeParams: true });

// Analytics feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
analyticsRouter.all('*', (req, res, next) => {
  throw new AppError('Analytics feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
