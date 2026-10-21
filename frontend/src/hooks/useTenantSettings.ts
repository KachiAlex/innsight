import { useQuery } from 'react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface TenantSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  [key: string]: unknown;
}

const FALLBACK: TenantSettings = {
  currency: 'NGN',
  currencySymbol: '₦',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

/**
 * Tenant-scoped settings (currency symbol, timezone, formats).
 * Cached for 10 minutes — settings change rarely.
 */
export function useTenantSettings(): TenantSettings {
  const tenantId = useAuthStore((s) => s.user?.tenantId);

  const { data } = useQuery(
    ['tenant-settings', tenantId],
    async () => {
      const res = await api.get(`/tenants/${tenantId}/settings`);
      return res.data?.data as TenantSettings;
    },
    {
      enabled: !!tenantId,
      staleTime: 10 * 60 * 1000,
      retry: 1,
    }
  );

  return { ...FALLBACK, ...data };
}
