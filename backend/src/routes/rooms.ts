import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const roomRouter = Router({ mergeParams: true });

// Rooms feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
roomRouter.all('*', (req, res, next) => {
  throw new AppError('Rooms feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
