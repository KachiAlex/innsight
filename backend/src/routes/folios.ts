import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const foliosRouter = Router({ mergeParams: true });

// Folios feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
foliosRouter.all('*', (req, res, next) => {
  throw new AppError('Folios feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
