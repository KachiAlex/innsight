import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const overbookingRouter = Router({ mergeParams: true });

// Overbooking feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
overbookingRouter.all('*', (req, res, next) => {
  throw new AppError('Overbooking feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
