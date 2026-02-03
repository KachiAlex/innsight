import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://innsight-backend.onrender.com/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Don't send auth token for public endpoints
  const publicEndpoints = ['/auth/login', '/auth/register', '/auth/refresh'];
  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    config.url?.includes(endpoint)
  );
  
  if (!isPublicEndpoint) {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on a public route
      const currentPath = window.location.pathname;
      const publicRoutes = ['/', '/login'];
      const isPublicRoute = publicRoutes.includes(currentPath);
      
      // Check if this is a public auth endpoint (login, register, etc.)
      const isPublicAuthEndpoint = error.config?.url?.includes('/auth/login') || 
                                   error.config?.url?.includes('/auth/register');
      
      // Always logout on 401 to clear stale tokens (unless it's a public auth endpoint)
      if (!isPublicAuthEndpoint) {
        useAuthStore.getState().logout();
      }
      
      // Suppress 401 errors on public routes - they're expected
      if (isPublicRoute || isPublicAuthEndpoint) {
        // Don't log or show errors for expected 401s on public routes
        // Just silently reject the promise
        return Promise.reject(error);
      }
      
      // Token expired, try to refresh (only for protected routes)
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { token } = response.data.data;
          useAuthStore.getState().setAuth(
            token,
            refreshToken,
            useAuthStore.getState().user!
          );
          // Retry original request
          error.config.headers.Authorization = `Bearer ${token}`;
          return axios.request(error.config);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          toast.error('Session expired. Please login again.');
          window.location.href = '/login';
        }
      } else {
        // No refresh token - redirect to login
        toast.error('Session expired. Please login again.');
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.data?.error?.message) {
      toast.error(error.response.data.error.message);
    } else if (error.message) {
      toast.error(error.message);
    }
    return Promise.reject(error);
  }
);
