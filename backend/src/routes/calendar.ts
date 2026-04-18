import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const calendarRouter = Router({ mergeParams: true });

// Calendar feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
calendarRouter.all('*', (req, res, next) => {
  throw new AppError('Calendar feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
