import { useMutation, useQueryClient } from '@tanstack/react-query';
import client, { API_BASE_URL } from './client';
import { useAuthStore } from '../store/authStore';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  warnings: string[];
  processedAt: string;
}

// Import contacts from CSV
export const useImportContacts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      skipDuplicates = true,
      validateOnly = false,
    }: {
      file: File;
      skipDuplicates?: boolean;
      validateOnly?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', skipDuplicates.toString());
      formData.append('validateOnly', validateOnly.toString());

      const response = await client.post('/bulk/import/contacts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

// Import products from CSV
export const useImportProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      skipDuplicates = true,
      validateOnly = false,
    }: {
      file: File;
      skipDuplicates?: boolean;
      validateOnly?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', skipDuplicates.toString());
      formData.append('validateOnly', validateOnly.toString());

      const response = await client.post('/bulk/import/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// Import customers from CSV
export const useImportCustomers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      skipDuplicates = true,
      validateOnly = false,
    }: {
      file: File;
      skipDuplicates?: boolean;
      validateOnly?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', skipDuplicates.toString());
      formData.append('validateOnly', validateOnly.toString());

      const response = await client.post('/bulk/import/customers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

// Bulk update orders
export const useBulkUpdateOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderIds,
      updates,
    }: {
      orderIds: string[];
      updates: { status?: string; notes?: string };
    }) => {
      const response = await client.post('/bulk/orders/update', { orderIds, updates });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

// Bulk update agents
export const useBulkUpdateAgents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentIds,
      updates,
    }: {
      agentIds: string[];
      updates: { availabilityStatus?: string; maxConcurrentCalls?: number };
    }) => {
      const response = await client.post('/bulk/agents/update', { agentIds, updates });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

// Bulk delete
export const useBulkDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      ids,
    }: {
      type: 'contacts' | 'products' | 'customers' | 'orders';
      ids: string[];
    }) => {
      const response = await client.post('/bulk/delete', { type, ids });
      return response.data.data as BulkOperationResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type] });
    },
  });
};

// Download import template
export const downloadImportTemplate = async (type: 'contacts' | 'products' | 'customers') => {
  const token = useAuthStore.getState().getToken();

  const response = await fetch(`${API_BASE_URL}/bulk/templates/${type}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download template');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${type}_template.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
