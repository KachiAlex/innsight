import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string | null;
    email: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      tenantId: string | null;
      email: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401);
    }
    throw error;
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
};

export const requireTenantAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const tenantId = req.params.tenantId || req.body.tenantId;

  // Platform superadmins carry no tenant and are confined to iitech_admin
  // routes — they never act inside a tenant's workspace.
  if (req.user.role === 'iitech_admin') {
    throw new AppError('Platform admins manage tenants from the superadmin portal', 403);
  }

  if (!req.user.tenantId) {
    throw new AppError('No tenant associated with this account', 403);
  }

  // Regular users can only access their own tenant
  if (tenantId && tenantId !== req.user.tenantId) {
    throw new AppError('Access denied to this tenant', 403);
  }

  // Ensure tenantId is set from user context
  if (!tenantId) {
    req.params.tenantId = req.user.tenantId;
  }

  next();
};
