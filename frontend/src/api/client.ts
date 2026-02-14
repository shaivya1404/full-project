import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
  '/api';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
  timeout: 30000, // 30 second timeout
});

// Request ID for tracking
let requestId = 0;
const generateRequestId = () => `req_${++requestId}_${Date.now()}`;

// Track pending refresh to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracking
    config.headers['X-Request-ID'] = generateRequestId();

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with token refresh
client.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const authStore = useAuthStore.getState();
      const refreshToken = authStore.refreshToken;

      if (refreshToken && !isRefreshing) {
        isRefreshing = true;
        originalRequest._retry = true;

        try {
          // Attempt token refresh
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          authStore.setToken(accessToken, refreshToken);
          processQueue(null, accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          authStore.logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            },
            reject: (err: any) => reject(err),
          });
        });
      }

      // No refresh token, logout
      authStore.logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    // Handle other errors
    const errorMessage = getErrorMessage(error);

    return Promise.reject({
      ...error,
      message: errorMessage,
    });
  }
);

// Error message extraction
export const getErrorMessage = (error: AxiosError<any>): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Export for use in components
export { API_BASE_URL };
export default client;
