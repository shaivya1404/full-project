import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export interface User {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setToken: (accessToken: string | null, refreshToken?: string | null) => void;
  getToken: () => string | null;
}

const fallbackStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as unknown as { localStorage: StateStorage }).localStorage;
  }
  return fallbackStorage;
});

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
  'http://localhost:3000/api';

const resolveApiUrl = (path: string) => {
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const extractToken = (data: any): { accessToken: string | null; refreshToken: string | null; user: User | null } => {
  const payload = data?.data ?? data ?? {};
  const accessToken =
    payload.accessToken ?? payload.token ?? payload.access_token ?? payload.data?.accessToken ?? null;
  const refreshToken =
    payload.refreshToken ?? payload.refresh_token ?? payload.data?.refreshToken ?? null;
  const user = payload.user ?? payload.data?.user ?? null;

  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    user: user ?? null,
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(resolveApiUrl('/auth/login'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            let message = 'Login failed';
            try {
              const errorBody = await response.json();
              message = errorBody?.message || message;
            } catch {
              // Ignore parse errors and use default message
            }
            throw new Error(message);
          }

          const data = await response.json();
          const { accessToken, refreshToken, user } = extractToken(data);

          if (!accessToken) {
            throw new Error('No access token found in response');
          }

          set({
            user: user ?? null,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({
            error: message,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            user: null,
          });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setToken: (accessToken: string | null, refreshToken?: string | null) => {
        set({
          accessToken,
          refreshToken: refreshToken ?? null,
          isAuthenticated: Boolean(accessToken),
        });
      },

      getToken: () => get().accessToken,
    }),
    {
      name: 'auth-store',
      storage,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
