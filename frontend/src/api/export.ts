import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client, { API_BASE_URL } from './client';
import { useAuthStore } from '../store/authStore';

export type ExportType = 'calls' | 'orders' | 'payments' | 'analytics' | 'agents' | 'campaigns' | 'customers' | 'invoices' | 'audit_logs';
export type ExportFormat = 'csv' | 'pdf' | 'json';

export interface ExportJob {
  id: string;
  type: ExportType;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recordCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface ExportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  teamId?: string;
  search?: string;
}

// Create export job
export const useCreateExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      format,
      filters,
    }: {
      type: ExportType;
      format: ExportFormat;
      filters?: ExportFilters;
    }) => {
      const response = await client.post('/export', { type, format, filters });
      return response.data.data as { jobId: string; statusUrl: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportJobs'] });
    },
  });
};

// Get export job status
export const useExportJob = (jobId: string | null) => {
  return useQuery({
    queryKey: ['exportJob', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('Job ID is required');
      const response = await client.get(`/export/${jobId}`);
      return response.data.data as ExportJob;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when job is complete or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });
};

// List export jobs
export const useExportJobs = (limit = 20) => {
  return useQuery({
    queryKey: ['exportJobs', limit],
    queryFn: async () => {
      const response = await client.get(`/export?limit=${limit}`);
      return response.data.data as ExportJob[];
    },
  });
};

// Download export file
export const downloadExport = async (jobId: string): Promise<void> => {
  const token = useAuthStore.getState().getToken();

  const response = await fetch(`${API_BASE_URL}/export/download/${jobId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download export');
  }

  // Get filename from headers
  const contentDisposition = response.headers.get('content-disposition');
  let filename = `export-${jobId}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+)"?/);
    if (match) filename = match[1];
  }

  // Download file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Quick export (sync)
export const useQuickExport = () => {
  return useMutation({
    mutationFn: async ({
      type,
      format,
      filters,
    }: {
      type: ExportType;
      format: ExportFormat;
      filters?: ExportFilters;
    }) => {
      const token = useAuthStore.getState().getToken();

      const response = await fetch(`${API_BASE_URL}/export/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, format, filters }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const contentType = response.headers.get('content-type');

      // If we got a file, download it
      if (contentType?.includes('text/csv') || contentType?.includes('application/pdf') || contentType?.includes('application/json')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_export.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { downloaded: true };
      }

      // Otherwise, we got a job ID for async processing
      const data = await response.json();
      return data.data;
    },
  });
};
