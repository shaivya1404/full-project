import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  orderUpdates: boolean;
  paymentUpdates: boolean;
  campaignUpdates: boolean;
  callAlerts: boolean;
  teamUpdates: boolean;
  marketingEmails: boolean;
}

// Fetch notifications
export const useNotifications = (options?: { unreadOnly?: boolean; limit?: number }) => {
  return useQuery({
    queryKey: ['notifications', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.unreadOnly) params.append('unreadOnly', 'true');
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await client.get(`/notifications?${params.toString()}`);
      return response.data.data as { notifications: Notification[]; unreadCount: number };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// Get unread count
export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const response = await client.get('/notifications/unread-count');
      return response.data.data.count as number;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

// Mark notification as read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await client.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// Mark all as read
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await client.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// Delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await client.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// Get notification preferences
export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const response = await client.get('/notifications/preferences');
      return response.data.data as NotificationPreferences;
    },
  });
};

// Update notification preferences
export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const response = await client.put('/notifications/preferences', preferences);
      return response.data.data as NotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
  });
};
