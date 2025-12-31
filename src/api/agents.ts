import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type { Agent, AgentSkill, AgentSchedule, Certification } from '../types';

export const useAgents = (teamId: string, limit: number, offset: number, filters?: { status?: string; role?: string; search?: string }) => {
  return useQuery({
    queryKey: ['agents', teamId, limit, offset, filters],
    queryFn: () => api.getAgents(teamId, limit, offset, filters),
  });
};

export const useAgent = (id: string | undefined) => {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => (id ? api.getAgentById(id) : Promise.reject('No ID')),
    enabled: !!id,
  });
};

export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: Partial<Agent> }) => api.createAgent(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useUpdateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Agent> }) => api.updateAgent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', variables.id] });
    },
  });
};

export const useDeleteAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useAgentStatus = (agentId: string) => {
  return useQuery({
    queryKey: ['agentStatus', agentId],
    queryFn: () => api.getAgentStatus(agentId),
    refetchInterval: 5000, // Poll for real-time status
  });
};

export const useUpdateAgentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, status, reason }: { agentId: string; status: string; reason?: string }) =>
      api.updateAgentStatus(agentId, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agentStatus', variables.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useAgentSkills = (agentId: string) => {
  return useQuery({
    queryKey: ['agentSkills', agentId],
    queryFn: () => api.getAgentSkills(agentId),
  });
};

export const useAddAgentSkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillData }: { agentId: string; skillData: Partial<AgentSkill> }) =>
      api.addAgentSkill(agentId, skillData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agentSkills', variables.agentId] });
    },
  });
};

export const useAgentSchedule = (agentId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['agentSchedule', agentId, startDate, endDate],
    queryFn: () => api.getAgentSchedule(agentId, startDate, endDate),
  });
};

export const useAgentPerformance = (agentId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['agentPerformance', agentId, startDate, endDate],
    queryFn: () => api.getAgentPerformance(agentId, startDate, endDate),
  });
};

export const useAgentActivityLog = (agentId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['agentActivityLog', agentId, startDate, endDate],
    queryFn: () => api.getAgentActivityLog(agentId, startDate, endDate),
  });
};

export const useAgentCertifications = (agentId: string) => {
  return useQuery({
    queryKey: ['agentCertifications', agentId],
    queryFn: () => api.getCertifications(agentId),
  });
};

export const useAgentQueue = (agentId: string) => {
  return useQuery({
    queryKey: ['agentQueue', agentId],
    queryFn: () => api.getAgentQueue(agentId),
    refetchInterval: 3000,
  });
};
