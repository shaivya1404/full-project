import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { useAuthStore } from '../store/authStore';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface Team {
  teamId: string;
  teamName: string;
  role: string;
}

// Get current user
export const useCurrentUser = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await client.get('/auth/me');
      return response.data.data as { user: User; teams: Team[] };
    },
    enabled: isAuthenticated,
    staleTime: 60000, // Cache for 1 minute
  });
};

// Login
export const useLogin = () => {
  const queryClient = useQueryClient();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await login(email, password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};

// Register
export const useRegister = () => {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const response = await client.post('/auth/register', data);
      return response.data;
    },
  });
};

// Logout
export const useLogout = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      try {
        await client.post('/auth/logout');
      } catch {
        // Ignore errors on logout
      }
    },
    onSettled: () => {
      logout();
      queryClient.clear();
    },
  });
};

// Logout from all devices
export const useLogoutAll = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await client.post('/auth/logout-all');
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
  });
};

// Change password
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      await client.put('/auth/password', { currentPassword, newPassword });
    },
  });
};

// Forgot password
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      await client.post('/auth/forgot-password', { email });
    },
  });
};

// Reset password
export const useResetPassword = () => {
  return useMutation({
    mutationFn: async ({
      token,
      code,
      password,
    }: {
      token: string;
      code?: string;
      password: string;
    }) => {
      await client.post('/auth/reset-password', { token, code, password });
    },
  });
};

// Send email verification
export const useSendEmailVerification = () => {
  return useMutation({
    mutationFn: async () => {
      await client.post('/auth/send-verification');
    },
  });
};

// Verify email
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      await client.post('/auth/verify-email', { token });
    },
  });
};

// Get sessions
export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await client.get('/auth/sessions');
      return response.data.data.sessions as Session[];
    },
  });
};

// Delete session
export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await client.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};

// 2FA Status
export const use2FAStatus = () => {
  return useQuery({
    queryKey: ['2faStatus'],
    queryFn: async () => {
      const response = await client.get('/auth/2fa/status');
      return response.data.data as { enabled: boolean };
    },
  });
};

// Setup 2FA
export const useSetup2FA = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await client.post('/auth/2fa/setup');
      return response.data.data as {
        secret: string;
        otpauthUrl: string;
        backupCodes: string[];
      };
    },
  });
};

// Verify 2FA
export const useVerify2FA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      await client.post('/auth/2fa/verify', { code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2faStatus'] });
    },
  });
};

// Disable 2FA
export const useDisable2FA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, password }: { code?: string; password: string }) => {
      await client.post('/auth/2fa/disable', { code, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2faStatus'] });
    },
  });
};
