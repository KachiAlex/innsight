import { Router } from 'express';
import { prisma } from '../utils/prisma';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export const publicTrackingRouter = Router();

// GET /api/public/track/open/:logId.gif — email open-tracking pixel
publicTrackingRouter.get('/open/:logId.gif', async (req, res) => {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  });

  // Record the open asynchronously — never block the pixel response.
  // openCount increments on every load; openedAt records the FIRST open only.
  const logId = req.params.logId;
  Promise.allSettled([
    prisma.notificationLog.updateMany({
      where: { id: logId, openedAt: null },
      data: { openedAt: new Date() },
    }),
    prisma.notificationLog.updateMany({
      where: { id: logId },
      data: { openCount: { increment: 1 } },
    }),
  ]).catch(() => {});

  res.end(PIXEL);
});
