import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const automationRouter = Router({ mergeParams: true });

// Automation feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
automationRouter.all('*', (req, res, next) => {
  throw new AppError('Automation feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
