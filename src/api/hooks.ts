import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import client from './client';
import { useAuthStore } from '../store/authStore';
import type { User } from '../store/authStore';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Auth API calls
export const useLogin = () => {
  const setError = useAuthStore((state) => state.setError);
  const login = useAuthStore((state) => state.login);

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: async (credentials) => {
      const response = await client.post<LoginResponse>('/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      login(data.user, data.token);
    },
    onError: (error) => {
      setError(error.message);
    },
  });
};

export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      await client.post('/auth/logout');
    },
    onSuccess: () => {
      logout();
    },
  });
};

// Example data fetch hook using TanStack Query
export const useFetchUsers = (options?: UseQueryOptions<User[]>) => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await client.get<User[]>('/users');
      return response.data;
    },
    ...options,
  });
};
