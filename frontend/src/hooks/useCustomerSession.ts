import { useCallback, useEffect, useState } from 'react';
import { fetchCustomerProfile } from '../lib/publicCustomerApi';
import { useCustomerAuthStore } from '../store/customerAuthStore';

export const useCustomerSession = (tenantSlug?: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const setAuthFromResponse = useCustomerAuthStore((state) => state.setAuthFromResponse);
  const clear = useCustomerAuthStore((state) => state.clear);

  const fetchProfile = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomerProfile(tenantSlug);
      setProfile(response.data);
      setAuthFromResponse(tenantSlug, response);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to fetch your session right now.'
      );
      if (err?.response?.status === 401) {
        clear();
      }
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, setAuthFromResponse, clear]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const hasReservation = Boolean(profile?.reservation || profile?.reservations?.length);
  const hasGuestAccount = Boolean(profile?.guestAccount);

  return {
    loading,
    error,
    profile,
    hasReservation,
    hasGuestAccount,
    refresh: fetchProfile,
  };
};
