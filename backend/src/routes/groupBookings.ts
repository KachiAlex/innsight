import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';

export const groupBookingRouter = Router({ mergeParams: true });

// Group bookings feature has been removed as part of Firebase migration
// This feature needs to be reimplemented using PostgreSQL via Prisma
groupBookingRouter.all('*', (req, res, next) => {
  throw new AppError('Group bookings feature is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
});
