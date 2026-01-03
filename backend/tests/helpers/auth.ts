import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'test-secret';

interface TokenOptions {
  tenantId?: string;
  role?: string;
  email?: string;
  userId?: string;
}

export const buildAuthToken = ({
  tenantId = 'test-tenant',
  role = 'owner',
  email = 'staff@example.com',
  userId = 'test-user',
}: TokenOptions = {}) => {
  return jwt.sign(
    {
      id: userId,
      tenantId,
      email,
      role,
    },
    DEFAULT_SECRET
  );
};

export const authHeader = (options?: TokenOptions) => ({
  Authorization: `Bearer ${buildAuthToken(options)}`,
});
