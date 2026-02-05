import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface LeadScoreDetails {
  contactId: string;
  totalScore: number;
  tier: 'hot' | 'warm' | 'cold' | 'unknown';
  breakdown: {
    callHistory: number;
    engagement: number;
    recency: number;
    signals: number;
  };
  buyingSignals: string[];
  lastScoredAt: string;
}

export interface LeadAnalytics {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  topSignals: { signal: string; count: number }[];
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  leadScore: number;
  leadTier: string;
  leadSource?: string;
  interestLevel: number;
  buyingSignals?: string;
  totalCalls: number;
  successfulCalls: number;
  lastContactedAt?: string;
  createdAt: string;
}

export const useHotLeads = (campaignId?: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['leads', 'hot', campaignId, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (campaignId) params.append('campaignId', campaignId);
      params.append('limit', limit.toString());

      const response = await client.get<{ data: Contact[] }>(`/leads/hot?${params.toString()}`);
      return response.data.data;
    },
  });
};

export const useLeadsByTier = (
  tier: 'hot' | 'warm' | 'cold' | 'unknown',
  campaignId?: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: ['leads', 'tier', tier, campaignId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (campaignId) params.append('campaignId', campaignId);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await client.get<{ data: Contact[]; total: number }>(
        `/leads/tier/${tier}?${params.toString()}`
      );
      return response.data;
    },
  });
};

export const useLeadScore = (contactId: string) => {
  return useQuery({
    queryKey: ['leadScore', contactId],
    queryFn: async () => {
      const response = await client.get<{ data: LeadScoreDetails }>(`/leads/${contactId}/score`);
      return response.data.data;
    },
    enabled: !!contactId,
  });
};

export const useLeadAnalytics = (teamId?: string, campaignId?: string) => {
  return useQuery({
    queryKey: ['leadAnalytics', teamId, campaignId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      if (campaignId) params.append('campaignId', campaignId);

      const response = await client.get<{ data: LeadAnalytics }>(`/leads/analytics?${params.toString()}`);
      return response.data.data;
    },
  });
};

export const useRecalculateLeadScore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await client.post<{ data: LeadScoreDetails }>(`/leads/${contactId}/recalculate`);
      return response.data.data;
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['leadScore', contactId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};

export const useBulkRecalculateScores = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await client.post<{ data: { processed: number } }>(
        `/leads/campaign/${campaignId}/recalculate`
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadAnalytics'] });
    },
  });
};

export const useDetectBuyingSignals = () => {
  return useMutation({
    mutationFn: async (text: string) => {
      const response = await client.post<{ data: { signals: string[] } }>('/leads/detect-signals', { text });
      return response.data.data.signals;
    },
  });
};
