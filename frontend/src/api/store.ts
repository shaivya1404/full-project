import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export interface OperatingHours {
  [day: string]: {
    open: string;
    close: string;
    isClosed?: boolean;
  };
}

export interface StoreInfo {
  id: string;
  teamId: string;
  storeName: string;
  address: string;
  phone?: string;
  operatingHours: string;
  timezone: string;
  deliveryEnabled: boolean;
  minOrderAmount: number;
  avgPrepTime: number;
  createdAt: string;
  updatedAt: string;
  deliveryZones?: DeliveryZone[];
}

export interface DeliveryZone {
  id: string;
  storeId: string;
  zoneName: string;
  postalCodes: string;
  postalCodesList?: string[];
  deliveryFee: number;
  minOrderAmount: number;
  estimatedTime: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryCheckResult {
  deliverable: boolean;
  zone?: DeliveryZone;
  deliveryFee: number;
  estimatedTime: number;
  reason?: string;
}

export interface CustomerInsights {
  customerId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
  favoriteItems: string[];
  orderFrequency: string;
  customerSince: string;
}

export interface OrderSuggestion {
  productId: string;
  productName: string;
  quantity: number;
  lastOrdered: string;
  orderCount: number;
}

// Store Info Hooks
export const useStoreInfo = (teamId: string) => {
  return useQuery({
    queryKey: ['storeInfo', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: StoreInfo }>(`/store/info?teamId=${teamId}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useUpdateStoreInfo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      teamId: string;
      storeName: string;
      address: string;
      phone?: string;
      operatingHours: OperatingHours;
      timezone?: string;
      deliveryEnabled?: boolean;
      minOrderAmount?: number;
      avgPrepTime?: number;
    }) => {
      const response = await client.put<{ data: StoreInfo }>('/store/info', data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storeInfo', variables.teamId] });
    },
  });
};

// Operating Hours Hooks
export const useStoreHours = (teamId: string) => {
  return useQuery({
    queryKey: ['storeHours', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: OperatingHours }>(`/store/hours?teamId=${teamId}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useIsStoreOpen = (teamId: string) => {
  return useQuery({
    queryKey: ['isStoreOpen', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: { isOpen: boolean } }>(`/store/is-open?teamId=${teamId}`);
      return response.data.data.isOpen;
    },
    enabled: !!teamId,
    refetchInterval: 60000, // Refresh every minute
  });
};

// Delivery Zone Hooks
export const useDeliveryZones = (teamId: string) => {
  return useQuery({
    queryKey: ['deliveryZones', teamId],
    queryFn: async () => {
      const response = await client.get<{ data: DeliveryZone[] }>(`/store/zones?teamId=${teamId}`);
      return response.data.data;
    },
    enabled: !!teamId,
  });
};

export const useCreateDeliveryZone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      teamId: string;
      zoneName: string;
      postalCodes: string[];
      deliveryFee: number;
      minOrderAmount?: number;
      estimatedTime: number;
    }) => {
      const response = await client.post<{ data: DeliveryZone }>('/store/zones', data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['storeInfo', variables.teamId] });
    },
  });
};

export const useUpdateDeliveryZone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      teamId,
      ...data
    }: {
      id: string;
      teamId: string;
      zoneName?: string;
      postalCodes?: string[];
      deliveryFee?: number;
      minOrderAmount?: number;
      estimatedTime?: number;
      isActive?: boolean;
    }) => {
      const response = await client.put<{ data: DeliveryZone }>(`/store/zones/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones', variables.teamId] });
    },
  });
};

export const useDeleteDeliveryZone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; teamId: string }) => {
      await client.delete(`/store/zones/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones', variables.teamId] });
    },
  });
};

// Delivery Check Hooks
export const useCheckDelivery = () => {
  return useMutation({
    mutationFn: async ({ teamId, postalCode }: { teamId: string; postalCode: string }) => {
      const response = await client.post<{ data: DeliveryCheckResult }>('/store/check-delivery', {
        teamId,
        postalCode,
      });
      return response.data.data;
    },
  });
};

export const useDeliveryFee = (teamId: string, postalCode: string) => {
  return useQuery({
    queryKey: ['deliveryFee', teamId, postalCode],
    queryFn: async () => {
      const response = await client.get<{ data: { deliveryFee: number } }>(
        `/store/delivery-fee?teamId=${teamId}&postalCode=${postalCode}`
      );
      return response.data.data.deliveryFee;
    },
    enabled: !!teamId && !!postalCode,
  });
};

export const useEstimatedDeliveryTime = (teamId: string, postalCode: string) => {
  return useQuery({
    queryKey: ['deliveryTime', teamId, postalCode],
    queryFn: async () => {
      const response = await client.get<{ data: { estimatedMinutes: number } }>(
        `/store/delivery-time?teamId=${teamId}&postalCode=${postalCode}`
      );
      return response.data.data.estimatedMinutes;
    },
    enabled: !!teamId && !!postalCode,
  });
};

// Customer Detection Hooks
export const useFindCustomer = (phone: string, teamId?: string) => {
  return useQuery({
    queryKey: ['customer', 'find', phone, teamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('phone', phone);
      if (teamId) params.append('teamId', teamId);

      const response = await client.get<{ data: any }>(`/store/customer/find?${params.toString()}`);
      return response.data.data;
    },
    enabled: !!phone,
  });
};

export const useGenerateGreeting = () => {
  return useMutation({
    mutationFn: async ({ phoneNumber, teamId }: { phoneNumber: string; teamId: string }) => {
      const response = await client.post<{
        data: {
          isReturning: boolean;
          greeting: string;
          customerName?: string;
          lastOrderSummary?: string;
        };
      }>('/store/customer/greeting', { phoneNumber, teamId });
      return response.data.data;
    },
  });
};

export const useReorderSuggestions = (customerId: string, limit: number = 5) => {
  return useQuery({
    queryKey: ['reorderSuggestions', customerId, limit],
    queryFn: async () => {
      const response = await client.get<{ data: OrderSuggestion[] }>(
        `/store/customer/${customerId}/suggestions?limit=${limit}`
      );
      return response.data.data;
    },
    enabled: !!customerId,
  });
};

export const useCustomerInsights = (customerId: string) => {
  return useQuery({
    queryKey: ['customerInsights', customerId],
    queryFn: async () => {
      const response = await client.get<{ data: CustomerInsights }>(
        `/store/customer/${customerId}/insights`
      );
      return response.data.data;
    },
    enabled: !!customerId,
  });
};
