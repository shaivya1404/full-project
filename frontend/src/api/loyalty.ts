import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface LoyaltyProgram {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  isActive: boolean;
  pointsPerRupee: number;
  minimumOrderAmount: number;
  pointsExpireDays?: number;
  referralPoints: number;
  refereePoints: number;
  createdAt: string;
  updatedAt: string;
  tiers: LoyaltyTier[];
  rewards: Reward[];
}

export interface LoyaltyTier {
  id: string;
  programId: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  multiplier: number;
  benefits?: string;
  color?: string;
  icon?: string;
  tierOrder: number;
}

export interface TierBenefits {
  freeDelivery?: boolean;
  prioritySupport?: boolean;
  exclusiveOffers?: boolean;
  birthdayBonus?: number;
  bonusPointsPercent?: number;
  earlyAccess?: boolean;
}

export interface Reward {
  id: string;
  programId: string;
  name: string;
  description?: string;
  type: 'discount_percent' | 'discount_flat' | 'free_item' | 'free_delivery' | 'bonus_points';
  value: number;
  pointsCost: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  productId?: string;
  validDays: number;
  maxRedemptions?: number;
  currentRedemptions: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CustomerLoyaltySummary {
  currentPoints: number;
  totalEarned: number;
  totalRedeemed: number;
  lifetimeValue: number;
  tier: {
    name: string;
    color?: string;
    benefits?: TierBenefits;
    nextTier?: {
      name: string;
      pointsNeeded: number;
    };
  } | null;
  availableRewards: number;
  referralCode: string;
  referralCount: number;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'earn' | 'redeem' | 'expire' | 'adjust' | 'referral_bonus';
  points: number;
  balanceAfter: number;
  description?: string;
  orderId?: string;
  order?: { orderNumber: string };
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  pointsSpent: number;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  code: string;
  expiresAt: string;
  reward: Reward;
}

export interface ProgramAnalytics {
  totalMembers: number;
  totalPointsInCirculation: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalLifetimeValue: number;
  transactionsByType: Record<string, { count: number; points: number }>;
  redemptionsByStatus: Record<string, number>;
  tierDistribution: { tierId: string; count: number }[];
}

// Input types
export interface CreateTierInput {
  programId: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  multiplier?: number;
  benefits?: TierBenefits;
  color?: string;
  icon?: string;
  tierOrder?: number;
}

export interface CreateRewardInput {
  name: string;
  description?: string;
  type: string;
  value: number;
  pointsCost: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  productId?: string;
  validDays?: number;
  maxRedemptions?: number;
  startDate?: string;
  endDate?: string;
}

// API functions
const loyaltyApi = {
  // Program
  getProgram: async (): Promise<LoyaltyProgram> => {
    const response = await apiClient.get('/loyalty/program');
    return response.data.data;
  },

  updateProgram: async (data: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> => {
    const response = await apiClient.put('/loyalty/program', data);
    return response.data.data;
  },

  getProgramAnalytics: async (): Promise<ProgramAnalytics> => {
    const response = await apiClient.get('/loyalty/program/analytics');
    return response.data.data;
  },

  // Tiers
  createTier: async (data: CreateTierInput): Promise<LoyaltyTier> => {
    const response = await apiClient.post('/loyalty/tiers', data);
    return response.data.data;
  },

  updateTier: async (id: string, data: Partial<CreateTierInput>): Promise<LoyaltyTier> => {
    const response = await apiClient.put(`/loyalty/tiers/${id}`, data);
    return response.data.data;
  },

  deleteTier: async (id: string): Promise<void> => {
    await apiClient.delete(`/loyalty/tiers/${id}`);
  },

  // Rewards
  listRewards: async (activeOnly = true): Promise<Reward[]> => {
    const response = await apiClient.get(`/loyalty/rewards?activeOnly=${activeOnly}`);
    return response.data.data;
  },

  createReward: async (data: CreateRewardInput): Promise<Reward> => {
    const response = await apiClient.post('/loyalty/rewards', data);
    return response.data.data;
  },

  updateReward: async (id: string, data: Partial<CreateRewardInput>): Promise<Reward> => {
    const response = await apiClient.put(`/loyalty/rewards/${id}`, data);
    return response.data.data;
  },

  deleteReward: async (id: string): Promise<void> => {
    await apiClient.delete(`/loyalty/rewards/${id}`);
  },

  // Customer loyalty
  getCustomerSummary: async (customerId: string): Promise<CustomerLoyaltySummary> => {
    const response = await apiClient.get(`/loyalty/customers/${customerId}`);
    return response.data.data;
  },

  getCustomerTransactions: async (
    customerId: string,
    limit = 20,
    offset = 0
  ): Promise<{ transactions: LoyaltyTransaction[]; total: number }> => {
    const response = await apiClient.get(
      `/loyalty/customers/${customerId}/transactions?limit=${limit}&offset=${offset}`
    );
    return { transactions: response.data.data, total: response.data.total };
  },

  getAvailableRewards: async (customerId: string): Promise<Reward[]> => {
    const response = await apiClient.get(`/loyalty/customers/${customerId}/rewards`);
    return response.data.data;
  },

  earnPoints: async (customerId: string, orderId: string, orderAmount: number) => {
    const response = await apiClient.post(`/loyalty/customers/${customerId}/earn`, {
      orderId,
      orderAmount,
    });
    return response.data.data;
  },

  redeemReward: async (customerId: string, rewardId: string): Promise<RewardRedemption> => {
    const response = await apiClient.post(`/loyalty/customers/${customerId}/redeem`, {
      rewardId,
    });
    return response.data.data;
  },

  awardBonus: async (
    customerId: string,
    points: number,
    type: string,
    description?: string
  ) => {
    const response = await apiClient.post(`/loyalty/customers/${customerId}/bonus`, {
      points,
      type,
      description,
    });
    return response.data.data;
  },

  // Redemptions
  applyRedemption: async (code: string, orderId: string) => {
    const response = await apiClient.post('/loyalty/redemptions/apply', { code, orderId });
    return response.data.data;
  },

  // Referrals
  processReferral: async (newCustomerId: string, referralCode: string) => {
    const response = await apiClient.post('/loyalty/referrals/process', {
      newCustomerId,
      referralCode,
    });
    return response.data.data;
  },
};

// Hooks

export function useLoyaltyProgram() {
  return useQuery({
    queryKey: ['loyalty-program'],
    queryFn: loyaltyApi.getProgram,
  });
}

export function useUpdateLoyaltyProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loyaltyApi.updateProgram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useProgramAnalytics() {
  return useQuery({
    queryKey: ['loyalty-analytics'],
    queryFn: loyaltyApi.getProgramAnalytics,
  });
}

export function useCreateTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loyaltyApi.createTier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useUpdateTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTierInput> }) =>
      loyaltyApi.updateTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useDeleteTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loyaltyApi.deleteTier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useRewards(activeOnly = true) {
  return useQuery({
    queryKey: ['loyalty-rewards', activeOnly],
    queryFn: () => loyaltyApi.listRewards(activeOnly),
  });
}

export function useCreateReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loyaltyApi.createReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useUpdateReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRewardInput> }) =>
      loyaltyApi.updateReward(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useDeleteReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loyaltyApi.deleteReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
    },
  });
}

export function useCustomerLoyalty(customerId: string) {
  return useQuery({
    queryKey: ['customer-loyalty', customerId],
    queryFn: () => loyaltyApi.getCustomerSummary(customerId),
    enabled: !!customerId,
  });
}

export function useCustomerTransactions(customerId: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['customer-transactions', customerId, limit, offset],
    queryFn: () => loyaltyApi.getCustomerTransactions(customerId, limit, offset),
    enabled: !!customerId,
  });
}

export function useAvailableRewards(customerId: string) {
  return useQuery({
    queryKey: ['available-rewards', customerId],
    queryFn: () => loyaltyApi.getAvailableRewards(customerId),
    enabled: !!customerId,
  });
}

export function useEarnPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      orderId,
      orderAmount,
    }: {
      customerId: string;
      orderId: string;
      orderAmount: number;
    }) => loyaltyApi.earnPoints(customerId, orderId, orderAmount),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', variables.customerId] });
    },
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, rewardId }: { customerId: string; rewardId: string }) =>
      loyaltyApi.redeemReward(customerId, rewardId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['available-rewards', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', variables.customerId] });
    },
  });
}

export function useAwardBonus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      points,
      type,
      description,
    }: {
      customerId: string;
      points: number;
      type: string;
      description?: string;
    }) => loyaltyApi.awardBonus(customerId, points, type, description),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', variables.customerId] });
    },
  });
}

export function useApplyRedemption() {
  return useMutation({
    mutationFn: ({ code, orderId }: { code: string; orderId: string }) =>
      loyaltyApi.applyRedemption(code, orderId),
  });
}

export function useProcessReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ newCustomerId, referralCode }: { newCustomerId: string; referralCode: string }) =>
      loyaltyApi.processReferral(newCustomerId, referralCode),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', variables.newCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-analytics'] });
    },
  });
}

// Reward type options
export const REWARD_TYPES = [
  { value: 'discount_percent', label: 'Percentage Discount', example: '10% off' },
  { value: 'discount_flat', label: 'Flat Discount', example: 'Rs 50 off' },
  { value: 'free_item', label: 'Free Item', example: 'Free dessert' },
  { value: 'free_delivery', label: 'Free Delivery', example: 'Free delivery' },
  { value: 'bonus_points', label: 'Bonus Points', example: '2x points' },
];

// Tier color presets
export const TIER_COLORS = [
  { name: 'Bronze', color: '#CD7F32' },
  { name: 'Silver', color: '#C0C0C0' },
  { name: 'Gold', color: '#FFD700' },
  { name: 'Platinum', color: '#E5E4E2' },
  { name: 'Diamond', color: '#B9F2FF' },
];

export default loyaltyApi;
