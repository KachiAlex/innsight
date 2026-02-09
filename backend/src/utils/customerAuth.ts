import jwt from 'jsonwebtoken';
import type { SignOptions, Secret } from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';

export type CustomerTokenPayload = {
  tenantId: string;
  guestId?: string | null;
  guestAccountId?: string | null;
  sessionToken?: string | null;
  reservationId?: string | null;
};

const getCustomerJwtSecret = (): Secret => {
  const secret = process.env.JWT_PUBLIC_PORTAL_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('Customer auth secret not configured', 500);
  }
  return secret;
};

export const issueCustomerToken = (
  payload: CustomerTokenPayload,
  expiresIn: SignOptions['expiresIn'] = '7d'
) => {
  const secret = getCustomerJwtSecret();
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyCustomerToken = (token: string): CustomerTokenPayload => {
  const secret = getCustomerJwtSecret();
  try {
    return jwt.verify(token, secret) as CustomerTokenPayload;
  } catch (error) {
    throw new AppError('Invalid customer token', 401);
  }
};
