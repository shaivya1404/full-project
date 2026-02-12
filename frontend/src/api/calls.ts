import { useQuery } from '@tanstack/react-query';
import type { Call, CallFilter, PaginatedResponse, CallStats, DateRange } from '../types';
import client from './client';

export const useCalls = (filter: CallFilter) => {
  return useQuery({
    queryKey: ['calls', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.search) params.append('search', filter.search);
      if (filter.status) params.append('status', filter.status);
      if (filter.sentiment) params.append('sentiment', filter.sentiment);
      params.append('page', filter.page.toString());
      params.append('limit', filter.limit.toString());

      const response = await client.get(`/calls?${params.toString()}`);
      const raw = response.data;
      // Backend returns { data: Call[], pagination: { total, limit, offset, hasMore } }
      // Frontend expects { data: Call[], total, page, limit }
      return {
        data: raw.data || [],
        total: raw.pagination?.total ?? raw.total ?? 0,
        page: raw.pagination ? Math.floor(raw.pagination.offset / raw.pagination.limit) + 1 : (raw.page ?? 1),
        limit: raw.pagination?.limit ?? raw.limit ?? filter.limit,
      } as PaginatedResponse<Call>;
    },
  });
};

export const useCall = (id: string | null) => {
  return useQuery({
    queryKey: ['call', id],
    queryFn: async () => {
      if (!id) throw new Error('Call ID is required');
      const response = await client.get(`/calls/${id}`);
      const raw = response.data;
      return (raw.data || raw) as Call;
    },
    enabled: !!id,
  });
};

export const useCallStats = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['callStats', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

      const response = await client.get(`/analytics/calls?${params.toString()}`);
      // Backend wraps in { success, data: CallStats, message }
      const raw = response.data;
      return (raw.data || raw) as CallStats;
    },
  });
};

export const downloadRecording = async (callId: string) => {
  try {
    const response = await client.get(`/calls/${callId}/recording`, {
      responseType: 'blob',
    });
    
    // Try to get filename from content-disposition
    const contentDisposition = response.headers['content-disposition'];
    let filename = `recording-${callId}.mp3`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch.length === 2)
        filename = filenameMatch[1];
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download recording:', error);
    throw error;
  }
};
