import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const staffRouter = Router({ mergeParams: true });

// Staff management feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
staffRouter.all('*', (req, res, next) => {
  throw new AppError('Staff management feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});

