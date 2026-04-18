import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const publicPortalRouter = Router({ mergeParams: true });

// Public portal feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
publicPortalRouter.all('*', (req, res, next) => {
  throw new AppError('Public portal feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
