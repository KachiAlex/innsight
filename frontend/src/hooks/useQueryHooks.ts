import { useQuery, UseQueryOptions } from 'react-query';
import { api } from '../lib/api';
import { CACHE_STRATEGIES, queryKeys } from '../lib/queryClient';

type AnyQueryOptions = UseQueryOptions<any, unknown, any, any>;

/**
 * Custom hooks for cached data fetching with React Query
 * These hooks integrate with the queryClient configuration for optimal caching
 */

// ============================================
// DASHBOARD HOOKS
// ============================================

export interface DashboardReservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  status: string;
  rate: number;
  checkInDate: string;
  checkOutDate: string;
  room?: { id: string; roomNumber: string; roomType?: string };
}

export interface DashboardAlert {
  id: string;
  severity: string;
  title: string;
  message?: string;
  createdAt: string;
}

export interface DashboardStats {
  // KPIs
  arrivalsToday: number;
  awaitingCheckIn: number;
  departuresToday: number;
  inHouse: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRooms: number;
  // Legacy aliases kept for compatibility
  todayReservations: number;
  checkedIn: number;
  availableRooms: number;
  // Detail data
  arrivals: DashboardReservation[];
  departures: DashboardReservation[];
  roomStatusCounts: Record<string, number>;
  housekeepingTotal: number;
  housekeepingCompleted: number;
  maintenanceOpen: number;
  openAlerts: DashboardAlert[];
  dailyOccupancy: { date: string; occupancyRate: number; occupiedRooms: number }[];
  dailyRevenue: { date: string; amount: number }[];
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const sameDay = (iso: string, key: string) => iso?.slice(0, 10) === key;

export const useDashboardStats = (tenantId: string, options?: AnyQueryOptions) => {
  return useQuery(
    queryKeys.dashboard.stats(tenantId),
    async () => {
      const now = new Date();
      const today = dateKey(now);
      const from = dateKey(new Date(now.getTime() - 20 * 86400000));
      // Reservation list supports checkInDate/checkOutDate window filters —
      // widen it so in-house stays (checked in before today) are included.
      const windowStart = dateKey(new Date(now.getTime() - 14 * 86400000));
      const windowEnd = dateKey(new Date(now.getTime() + 30 * 86400000));

      const [
        reservations,
        rooms,
        revenue,
        occupancy,
        housekeeping,
        maintenance,
        alerts,
      ] = await Promise.all([
        api.get(`/tenants/${tenantId}/reservations`, {
          params: { startDate: windowStart, endDate: windowEnd, limit: 200 },
        }),
        api.get(`/tenants/${tenantId}/rooms`, { params: { limit: 500 } }),
        api.get(`/tenants/${tenantId}/reports/revenue`, { params: { from, to: today } }),
        api.get(`/tenants/${tenantId}/reports/occupancy`, { params: { from, to: today } }),
        api.get(`/tenants/${tenantId}/housekeeping`, { params: { limit: 100 } }),
        api.get(`/tenants/${tenantId}/maintenance`, { params: { limit: 100 } }),
        api.get(`/tenants/${tenantId}/alerts`, { params: { status: 'open', limit: 5 } }),
      ]);

      const reservationRows: DashboardReservation[] = reservations.data?.data ?? [];
      const roomRows: { status: string }[] = rooms.data?.data ?? [];
      const hkRows: { status: string }[] = housekeeping.data?.data ?? [];
      const maintRows: { status: string }[] = maintenance.data?.data ?? [];
      const occ = occupancy.data?.data ?? {};
      const rev = revenue.data?.data ?? {};
      const dailyRevenue: { date: string; amount: number }[] = rev.daily ?? [];

      const arrivals = reservationRows.filter((r) => sameDay(r.checkInDate, today));
      const departures = reservationRows.filter((r) => sameDay(r.checkOutDate, today));
      const inHouse = reservationRows.filter((r) => r.status === 'checked_in');

      const roomStatusCounts: Record<string, number> = {};
      for (const room of roomRows) {
        const s = room.status || 'unknown';
        roomStatusCounts[s] = (roomStatusCounts[s] || 0) + 1;
      }

      return {
        arrivalsToday: arrivals.length,
        awaitingCheckIn: arrivals.filter((r) => r.status === 'confirmed').length,
        departuresToday: departures.length,
        inHouse: inHouse.length,
        todayRevenue: dailyRevenue.find((d) => d.date === today)?.amount ?? 0,
        yesterdayRevenue:
          dailyRevenue.find((d) => d.date === dateKey(new Date(now.getTime() - 86400000)))
            ?.amount ?? 0,
        occupancyRate: occ.averageOccupancyRate ?? 0,
        adr: occ.adr ?? 0,
        revpar: occ.revpar ?? 0,
        totalRooms: occ.totalRooms ?? roomRows.length,
        todayReservations: arrivals.length,
        checkedIn: inHouse.length,
        availableRooms: roomStatusCounts['available'] ?? 0,
        arrivals,
        departures,
        roomStatusCounts,
        housekeepingTotal: hkRows.length,
        housekeepingCompleted: hkRows.filter(
          (t) => t.status === 'completed' || t.status === 'inspected'
        ).length,
        maintenanceOpen: maintRows.filter(
          (t) => !['resolved', 'closed', 'completed'].includes(t.status)
        ).length,
        openAlerts: alerts.data?.data ?? [],
        dailyOccupancy: occ.daily ?? [],
        dailyRevenue,
      } satisfies DashboardStats;
    },
    {
      ...CACHE_STRATEGIES.DASHBOARD_METRICS,
      ...options,
    }
  );
};

export const useDashboardMetrics = (tenantId: string, period: '7d' | '30d' | '90d' | '1y' = '30d', options?: AnyQueryOptions) => {
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

export const useRoomsList = (tenantId: string, options?: AnyQueryOptions) => {
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

export const useRoomStatus = (tenantId: string, options?: AnyQueryOptions) => {
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

export const useAvailableRooms = (tenantId: string, options?: AnyQueryOptions) => {
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
  queryOptions?: AnyQueryOptions
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

export const useTodayReservations = (tenantId: string, options?: AnyQueryOptions) => {
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

export const useGuestsList = (tenantId: string, page?: number, options?: AnyQueryOptions) => {
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

export const useGuestSearch = (tenantId: string, query: string, options?: AnyQueryOptions) => {
  return useQuery(
    queryKeys.guests.search(tenantId, query),
    async () => {
      if (!query) return [];
      const response = await api.get(`/tenants/${tenantId}/guests/search?q=${encodeURIComponent(query)}`);
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
  options?: AnyQueryOptions
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
  options?: AnyQueryOptions
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

export const useHousekeepingTasks = (tenantId: string, options?: AnyQueryOptions) => {
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

export const useStaffList = (tenantId: string, options?: AnyQueryOptions) => {
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

export const useRatePlansList = (tenantId: string, options?: AnyQueryOptions) => {
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

export const usePropertySettings = (tenantId: string, options?: AnyQueryOptions) => {
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
