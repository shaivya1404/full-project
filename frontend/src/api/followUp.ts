import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface FollowUpSequence {
  id: string;
  teamId: string;
  campaignId?: string;
  name: string;
  description?: string;
  triggerEvent: string;
  isActive: boolean;
  priority: number;
  maxExecutions: number;
  cooldownHours: number;
  createdAt: string;
  updatedAt: string;
  steps: FollowUpStep[];
  campaign?: { id: string; name: string };
  _count?: { executions: number };
}

export interface FollowUpStep {
  id: string;
  sequenceId: string;
  stepOrder: number;
  actionType: 'sms' | 'email' | 'callback' | 'whatsapp' | 'wait';
  delayMinutes: number;
  delayType: 'after_previous' | 'after_trigger' | 'specific_time';
  specificTime?: string;
  templateContent?: string;
  subject?: string;
  callbackPriority?: number;
  conditions?: string;
  skipIfContacted: boolean;
  isActive: boolean;
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
  campaignId?: string;
  triggerEvent: string;
  isActive?: boolean;
  priority?: number;
  maxExecutions?: number;
  cooldownHours?: number;
}

export interface CreateStepInput {
  stepOrder: number;
  actionType: string;
  delayMinutes?: number;
  delayType?: string;
  specificTime?: string;
  templateContent?: string;
  subject?: string;
  callbackPriority?: number;
  conditions?: Record<string, any>;
  skipIfContacted?: boolean;
}

export interface SequenceAnalytics {
  totalExecutions: number;
  completedExecutions: number;
  cancelledExecutions: number;
  activeExecutions: number;
  stepAnalytics: {
    stepOrder: number;
    actionType: string;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
  }[];
  conversionRate: number;
}

// API functions
const followUpApi = {
  listSequences: async (campaignId?: string): Promise<FollowUpSequence[]> => {
    const params = campaignId ? `?campaignId=${campaignId}` : '';
    const response = await apiClient.get(`/follow-up/sequences${params}`);
    return response.data.data;
  },

  getSequence: async (id: string): Promise<FollowUpSequence> => {
    const response = await apiClient.get(`/follow-up/sequences/${id}`);
    return response.data.data;
  },

  createSequence: async (data: CreateSequenceInput): Promise<FollowUpSequence> => {
    const response = await apiClient.post('/follow-up/sequences', data);
    return response.data.data;
  },

  updateSequence: async (id: string, data: Partial<CreateSequenceInput>): Promise<FollowUpSequence> => {
    const response = await apiClient.put(`/follow-up/sequences/${id}`, data);
    return response.data.data;
  },

  deleteSequence: async (id: string): Promise<void> => {
    await apiClient.delete(`/follow-up/sequences/${id}`);
  },

  getSequenceAnalytics: async (id: string): Promise<SequenceAnalytics> => {
    const response = await apiClient.get(`/follow-up/sequences/${id}/analytics`);
    return response.data.data;
  },

  addStep: async (sequenceId: string, data: CreateStepInput): Promise<FollowUpStep> => {
    const response = await apiClient.post(`/follow-up/sequences/${sequenceId}/steps`, data);
    return response.data.data;
  },

  updateStep: async (stepId: string, data: Partial<CreateStepInput>): Promise<FollowUpStep> => {
    const response = await apiClient.put(`/follow-up/steps/${stepId}`, data);
    return response.data.data;
  },

  deleteStep: async (stepId: string): Promise<void> => {
    await apiClient.delete(`/follow-up/steps/${stepId}`);
  },

  reorderSteps: async (sequenceId: string, stepIds: string[]): Promise<void> => {
    await apiClient.post(`/follow-up/sequences/${sequenceId}/reorder`, { stepIds });
  },

  triggerSequence: async (data: {
    triggerEvent: string;
    contactId: string;
    callLogId?: string;
    campaignId?: string;
  }): Promise<any[]> => {
    const response = await apiClient.post('/follow-up/trigger', data);
    return response.data.data;
  },

  cancelExecution: async (executionId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/follow-up/executions/${executionId}/cancel`, { reason });
  },

  getTemplateVariables: async (): Promise<string[]> => {
    const response = await apiClient.get('/follow-up/template-variables');
    return response.data.data;
  },
};

// Hooks

export function useFollowUpSequences(campaignId?: string) {
  return useQuery({
    queryKey: ['follow-up-sequences', campaignId],
    queryFn: () => followUpApi.listSequences(campaignId),
  });
}

export function useFollowUpSequence(id: string) {
  return useQuery({
    queryKey: ['follow-up-sequence', id],
    queryFn: () => followUpApi.getSequence(id),
    enabled: !!id,
  });
}

export function useSequenceAnalytics(id: string) {
  return useQuery({
    queryKey: ['sequence-analytics', id],
    queryFn: () => followUpApi.getSequenceAnalytics(id),
    enabled: !!id,
  });
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: ['template-variables'],
    queryFn: followUpApi.getTemplateVariables,
    staleTime: Infinity,
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followUpApi.createSequence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSequenceInput> }) =>
      followUpApi.updateSequence(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequence', variables.id] });
    },
  });
}

export function useDeleteSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followUpApi.deleteSequence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
  });
}

export function useAddStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sequenceId, data }: { sequenceId: string; data: CreateStepInput }) =>
      followUpApi.addStep(sequenceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequence', variables.sequenceId] });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: Partial<CreateStepInput> }) =>
      followUpApi.updateStep(stepId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followUpApi.deleteStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
  });
}

export function useReorderSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sequenceId, stepIds }: { sequenceId: string; stepIds: string[] }) =>
      followUpApi.reorderSteps(sequenceId, stepIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequence', variables.sequenceId] });
    },
  });
}

export function useTriggerSequence() {
  return useMutation({
    mutationFn: followUpApi.triggerSequence,
  });
}

export function useCancelExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ executionId, reason }: { executionId: string; reason?: string }) =>
      followUpApi.cancelExecution(executionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-sequences'] });
    },
  });
}

// Trigger event options
export const TRIGGER_EVENTS = [
  { value: 'call_completed', label: 'Call Completed' },
  { value: 'call_no_answer', label: 'No Answer' },
  { value: 'call_voicemail', label: 'Voicemail' },
  { value: 'call_busy', label: 'Busy' },
  { value: 'lead_interested', label: 'Lead Interested' },
  { value: 'lead_not_interested', label: 'Lead Not Interested' },
  { value: 'lead_callback_requested', label: 'Callback Requested' },
  { value: 'order_placed', label: 'Order Placed' },
  { value: 'order_cancelled', label: 'Order Cancelled' },
];

// Action type options
export const ACTION_TYPES = [
  { value: 'sms', label: 'SMS', icon: 'MessageSquare' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'callback', label: 'Callback', icon: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { value: 'wait', label: 'Wait', icon: 'Clock' },
];

export default followUpApi;
