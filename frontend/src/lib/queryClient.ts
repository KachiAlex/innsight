import { QueryClient } from 'react-query';

/**
 * QueryClient configuration for React Query
 * Provides caching, deduplication, and stale data handling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      
      // Keep unused data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000,
      
      // Retry failed requests once with exponential backoff
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Cache strategy configurations for different data types
 * Customize stale times and cache behavior per feature
 */
export const CACHE_STRATEGIES = {
  // Real-time data (used often, changes frequently)
  ROOM_STATUS: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
  },
  
  // Dashboard metrics (used on page load, doesn't change often)
  DASHBOARD_METRICS: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Guest data (relatively static, updates occasionally)
  GUEST_DATA: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Room inventory (static until manual update)
  ROOM_INVENTORY: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  },
  
  // Rate plans (rarely changed)
  RATE_PLANS: {
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
  },
  
  // Recommendations/analytics (can be expensive, cache longer)
  ANALYTICS: {
    staleTime: 20 * 60 * 1000, // 20 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  },
  
  // One-time lookups (staff, settings - very static)
  STATIC_DATA: {
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    cacheTime: 4 * 60 * 60 * 1000, // 4 hours
  },
};

/**
 * Query key factory for type-safe cache key generation
 * Ensures consistent cache key naming across the app
 */
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: (tenantId: string) => [...queryKeys.dashboard.all, 'stats', tenantId] as const,
    metrics: (tenantId: string) => [...queryKeys.dashboard.all, 'metrics', tenantId] as const,
  },

  // Rooms
  rooms: {
    all: ['rooms'] as const,
    list: (tenantId: string) => [...queryKeys.rooms.all, 'list', tenantId] as const,
    detail: (tenantId: string, roomId: string) => [...queryKeys.rooms.all, 'detail', tenantId, roomId] as const,
    status: (tenantId: string) => [...queryKeys.rooms.all, 'status', tenantId] as const,
    available: (tenantId: string) => [...queryKeys.rooms.all, 'available', tenantId] as const,
  },

  // Reservations
  reservations: {
    all: ['reservations'] as const,
    list: (tenantId: string, options?: Record<string, any>) => [...queryKeys.reservations.all, 'list', tenantId, options] as const,
    detail: (tenantId: string, reservationId: string) => [...queryKeys.reservations.all, 'detail', tenantId, reservationId] as const,
    today: (tenantId: string) => [...queryKeys.reservations.all, 'today', tenantId] as const,
  },

  // Guests
  guests: {
    all: ['guests'] as const,
    list: (tenantId: string, page?: number) => [...queryKeys.guests.all, 'list', tenantId, page] as const,
    detail: (tenantId: string, guestId: string) => [...queryKeys.guests.all, 'detail', tenantId, guestId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.guests.all, 'search', tenantId, query] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    occupancy: (tenantId: string, dateRange: { start: string; end: string }) => [...queryKeys.reports.all, 'occupancy', tenantId, dateRange] as const,
    revenue: (tenantId: string, dateRange: { start: string; end: string }) => [...queryKeys.reports.all, 'revenue', tenantId, dateRange] as const,
    performance: (tenantId: string, period: string) => [...queryKeys.reports.all, 'performance', tenantId, period] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    dashboard: (tenantId: string, period: string) => [...queryKeys.analytics.all, 'dashboard', tenantId, period] as const,
    trends: (tenantId: string, metric: string) => [...queryKeys.analytics.all, 'trends', tenantId, metric] as const,
  },

  // Housekeeping
  housekeeping: {
    all: ['housekeeping'] as const,
    tasks: (tenantId: string) => [...queryKeys.housekeeping.all, 'tasks', tenantId] as const,
    roomTasks: (tenantId: string, roomId: string) => [...queryKeys.housekeeping.all, 'roomTasks', tenantId, roomId] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    property: (tenantId: string) => [...queryKeys.settings.all, 'property', tenantId] as const,
    general: (tenantId: string) => [...queryKeys.settings.all, 'general', tenantId] as const,
  },

  // Staff
  staff: {
    all: ['staff'] as const,
    list: (tenantId: string) => [...queryKeys.staff.all, 'list', tenantId] as const,
    detail: (tenantId: string, staffId: string) => [...queryKeys.staff.all, 'detail', tenantId, staffId] as const,
  },

  // Rate Plans
  ratePlans: {
    all: ['ratePlans'] as const,
    list: (tenantId: string) => [...queryKeys.ratePlans.all, 'list', tenantId] as const,
    detail: (tenantId: string, planId: string) => [...queryKeys.ratePlans.all, 'detail', tenantId, planId] as const,
  },

  // Payments
  payments: {
    all: ['payments'] as const,
    list: (tenantId: string) => [...queryKeys.payments.all, 'list', tenantId] as const,
    detail: (tenantId: string, paymentId: string) => [...queryKeys.payments.all, 'detail', tenantId, paymentId] as const,
  },

  // Folios
  folios: {
    all: ['folios'] as const,
    list: (tenantId: string) => [...queryKeys.folios.all, 'list', tenantId] as const,
    detail: (tenantId: string, folioId: string) => [...queryKeys.folios.all, 'detail', tenantId, folioId] as const,
  },
};
