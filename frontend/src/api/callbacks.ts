import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface Callback {
  id: string;
  teamId: string;
  contactId: string;
  campaignId?: string;
  scheduledTime: string;
  timezone: string;
  reason?: string;
  priority: number;
  status: 'pending' | 'completed' | 'cancelled' | 'missed';
  attempts: number;
  maxAttempts: number;
  completedAt?: string;
  resultCallId?: string;
  notes?: string;
  createdAt: string;
  contact: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
}

export interface CallbackStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  missed: number;
  completionRate: number;
  avgCallbackDelay: number;
  byReason: { reason: string; count: number }[];
}

export interface ScheduleCallbackInput {
  teamId: string;
  contactId: string;
  campaignId?: string;
  scheduledTime: string;
  timezone?: string;
  reason?: string;
  priority?: number;
  notes?: string;
  maxAttempts?: number;
}

export const useCallbacks = (
  teamId: string,
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: string;
    campaignId?: string;
    startDate?: string;
    endDate?: string;
  }
) => {
  return useQuery({
    queryKey: ['callbacks', teamId, page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('teamId', teamId);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (filters?.status) params.append('status', filters.status);
      if (filters?.campaignId) params.append('campaignId', filters.campaignId);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const response = await client.get<{ data: Callback[]; total: number }>(
        `/callbacks?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!teamId,
  });
};

export const useUpcomingCallbacks = (teamId: string, hours: number = 24) => {
  return useQuery({
    queryKey: ['callbacks', 'upcoming', teamId, hours],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('teamId', teamId);
      params.append('hours', hours.toString());

      const response = await client.get<{ data: Callback[] }>(`/callbacks/upcoming?${params.toString()}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useCallbackStats = (teamId: string, days: number = 30) => {
  return useQuery({
    queryKey: ['callbackStats', teamId, days],
    queryFn: async () => {
      const response = await client.get<{ data: CallbackStats }>(`/callbacks/stats/${teamId}?days=${days}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useBestTimeToCall = (contactId: string) => {
  return useQuery({
    queryKey: ['bestTimeToCall', contactId],
    queryFn: async () => {
      const response = await client.get<{ data: { bestTime: string | null } }>(
        `/callbacks/best-time/${contactId}`
      );
      return response.data.data.bestTime;
    },
    enabled: !!contactId,
  });
};

export const useScheduleCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleCallbackInput) => {
      const response = await client.post<{ data: Callback }>('/callbacks', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
};

export const useRescheduleCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scheduledTime, notes }: { id: string; scheduledTime: string; notes?: string }) => {
      const response = await client.put<{ data: Callback }>(`/callbacks/${id}/reschedule`, {
        scheduledTime,
        notes,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
};

export const useCancelCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/callbacks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
};

export const useCompleteCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, resultCallId, notes }: { id: string; resultCallId?: string; notes?: string }) => {
      await client.post(`/callbacks/${id}/complete`, { resultCallId, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callbacks'] });
    },
  });
};
