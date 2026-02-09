import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  persistCustomerToken,
  persistGuestSessionToken,
  clearCustomerAuthState,
  getGuestSessionToken,
  getCustomerToken,
} from '../lib/publicApi';

type GuestAccount = {
  id: string;
  email: string;
  phone?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  marketingOptIn?: boolean;
  lastLoginAt?: string | null;
};

type CustomerAuthState = {
  tenantSlug?: string;
  customerToken?: string;
  guestSessionToken?: string;
  guestAccount?: GuestAccount | null;
  primaryReservationId?: string | null;
  reservations?: any[];
  setAuthFromResponse: (tenantSlug: string, response: any) => void;
  setGuestAccount: (account: GuestAccount | null) => void;
  clear: () => void;
};

const storage = createJSONStorage<CustomerAuthState>(() => localStorage);

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      tenantSlug: undefined,
      customerToken: getCustomerToken(),
      guestSessionToken: getGuestSessionToken(),
      guestAccount: null,
      primaryReservationId: null,
      reservations: [],
      setAuthFromResponse: (tenantSlug, response) => {
        const customerToken = response.token ?? response.customerToken;
        const guestSessionToken = response.guestSessionToken;
        const guestAccount = response.data?.guestAccount ?? response.guestAccount ?? null;
        const reservations = response.data?.reservations ?? response.reservations ?? [];
        const reservation = response.data?.reservation ?? response.reservation;
        const primaryReservationId = reservation?.id ?? null;

        if (customerToken) {
          persistCustomerToken(customerToken);
        }
        if (guestSessionToken) {
          persistGuestSessionToken(guestSessionToken);
        }

        set({
          tenantSlug,
          customerToken: customerToken ?? undefined,
          guestSessionToken: guestSessionToken ?? undefined,
          guestAccount,
          primaryReservationId,
          reservations,
        });
      },
      setGuestAccount: (account) => set({ guestAccount: account }),
      clear: () => {
        clearCustomerAuthState();
        set({
          tenantSlug: undefined,
          customerToken: undefined,
          guestSessionToken: undefined,
          guestAccount: null,
          primaryReservationId: null,
          reservations: [],
        });
      },
    }),
    {
      name: 'customer-auth-store',
      storage,
      partialize: (state) => ({
        tenantSlug: state.tenantSlug,
        customerToken: state.customerToken,
        guestSessionToken: state.guestSessionToken,
        guestAccount: state.guestAccount,
        primaryReservationId: state.primaryReservationId,
        reservations: state.reservations,
      }),
    }
  )
);
