import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface SmsTemplate {
  id: string;
  teamId: string;
  type: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface SmsLog {
  id: string;
  teamId?: string;
  to: string;
  message: string;
  templateType?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  messageSid?: string;
  errorMessage?: string;
  orderId?: string;
  customerId?: string;
  createdAt: string;
}

export type SmsTemplateType =
  | 'order_confirmation'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'callback_reminder'
  | 'follow_up'
  | 'promotional'
  | 'custom';

// API functions
const smsApi = {
  sendSms: async (data: {
    to: string;
    message: string;
    teamId?: string;
    orderId?: string;
    customerId?: string;
    templateType?: string;
  }): Promise<SmsLog> => {
    const response = await apiClient.post('/sms/send', data);
    return response.data.data;
  },

  sendTemplatedSms: async (data: {
    templateType: SmsTemplateType;
    to: string;
    variables?: Record<string, string>;
    teamId?: string;
    orderId?: string;
    customerId?: string;
  }): Promise<SmsLog> => {
    const response = await apiClient.post('/sms/send-template', data);
    return response.data.data;
  },

  sendOrderConfirmation: async (orderId: string): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/confirmation`);
    return response.data.data;
  },

  sendOrderReady: async (orderId: string): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/ready`);
    return response.data.data;
  },

  sendOutForDelivery: async (orderId: string, trackingLink?: string): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/out-for-delivery`, { trackingLink });
    return response.data.data;
  },

  sendOrderDelivered: async (orderId: string, feedbackLink?: string): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/delivered`, { feedbackLink });
    return response.data.data;
  },

  sendOrderCancelled: async (orderId: string, cancelReason?: string): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/cancelled`, { cancelReason });
    return response.data.data;
  },

  sendPaymentReceived: async (orderId: string, amount: number): Promise<SmsLog> => {
    const response = await apiClient.post(`/sms/order/${orderId}/payment-received`, { amount });
    return response.data.data;
  },

  getTemplates: async (teamId: string): Promise<SmsTemplate[]> => {
    const response = await apiClient.get(`/sms/templates/${teamId}`);
    return response.data.data;
  },

  saveTemplate: async (
    teamId: string,
    type: SmsTemplateType,
    content: string,
    name?: string
  ): Promise<SmsTemplate> => {
    const response = await apiClient.put(`/sms/templates/${teamId}/${type}`, { content, name });
    return response.data.data;
  },

  resetTemplate: async (teamId: string, type: SmsTemplateType): Promise<void> => {
    await apiClient.delete(`/sms/templates/${teamId}/${type}`);
  },

  getTemplateVariables: async (): Promise<string[]> => {
    const response = await apiClient.get('/sms/template-variables');
    return response.data.data;
  },

  getLogs: async (
    teamId: string,
    options?: { limit?: number; offset?: number; status?: string; orderId?: string; customerId?: string }
  ): Promise<{ logs: SmsLog[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.status) params.set('status', options.status);
    if (options?.orderId) params.set('orderId', options.orderId);
    if (options?.customerId) params.set('customerId', options.customerId);

    const response = await apiClient.get(`/sms/logs/${teamId}?${params.toString()}`);
    return { logs: response.data.data, total: response.data.total };
  },
};

// Hooks

export function useSmsTemplates(teamId: string) {
  return useQuery({
    queryKey: ['sms-templates', teamId],
    queryFn: () => smsApi.getTemplates(teamId),
    enabled: !!teamId,
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      type,
      content,
      name,
    }: {
      teamId: string;
      type: SmsTemplateType;
      content: string;
      name?: string;
    }) => smsApi.saveTemplate(teamId, type, content, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', variables.teamId] });
    },
  });
}

export function useResetTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, type }: { teamId: string; type: SmsTemplateType }) =>
      smsApi.resetTemplate(teamId, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates', variables.teamId] });
    },
  });
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: ['sms-template-variables'],
    queryFn: smsApi.getTemplateVariables,
    staleTime: Infinity,
  });
}

export function useSmsLogs(
  teamId: string,
  options?: { limit?: number; offset?: number; status?: string; orderId?: string; customerId?: string }
) {
  return useQuery({
    queryKey: ['sms-logs', teamId, options],
    queryFn: () => smsApi.getLogs(teamId, options),
    enabled: !!teamId,
  });
}

export function useSendSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: smsApi.sendSms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendTemplatedSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: smsApi.sendTemplatedSms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendOrderConfirmation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: smsApi.sendOrderConfirmation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendOrderReady() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: smsApi.sendOrderReady,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendOutForDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, trackingLink }: { orderId: string; trackingLink?: string }) =>
      smsApi.sendOutForDelivery(orderId, trackingLink),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendOrderDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, feedbackLink }: { orderId: string; feedbackLink?: string }) =>
      smsApi.sendOrderDelivered(orderId, feedbackLink),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendOrderCancelled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, cancelReason }: { orderId: string; cancelReason?: string }) =>
      smsApi.sendOrderCancelled(orderId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

export function useSendPaymentReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, amount }: { orderId: string; amount: number }) =>
      smsApi.sendPaymentReceived(orderId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });
}

// Template type display labels
export const SMS_TEMPLATE_TYPES: { value: SmsTemplateType; label: string }[] = [
  { value: 'order_confirmation', label: 'Order Confirmation' },
  { value: 'order_ready', label: 'Order Ready' },
  { value: 'order_out_for_delivery', label: 'Out for Delivery' },
  { value: 'order_delivered', label: 'Order Delivered' },
  { value: 'order_cancelled', label: 'Order Cancelled' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'callback_reminder', label: 'Callback Reminder' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'custom', label: 'Custom Message' },
];

export default smsApi;
