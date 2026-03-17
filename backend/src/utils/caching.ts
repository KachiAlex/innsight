/**
 * Backend Caching Layer
 * 
 * This utility provides a caching abstraction to integrate Redis (or in-memory cache)
 * for server-side data caching to reduce database queries.
 * 
 * Current: In-memory cache (suitable for single-server deployments)
 * Next: Redis integration for distributed caching
 */

import { promisify } from 'util';

// Simple in-memory cache store (can be replaced with Redis)
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key: string; // Cache key
}

/**
 * Get cached data
 * Returns null if cache miss or expired
 */
export const getFromCache = async (key: string): Promise<any | null> => {
  const cached = memoryCache.get(key);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache has expired
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  
  return cached.data;
};

/**
 * Set data in cache
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
export const setInCache = async (key: string, data: any, ttlSeconds = 300): Promise<void> => {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

/**
 * Delete cache entry
 */
export const deleteFromCache = async (key: string): Promise<void> => {
  memoryCache.delete(key);
};

/**
 * Clear all cache (use with caution)
 */
export const clearCache = async (): Promise<void> => {
  memoryCache.clear();
};

/**
 * Cache decorator for database queries
 * Usage: getCachedData('key', () => expensiveDbQuery(), 300)
 */
export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  // Try to get from cache
  const cached = await getFromCache(key);
  if (cached !== null) {
    return cached as T;
  }
  
  // Cache miss - fetch data
  const data = await fetchFn();
  
  // Store in cache
  await setInCache(key, data, ttlSeconds);
  
  return data;
}

/**
 * Cache key generators for different data types
 */
export const cacheKeys = {
  // Dashboard metrics
  dashboardMetrics: (tenantId: string, date: string) => `dashboard:metrics:${tenantId}:${date}`,
  roomStatus: (tenantId: string) => `rooms:status:${tenantId}`,
  availableRooms: (tenantId: string, date: string) => `rooms:available:${tenantId}:${date}`,
  
  // Reports
  occupancyReport: (tenantId: string, startDate: string, endDate: string) => 
    `report:occupancy:${tenantId}:${startDate}:${endDate}`,
  revenueReport: (tenantId: string, startDate: string, endDate: string) => 
    `report:revenue:${tenantId}:${startDate}:${endDate}`,
  
  // Reservations
  todayReservations: (tenantId: string, date: string) => `reservations:today:${tenantId}:${date}`,
  reservationsList: (tenantId: string, page?: number) => `reservations:list:${tenantId}:${page || 1}`,
  
  // Guests
  guestsList: (tenantId: string, page?: number) => `guests:list:${tenantId}:${page || 1}`,
  guestDetail: (tenantId: string, guestId: string) => `guests:detail:${tenantId}:${guestId}`,
  
  // Rooms
  roomsList: (tenantId: string) => `rooms:list:${tenantId}`,
  roomDetail: (tenantId: string, roomId: string) => `rooms:detail:${tenantId}:${roomId}`,
  
  // Housekeeping
  housekeepingTasks: (tenantId: string) => `housekeeping:tasks:${tenantId}`,
  roomTasks: (tenantId: string, roomId: string) => `housekeeping:room:${tenantId}:${roomId}`,
  
  // Settings
  propertySettings: (tenantId: string) => `settings:property:${tenantId}`,
  staffList: (tenantId: string) => `staff:list:${tenantId}`,
};

/**
 * Cache invalidation utilities
 */
export const invalidateCache = {
  // Invalidate all dashboard data for a tenant
  invalidateDashboard: async (tenantId: string) => {
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      deleteFromCache(cacheKeys.dashboardMetrics(tenantId, today)),
      deleteFromCache(cacheKeys.roomStatus(tenantId)),
      deleteFromCache(cacheKeys.availableRooms(tenantId, today)),
      deleteFromCache(cacheKeys.todayReservations(tenantId, today)),
    ]);
  },

  // Invalidate room data
  invalidateRooms: async (tenantId: string, roomId?: string) => {
    if (roomId) {
      await Promise.all([
        deleteFromCache(cacheKeys.roomDetail(tenantId, roomId)),
        deleteFromCache(cacheKeys.roomTasks(tenantId, roomId)),
      ]);
    }
    await Promise.all([
      deleteFromCache(cacheKeys.roomsList(tenantId)),
      deleteFromCache(cacheKeys.roomStatus(tenantId)),
      invalidateCache.invalidateDashboard(tenantId),
    ]);
  },

  // Invalidate reservation data
  invalidateReservations: async (tenantId: string) => {
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      deleteFromCache(cacheKeys.reservationsList(tenantId)),
      deleteFromCache(cacheKeys.todayReservations(tenantId, today)),
      invalidateCache.invalidateDashboard(tenantId),
    ]);
  },

  // Invalidate guest data
  invalidateGuest: async (tenantId: string, guestId?: string) => {
    if (guestId) {
      await deleteFromCache(cacheKeys.guestDetail(tenantId, guestId));
    }
    await deleteFromCache(cacheKeys.guestsList(tenantId));
  },

  // Invalidate housekeeping data
  invalidateHousekeeping: async (tenantId: string, roomId?: string) => {
    if (roomId) {
      await deleteFromCache(cacheKeys.roomTasks(tenantId, roomId));
    }
    await deleteFromCache(cacheKeys.housekeepingTasks(tenantId));
  },

  // Invalidate entire tenant cache (use on tenant data changes)
  invalidateTenant: async (tenantId: string) => {
    // Delete all keys matching tenant
    for (const [key] of memoryCache.entries()) {
      if (key.includes(tenantId)) {
        memoryCache.delete(key);
      }
    }
  },
};

/**
 * Cache statistics
 */
export const getCacheStats = () => {
  let totalSize = 0;
  let expiredCount = 0;

  for (const [key, value] of memoryCache.entries()) {
    if (Date.now() > value.expiresAt) {
      expiredCount++;
    } else {
      totalSize += JSON.stringify(value.data).length;
    }
  }

  return {
    totalEntries: memoryCache.size,
    expiredEntries: expiredCount,
    activeEntries: memoryCache.size - expiredCount,
    estimatedSizeKB: totalSize / 1024,
  };
};

/**
 * REDIS MIGRATION NOTE
 * ====================================================================
 * To migrate to Redis:
 * 
 * 1. Install: npm install redis
 * 
 * 2. Create redis client:
 *    import { createClient } from 'redis';
 *    const redisClient = createClient();
 *    await redisClient.connect();
 * 
 * 3. Update getFromCache():
 *    const cached = await redisClient.get(key);
 *    return cached ? JSON.parse(cached) : null;
 * 
 * 4. Update setInCache():
 *    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
 * 
 * 5. Update deleteFromCache():
 *    await redisClient.del(key);
 * 
 * Benefits of Redis:
 * - Distributed caching across multiple servers
 * - Persistent cache (survives restarts)
 * - Better memory management
 * - Built-in expiration handling
 * - Support for cache invalidation patterns
 * ====================================================================
 */
