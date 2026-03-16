import { createAuditLog } from './audit';

export interface ApiKey {
  id: string;
  name: string;
  key: string; // hashed in production
  secret: string; // only returned once on creation
  tenantId?: string; // if tenant-specific
  scopes: string[]; // e.g., 'read:rooms', 'write:reservations'
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  allowedIPs?: string[];
  status: 'active' | 'revoked' | 'expired';
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface ApiUsage {
  keyId: string;
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number; // ms
  ipAddress: string;
}

export interface ApiMetrics {
  totalRequests: number;
  requestsToday: number;
  averageResponseTime: number; // ms
  errorsCount: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  topClients: Array<{ keyId: string; name: string; requests: number }>;
  mostUsedMethods: Record<string, number>;
  statusCodeDistribution: Record<number, number>;
}

const keysStorage = new Map<string, ApiKey>();
const usageStorage: ApiUsage[] = [];

const generateRandomString = (length: number) => {
  return Math.random().toString(36).substr(2, length);
};

// Initialize mock data
const initializeMockKeys = () => {
  if (keysStorage.size === 0) {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-001',
        name: 'Development API Key',
        key: 'sk_dev_' + generateRandomString(20),
        secret: 'sk_secret_' + generateRandomString(30),
        tenantId: 'tenant-1',
        scopes: ['read:rooms', 'read:reservations', 'write:reservations'],
        rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000 },
        status: 'active',
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        createdBy: 'admin@tenant1.com',
      },
      {
        id: 'key-002',
        name: 'Production API Key',
        key: 'sk_prod_' + generateRandomString(20),
        secret: 'sk_secret_' + generateRandomString(30),
        tenantId: 'tenant-1',
        scopes: ['read:rooms', 'read:reservations', 'write:reservations', 'read:billing'],
        rateLimit: { requestsPerMinute: 300, requestsPerDay: 100000 },
        allowedIPs: ['192.168.1.0/24', '10.0.0.0/8'],
        status: 'active',
        lastUsed: new Date(Date.now() - 300000).toISOString(),
        createdAt: new Date(Date.now() - 7776000000).toISOString(), // 90 days ago
        createdBy: 'tech@tenant1.com',
      },
      {
        id: 'key-003',
        name: 'Legacy Integration',
        key: 'sk_legacy_' + generateRandomString(20),
        secret: 'sk_secret_' + generateRandomString(30),
        tenantId: 'tenant-2',
        scopes: ['read:rooms', 'read:reservations'],
        rateLimit: { requestsPerMinute: 30, requestsPerDay: 5000 },
        status: 'revoked',
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        createdAt: new Date(Date.now() - 31536000000).toISOString(), // 1 year ago
        createdBy: 'admin@tenant2.com',
      },
    ];

    mockKeys.forEach(key => {
      keysStorage.set(key.id, { ...key, secret: '' }); // Don't store secret
    });
  }
};

// Initialize mock usage data
const initializeMockUsage = () => {
  if (usageStorage.length === 0) {
    const now = Date.now();
    const mockUsage: ApiUsage[] = [
      { keyId: 'key-001', timestamp: new Date(now - 60000).toISOString(), endpoint: 'GET /api/rooms', method: 'GET', statusCode: 200, responseTime: 145, ipAddress: '192.168.1.100' },
      { keyId: 'key-001', timestamp: new Date(now - 120000).toISOString(), endpoint: 'GET /api/reservations', method: 'GET', statusCode: 200, responseTime: 234, ipAddress: '192.168.1.100' },
      { keyId: 'key-002', timestamp: new Date(now - 30000).toISOString(), endpoint: 'POST /api/reservations', method: 'POST', statusCode: 201, responseTime: 456, ipAddress: '10.0.0.50' },
      { keyId: 'key-002', timestamp: new Date(now - 45000).toISOString(), endpoint: 'GET /api/rooms', method: 'GET', statusCode: 200, responseTime: 123, ipAddress: '10.0.0.50' },
      { keyId: 'key-001', timestamp: new Date(now - 90000).toISOString(), endpoint: 'GET /api/billing', method: 'GET', statusCode: 403, responseTime: 89, ipAddress: '192.168.1.100' },
    ];
    usageStorage.push(...mockUsage);
  }
};

export async function getApiKeys(tenantId?: string, limit: number = 50, offset: number = 0): Promise<ApiKey[]> {
  initializeMockKeys();
  
  let keys = Array.from(keysStorage.values());
  
  if (tenantId) {
    keys = keys.filter(k => k.tenantId === tenantId);
  }

  keys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return keys.slice(offset, offset + limit);
}

export async function getApiKey(keyId: string): Promise<ApiKey | null> {
  initializeMockKeys();
  return keysStorage.get(keyId) || null;
}

export async function createApiKey(data: Omit<ApiKey, 'id' | 'createdAt' | 'lastUsed'>): Promise<ApiKey & { secret: string }> {
  initializeMockKeys();
  
  const id = `key-${Date.now()}`;
  const newKey: ApiKey = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };

  keysStorage.set(id, { ...newKey, secret: '' });

  await createAuditLog({
    action: 'CREATE_API_KEY',
    entityType: 'ApiKey',
    resourceId: id,
    changes: newKey,
    status: 'success'
  });

  return { ...newKey, secret: data.secret };
}

export async function revokeApiKey(keyId: string): Promise<ApiKey | null> {
  initializeMockKeys();
  
  const key = keysStorage.get(keyId);
  if (!key) return null;

  const updated = {
    ...key,
    status: 'revoked' as const,
  };

  keysStorage.set(keyId, updated);

  await createAuditLog({
    action: 'REVOKE_API_KEY',
    entityType: 'ApiKey',
    resourceId: keyId,
    changes: { status: 'revoked' },
    status: 'success'
  });

  return updated;
}

export async function updateApiKey(keyId: string, updates: Partial<Omit<ApiKey, 'id' | 'createdAt' | 'key' | 'secret'>>): Promise<ApiKey | null> {
  initializeMockKeys();
  
  const key = keysStorage.get(keyId);
  if (!key) return null;

  const updated = { ...key, ...updates };
  keysStorage.set(keyId, updated);

  await createAuditLog({
    action: 'UPDATE_API_KEY',
    entityType: 'ApiKey',
    resourceId: keyId,
    changes: updates,
    status: 'success'
  });

  return updated;
}

export async function getApiMetrics(dateRange?: { from: string; to: string }): Promise<ApiMetrics> {
  initializeMockUsage();
  
  let usage = usageStorage;

  if (dateRange) {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    usage = usage.filter(u => {
      const timestamp = new Date(u.timestamp).getTime();
      return timestamp >= from && timestamp <= to;
    });
  }

  const totalRequests = usage.length;
  const requestsToday = usage.filter(u => {
    const date = new Date(u.timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const avgResponseTime = usage.length > 0 ? usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length : 0;
  const errorsCount = usage.filter(u => u.statusCode >= 400).length;

  // Top endpoints
  const endpointMap = new Map<string, number>();
  usage.forEach(u => {
    endpointMap.set(u.endpoint, (endpointMap.get(u.endpoint) || 0) + 1);
  });
  const topEndpoints = Array.from(endpointMap.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top clients
  const clientMap = new Map<string, number>();
  usage.forEach(u => {
    clientMap.set(u.keyId, (clientMap.get(u.keyId) || 0) + 1);
  });
  const topClients = Array.from(clientMap.entries())
    .map(([keyId, requests]) => {
      const key = keysStorage.get(keyId);
      return { keyId, name: key?.name || 'Unknown', requests };
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 5);

  // Methods
  const methodMap: Record<string, number> = {};
  usage.forEach(u => {
    methodMap[u.method] = (methodMap[u.method] || 0) + 1;
  });

  // Status codes
  const statusCodeMap: Record<number, number> = {};
  usage.forEach(u => {
    statusCodeMap[u.statusCode] = (statusCodeMap[u.statusCode] || 0) + 1;
  });

  return {
    totalRequests,
    requestsToday,
    averageResponseTime: Math.round(avgResponseTime),
    errorsCount,
    topEndpoints,
    topClients,
    mostUsedMethods: methodMap,
    statusCodeDistribution: statusCodeMap,
  };
}

export async function logApiUsage(usage: ApiUsage): Promise<void> {
  initializeMockUsage();
  usageStorage.push(usage);
}
