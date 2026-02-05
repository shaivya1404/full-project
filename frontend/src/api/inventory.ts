import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface Product {
  id: string;
  teamId: string;
  name: string;
  description: string;
  category?: string;
  price?: number;
  sku?: string;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderLevel: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LowStockProduct extends Product {
  stockStatus: 'out_of_stock' | 'low_stock' | 'critical';
}

export interface InventoryMovement {
  id: string;
  productId: string;
  movementType: 'sale' | 'restock' | 'adjustment' | 'return' | 'waste';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  orderId?: string;
  createdBy?: string;
  createdAt: string;
  product?: { name: string };
}

export interface InventoryStats {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalStockValue: number;
  recentMovements: InventoryMovement[];
}

export interface StockAdjustment {
  productId: string;
  quantity: number;
  movementType: 'sale' | 'restock' | 'adjustment' | 'return' | 'waste';
  reason?: string;
  orderId?: string;
  createdBy?: string;
}

export const useInventory = (
  teamId: string,
  page: number = 1,
  limit: number = 50,
  filters?: {
    category?: string;
    stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
    search?: string;
  }
) => {
  return useQuery({
    queryKey: ['inventory', teamId, page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('teamId', teamId);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (filters?.category) params.append('category', filters.category);
      if (filters?.stockStatus) params.append('stockStatus', filters.stockStatus);
      if (filters?.search) params.append('search', filters.search);

      const response = await client.get<{ data: Product[]; total: number }>(
        `/inventory?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!teamId,
  });
};

export const useInventoryStats = (teamId: string) => {
  return useQuery({
    queryKey: ['inventoryStats', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: InventoryStats }>(`/inventory/stats?teamId=${teamId}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useLowStockProducts = (teamId: string) => {
  return useQuery({
    queryKey: ['lowStockProducts', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: LowStockProduct[] }>(`/inventory/low-stock?teamId=${teamId}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useProductStock = (productId: string) => {
  return useQuery({
    queryKey: ['productStock', productId],
    queryFn: async () => {
      const response = await client.get<{ data: Product }>(`/inventory/${productId}`);
      return response.data.data;
    },
    enabled: !!productId,
  });
};

export const useStockHistory = (productId: string, page: number = 1, limit: number = 50) => {
  return useQuery({
    queryKey: ['stockHistory', productId, page, limit],
    queryFn: async () => {
      const response = await client.get<{ data: InventoryMovement[]; total: number }>(
        `/inventory/${productId}/movements?page=${page}&limit=${limit}`
      );
      return response.data;
    },
    enabled: !!productId,
  });
};

export const useCheckAvailability = () => {
  return useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await client.post<{
        data: { available: boolean; currentStock: number; requestedQuantity: number };
      }>('/inventory/check-availability', { productId, quantity });
      return response.data.data;
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, ...data }: StockAdjustment) => {
      const response = await client.post<{ data: InventoryMovement }>(
        `/inventory/${productId}/adjust`,
        data
      );
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
      queryClient.invalidateQueries({ queryKey: ['productStock', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['stockHistory', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
    },
  });
};

export const useRestockProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      reason,
      createdBy,
    }: {
      productId: string;
      quantity: number;
      reason?: string;
      createdBy?: string;
    }) => {
      const response = await client.post<{ data: InventoryMovement }>(
        `/inventory/${productId}/restock`,
        { quantity, reason, createdBy }
      );
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
      queryClient.invalidateQueries({ queryKey: ['productStock', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['lowStockProducts'] });
    },
  });
};

export const useUpdateAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) => {
      await client.put(`/inventory/${productId}/availability`, { isAvailable });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['productStock', variables.productId] });
    },
  });
};
