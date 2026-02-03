import axios, { AxiosHeaders } from 'axios';
import toast from 'react-hot-toast';

const HOSTING_ORIGINS = new Set([
  'https://innsight-2025.web.app',
  'https://innsight-2025.firebaseapp.com',
]);

const resolveApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof window === 'undefined') {
    return envUrl || 'https://innsight-backend.onrender.com/api';
  }
  const origin = window.location.origin;
  if (HOSTING_ORIGINS.has(origin)) {
    return 'https://innsight-backend.onrender.com/api';
  }
  return envUrl || 'https://innsight-backend.onrender.com/api';
};

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, '') || '/api';
export const PUBLIC_PORTAL_BASE_URL = `${API_BASE_URL}/public/portal`;
const GUEST_SESSION_STORAGE_KEY = 'diy_guest_session';
const CUSTOMER_TOKEN_STORAGE_KEY = 'diy_customer_token';
export const SUPPRESS_TOAST_HEADER = 'x-suppress-toast';

export const suppressToastHeaders = (headers: Record<string, string> = {}) => ({
  ...headers,
  [SUPPRESS_TOAST_HEADER]: 'true',
});

export const getGuestSessionToken = () =>
  typeof window !== 'undefined'
    ? localStorage.getItem(GUEST_SESSION_STORAGE_KEY) ?? undefined
    : undefined;

export const persistGuestSessionToken = (token?: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, token);
  }
};

export const clearGuestSessionToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
};

export const getCustomerToken = () =>
  typeof window !== 'undefined'
    ? localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY) ?? undefined
    : undefined;

export const persistCustomerToken = (token?: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, token);
  }
};

export const clearCustomerToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
};

export const buildGuestHeaders = (): Record<string, string> => {
  const token = getGuestSessionToken();
  return token ? { 'x-guest-session': token } : {};
};

export const publicApi = axios.create({
  baseURL: PUBLIC_PORTAL_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

publicApi.interceptors.request.use((config) => {
  const guestHeaders = buildGuestHeaders();
  const customerToken = getCustomerToken();
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);

  Object.entries(guestHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (customerToken) {
    headers.set('x-customer-token', customerToken);
  }

  config.headers = headers;
  return config;
});

publicApi.interceptors.response.use(
  (response) => {
    const guestSession =
      response.headers?.['x-guest-session'] ||
      response.data?.guestSessionToken ||
      response.data?.data?.guestSessionToken;
    if (guestSession) {
      persistGuestSessionToken(guestSession);
    }

    const customerToken =
      response.headers?.['x-customer-token'] ||
      response.data?.customerToken ||
      response.data?.data?.customerToken;
    if (customerToken) {
      persistCustomerToken(customerToken);
    }

    return response;
  },
  (error) => {
    const headers = error.config?.headers;
    let suppressToast = false;
    if (headers) {
      if (headers instanceof AxiosHeaders) {
        suppressToast = headers.get(SUPPRESS_TOAST_HEADER) === 'true';
      } else {
        suppressToast = headers[SUPPRESS_TOAST_HEADER] === 'true';
      }
    }

    if (!suppressToast) {
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Something went wrong';
      toast.error(message);
    }
    return Promise.reject(error);
  }
);
