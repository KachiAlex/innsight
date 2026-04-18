import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const roomServiceRouter = Router({ mergeParams: true });

// Room service feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
roomServiceRouter.all('*', (req, res, next) => {
  throw new AppError('Room service feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
