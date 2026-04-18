import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const housekeepingRouter = Router({ mergeParams: true });

// Housekeeping feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
housekeepingRouter.all('*', (req, res, next) => {
  throw new AppError('Housekeeping feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
