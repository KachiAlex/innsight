import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const lostFoundRouter = Router({ mergeParams: true });

// Lost & found feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
lostFoundRouter.all('*', (req, res, next) => {
  throw new AppError('Lost & found feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
