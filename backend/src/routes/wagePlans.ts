import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const wagePlanRouter = Router({ mergeParams: true });

// Wage plans feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
wagePlanRouter.all('*', (req, res, next) => {
  throw new AppError('Wage plans feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});

