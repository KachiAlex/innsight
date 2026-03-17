import { useQuery, UseQueryOptions } from 'react-query';
import { api } from './api';
import { CACHE_STRATEGIES, queryKeys } from './queryClient';

/**
 * Custom hooks for cached data fetching with React Query
 * These hooks integrate with the queryClient configuration for optimal caching
 */

// ============================================
// DASHBOARD HOOKS
// ============================================

export const useDashboardStats = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.dashboard.stats(tenantId),
    async () => {
      const today = new Date().toISOString().split('T')[0];
      const [reservations, rooms, revenue, occupancy] = await Promise.all([
        api.get(`/tenants/${tenantId}/reservations`, { params: { startDate: today, endDate: today } }),
        api.get(`/tenants/${tenantId}/rooms`),
        api.get(`/tenants/${tenantId}/reports/revenue`, { params: { startDate: today, endDate: today } }),
        api.get(`/tenants/${tenantId}/reports/occupancy`, { params: { startDate: today, endDate: today } }),
      ]);
      
      return {
        todayReservations: reservations.data?.data?.length || 0,
        checkedIn: reservations.data?.data?.filter((r: any) => r.status === 'checked_in')?.length || 0,
        availableRooms: rooms.data?.data?.filter((r: any) => r.status === 'available')?.length || 0,
        todayRevenue: revenue.data?.data?.totalRevenue || 0,
        occupancyRate: occupancy.data?.data?.occupancyRate || 0,
        adr: occupancy.data?.data?.adr || 0,
        revpar: occupancy.data?.data?.revpar || 0,
      };
    },
    {
      ...CACHE_STRATEGIES.DASHBOARD_METRICS,
      ...options,
    }
  );
};

export const useDashboardMetrics = (tenantId: string, period: '7d' | '30d' | '90d' | '1y' = '30d', options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.dashboard.metrics(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/analytics/dashboard?period=${period}`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.DASHBOARD_METRICS,
      ...options,
    }
  );
};

// ============================================
// ROOMS HOOKS
// ============================================

export const useRoomsList = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.rooms.list(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/rooms`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.ROOM_INVENTORY,
      ...options,
    }
  );
};

export const useRoomStatus = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.rooms.status(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/rooms`);
      return response.data?.data || [];
    },
    {
      ...CACHE_STRATEGIES.ROOM_STATUS,
      ...options,
    }
  );
};

export const useAvailableRooms = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.rooms.available(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/rooms?status=available`);
      return response.data?.data || [];
    },
    {
      ...CACHE_STRATEGIES.ROOM_STATUS,
      ...options,
    }
  );
};

// ============================================
// RESERVATIONS HOOKS
// ============================================

export const useReservationsList = (
  tenantId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  },
  queryOptions?: UseQueryOptions<any>
) => {
  return useQuery(
    queryKeys.reservations.list(tenantId, options),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/reservations`, { params: options });
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.DASHBOARD_METRICS,
      ...queryOptions,
    }
  );
};

export const useTodayReservations = (tenantId: string, options?: UseQueryOptions<any>) => {
  const today = new Date().toISOString().split('T')[0];
  return useReservationsList(
    tenantId,
    { startDate: today, endDate: today },
    {
      ...CACHE_STRATEGIES.ROOM_STATUS,
      ...options,
    }
  );
};

// ============================================
// GUESTS HOOKS
// ============================================

export const useGuestsList = (tenantId: string, page?: number, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.guests.list(tenantId, page),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/guests`, { params: { page } });
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.GUEST_DATA,
      ...options,
    }
  );
};

export const useGuestSearch = (tenantId: string, query: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.guests.search(tenantId, query),
    async () => {
      if (!query) return [];
      const response = await api.get(`/tenants/${tenantId}/guests?search=${query}`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.GUEST_DATA,
      enabled: query.length > 0,
      ...options,
    }
  );
};

// ============================================
// REPORTS HOOKS
// ============================================

export const useOccupancyReport = (
  tenantId: string,
  dateRange: { start: string; end: string },
  options?: UseQueryOptions<any>
) => {
  return useQuery(
    queryKeys.reports.occupancy(tenantId, dateRange),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/reports/occupancy`, { params: dateRange });
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.ANALYTICS,
      ...options,
    }
  );
};

export const useRevenueReport = (
  tenantId: string,
  dateRange: { start: string; end: string },
  options?: UseQueryOptions<any>
) => {
  return useQuery(
    queryKeys.reports.revenue(tenantId, dateRange),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/reports/revenue`, { params: dateRange });
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.ANALYTICS,
      ...options,
    }
  );
};

// ============================================
// HOUSEKEEPING HOOKS
// ============================================

export const useHousekeepingTasks = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.housekeeping.tasks(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/housekeeping`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.ROOM_STATUS,
      ...options,
    }
  );
};

// ============================================
// STAFF HOOKS
// ============================================

export const useStaffList = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.staff.list(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/staff`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.STATIC_DATA,
      ...options,
    }
  );
};

// ============================================
// RATE PLANS HOOKS
// ============================================

export const useRatePlansList = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.ratePlans.list(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/rate-plans`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.RATE_PLANS,
      ...options,
    }
  );
};

// ============================================
// SETTINGS HOOKS
// ============================================

export const usePropertySettings = (tenantId: string, options?: UseQueryOptions<any>) => {
  return useQuery(
    queryKeys.settings.property(tenantId),
    async () => {
      const response = await api.get(`/tenants/${tenantId}/settings`);
      return response.data?.data;
    },
    {
      ...CACHE_STRATEGIES.STATIC_DATA,
      ...options,
    }
  );
};
