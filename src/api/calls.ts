import { useQuery } from '@tanstack/react-query';
import client from './client';
import { Call, CallFilter, PaginatedResponse, CallStats } from '../types';

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

      const response = await client.get<PaginatedResponse<Call>>(`/calls?${params.toString()}`);
      return response.data;
    },
  });
};

export const useCall = (id: string | null) => {
  return useQuery({
    queryKey: ['call', id],
    queryFn: async () => {
      if (!id) throw new Error('Call ID is required');
      const response = await client.get<Call>(`/calls/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCallStats = () => {
  return useQuery({
    queryKey: ['callStats'],
    queryFn: async () => {
      const response = await client.get<CallStats>('/analytics/calls');
      return response.data;
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
