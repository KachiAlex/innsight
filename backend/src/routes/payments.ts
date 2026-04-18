import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const paymentsRouter = Router({ mergeParams: true });

// Payments feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
paymentsRouter.all('*', (req, res, next) => {
  throw new AppError('Payments feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
