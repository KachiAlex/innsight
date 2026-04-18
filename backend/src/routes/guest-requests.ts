import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const guestRequestsRouter = Router({ mergeParams: true });

// Guest requests feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
guestRequestsRouter.all('*', (req, res, next) => {
  throw new AppError('Guest requests feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
