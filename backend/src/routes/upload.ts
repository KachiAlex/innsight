import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { upload, getFileUrl } from '../utils/upload';
import { AppError } from '../middleware/errorHandler';

export const uploadRouter = Router({ mergeParams: true });

// File serving is handled by static middleware in index.ts

// POST /api/tenants/:tenantId/upload
uploadRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  upload.single('file'),
  (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileUrl = getFileUrl(req.file.filename);

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      },
    });
  }
);

// POST /api/tenants/:tenantId/upload/multiple
uploadRouter.post(
  '/multiple',
  authenticate,
  requireTenantAccess,
  upload.array('files', 10), // Max 10 files
  (req: AuthRequest, res) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      throw new AppError('No files uploaded', 400);
    }

    const files = (req.files as Express.Multer.File[]).map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: getFileUrl(file.filename),
    }));

    res.json({
      success: true,
      data: files,
    });
  }
);

