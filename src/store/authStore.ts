import { create } from 'zustand';
import Cookies from 'js-cookie';

export interface User {
  id: string;
  username: string;
  email?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  restoreFromCookie: () => void;
}

const TOKEN_COOKIE_NAME = 'auth_token';
const USER_COOKIE_NAME = 'auth_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: (user: User, token: string) => {
    Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 7, sameSite: 'Lax' });
    Cookies.set(USER_COOKIE_NAME, JSON.stringify(user), { expires: 7, sameSite: 'Lax' });
    set({
      user,
      token,
      isAuthenticated: true,
      error: null,
    });
  },

  logout: () => {
    Cookies.remove(TOKEN_COOKIE_NAME);
    Cookies.remove(USER_COOKIE_NAME);
    set({
      user: null,
      token: null,
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

  restoreFromCookie: () => {
    const token = Cookies.get(TOKEN_COOKIE_NAME);
    const userJson = Cookies.get(USER_COOKIE_NAME);

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } catch {
        // Invalid cookie data, clear them
        Cookies.remove(TOKEN_COOKIE_NAME);
        Cookies.remove(USER_COOKIE_NAME);
      }
    }
  },
}));
