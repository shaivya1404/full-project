/**
 * API Service Layer
 *
 * This module provides all API client functions for backend communication.
 * Authentication tokens are automatically attached to requests via axios interceptor.
 * Error handling is done via the response interceptor which handles 401 responses.
 */

import client from '../api/client';
import type {
  Call,
  PaginatedResponse,
  CallStats,
  Team,
  TeamMember,
  Invitation,
  AuditLog,
  UserProfile,
  ApiKey,
  Session,
  TeamSettings,
  RolePermissions,
  Role,
  MemberStatus,
  InviteStatus,
  BotAnalyticsData,
  UnansweredQuestion,
  Product,
  ProductFAQ,
  ProductsResponse,
} from '../types';

/**
 * Auth Services
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
  };
  token: string;
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await client.post<LoginResponse>('/auth/login', { email, password });
  return response.data;
};

export const logoutUser = async (): Promise<void> => {
  await client.post('/auth/logout');
};

/**
 * Call Services
 */

export const getCallHistory = async (
  page: number,
  limit: number,
  search?: string,
  filters?: { status?: string; sentiment?: string }
): Promise<PaginatedResponse<Call>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (search) params.append('search', search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sentiment) params.append('sentiment', filters.sentiment);

  const response = await client.get<PaginatedResponse<Call>>(`/calls?${params.toString()}`);
  return response.data;
};

export const getCallDetails = async (callId: string): Promise<Call> => {
  const response = await client.get<Call>(`/calls/${callId}`);
  return response.data;
};

export const getRecording = async (callId: string): Promise<Blob> => {
  const response = await client.get(`/calls/${callId}/recording`, {
    responseType: 'blob',
  });
  return response.data;
};

export const searchCalls = async (query: string): Promise<Call[]> => {
  const response = await client.get<Call[]>(`/calls/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const addNotes = async (callId: string, notes: string): Promise<{ success: boolean }> => {
  const response = await client.post(`/calls/${callId}/notes`, { notes });
  return response.data;
};

/**
 * Analytics Services
 */

export const getAnalytics = async (dateRange?: { startDate?: string; endDate?: string }): Promise<CallStats> => {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const response = await client.get<CallStats>(`/analytics/summary?${params.toString()}`);
  return response.data;
};

export const getCallStats = async (dateRange?: { startDate?: string; endDate?: string }): Promise<CallStats> => {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const response = await client.get<CallStats>(`/analytics/calls?${params.toString()}`);
  return response.data;
};

export const exportAnalyticsData = async (dateRange?: { startDate?: string; endDate?: string }): Promise<Blob> => {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const response = await client.get(`/analytics/export?${params.toString()}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Bot Analytics Services
 */

export const getBotAnalytics = async (dateRange?: { startDate?: string; endDate?: string }): Promise<BotAnalyticsData> => {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const response = await client.get<BotAnalyticsData>(`/analytics/bot?${params.toString()}`);
  return response.data;
};

export const getUnansweredQuestions = async (
  page: number,
  limit: number,
  filters?: { category?: string; sentiment?: string; startDate?: string; endDate?: string }
): Promise<PaginatedResponse<UnansweredQuestion>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters?.category) params.append('category', filters.category);
  if (filters?.sentiment) params.append('sentiment', filters.sentiment);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await client.get<PaginatedResponse<UnansweredQuestion>>(`/analytics/bot/unanswered?${params.toString()}`);
  return response.data;
};

export const exportUnansweredQuestions = async (filters?: { startDate?: string; endDate?: string }): Promise<Blob> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await client.get(`/analytics/bot/unanswered/export?${params.toString()}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Download Recording
 */

export const downloadRecordingFile = async (callId: string): Promise<void> => {
  try {
    const response = await client.get(`/calls/${callId}/recording`, {
      responseType: 'blob',
    });

    // Extract filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = `recording-${callId}.mp3`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch.length === 2) {
        filename = filenameMatch[1];
      }
    }

    // Create download link
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

/**
 * Error Handler Utility
 */

export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};

/**
 * Team Management Services
 */

export const getTeam = async (): Promise<Team> => {
  const response = await client.get<Team>('/team');
  return response.data;
};

export const updateTeamSettings = async (settings: TeamSettings): Promise<Team> => {
  const response = await client.put<Team>('/team/settings', settings);
  return response.data;
};

export const deleteTeam = async (): Promise<{ success: boolean }> => {
  const response = await client.delete<{ success: boolean }>('/team');
  return response.data;
};

/**
 * Team Members Services
 */

export const getTeamMembers = async (
  page: number,
  limit: number,
  search?: string,
  filters?: { role?: Role; status?: MemberStatus }
): Promise<PaginatedResponse<TeamMember>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (search) params.append('search', search);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.status) params.append('status', filters.status);

  const response = await client.get<PaginatedResponse<TeamMember>>(`/team/members?${params.toString()}`);
  return response.data;
};

export const addMember = async (email: string, role: Role): Promise<{ success: boolean; memberId: string }> => {
  const response = await client.post('/team/members', { email, role });
  return response.data;
};

export const bulkInviteMembers = async (emails: string[], role: Role): Promise<{ success: boolean; invited: string[]; failed: string[] }> => {
  const response = await client.post('/team/members/bulk', { emails, role });
  return response.data;
};

export const updateMemberRole = async (memberId: string, role: Role): Promise<{ success: boolean }> => {
  const response = await client.put(`/team/members/${memberId}/role`, { role });
  return response.data;
};

export const removeMember = async (memberId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/team/members/${memberId}`);
  return response.data;
};

export const resendInvite = async (email: string): Promise<{ success: boolean }> => {
  const response = await client.post('/team/members/resend', { email });
  return response.data;
};

/**
 * Invitations Services
 */

export const getInvitations = async (
  page: number,
  limit: number,
  filters?: { status?: InviteStatus }
): Promise<PaginatedResponse<Invitation>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters?.status) params.append('status', filters.status);

  const response = await client.get<PaginatedResponse<Invitation>>(`/team/invitations?${params.toString()}`);
  return response.data;
};

export const revokeInvite = async (inviteId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/team/invitations/${inviteId}`);
  return response.data;
};

/**
 * Audit Log Services
 */

export const getAuditLogs = async (
  page: number,
  limit: number,
  filters?: { actionType?: string; userId?: string; startDate?: string; endDate?: string }
): Promise<PaginatedResponse<AuditLog>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters?.actionType) params.append('actionType', filters.actionType);
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await client.get<PaginatedResponse<AuditLog>>(`/team/audit-logs?${params.toString()}`);
  return response.data;
};

export const exportAuditLogs = async (filters?: { startDate?: string; endDate?: string }): Promise<Blob> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await client.get(`/team/audit-logs/export?${params.toString()}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * User Profile Services
 */

export const getCurrentUser = async (): Promise<UserProfile> => {
  const response = await client.get<UserProfile>('/user/profile');
  return response.data;
};

export const updateProfile = async (profile: Partial<UserProfile>): Promise<UserProfile> => {
  const response = await client.put<UserProfile>('/user/profile', profile);
  return response.data;
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
  const response = await client.post('/user/change-password', { currentPassword, newPassword });
  return response.data;
};

export const uploadAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await client.post<{ avatarUrl: string }>('/user/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * API Keys Services
 */

export const getApiKeys = async (): Promise<ApiKey[]> => {
  const response = await client.get<ApiKey[]>('/user/api-keys');
  return response.data;
};

export const createApiKey = async (name: string, scopes: string[]): Promise<ApiKey> => {
  const response = await client.post<ApiKey>('/user/api-keys', { name, scopes });
  return response.data;
};

export const deleteApiKey = async (keyId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/user/api-keys/${keyId}`);
  return response.data;
};

/**
 * Session Management Services
 */

export const getSessions = async (): Promise<Session[]> => {
  const response = await client.get<Session[]>('/user/sessions');
  return response.data;
};

export const revokeSession = async (sessionId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/user/sessions/${sessionId}`);
  return response.data;
};

export const revokeAllOtherSessions = async (): Promise<{ success: boolean }> => {
  const response = await client.post('/user/sessions/revoke-others');
  return response.data;
};

/**
 * Role & Permissions Services
 */

export const getRolePermissions = async (): Promise<RolePermissions[]> => {
  const response = await client.get<RolePermissions[]>('/team/roles/permissions');
  return response.data;
};

/**
 * Team API Keys for Integrations
 */

export const getTeamApiKeys = async (): Promise<ApiKey[]> => {
  const response = await client.get<ApiKey[]>('/team/api-keys');
  return response.data;
};

export const createTeamApiKey = async (name: string, scopes: string[]): Promise<ApiKey> => {
  const response = await client.post<ApiKey>('/team/api-keys', { name, scopes });
  return response.data;
};

export const deleteTeamApiKey = async (keyId: string): Promise<{ success: boolean }> => {
  const response = await client.delete(`/team/api-keys/${keyId}`);
  return response.data;
};

/**
 * Knowledge Base & Products Services
 */

export const getProducts = async (
  teamId: string,
  limit: number,
  offset: number,
  search?: string
): Promise<ProductsResponse> => {
  const params = new URLSearchParams();
  params.append('teamId', teamId);
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (search) params.append('search', search);

  const response = await client.get<ProductsResponse>(`/products?${params.toString()}`);
  return response.data;
};

export const getProduct = async (id: string): Promise<Product & { faqs?: ProductFAQ[] }> => {
  const response = await client.get<Product & { faqs?: ProductFAQ[] }>(`/products/${id}`);
  return response.data;
};

export const createProduct = async (
  teamId: string,
  data: {
    name: string;
    description?: string;
    category: string;
    price?: number;
    details?: Record<string, unknown>;
  }
): Promise<Product> => {
  const response = await client.post<Product>('/products', { teamId, ...data });
  return response.data;
};

export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    details?: Record<string, unknown>;
  }
): Promise<Product> => {
  const response = await client.put<Product>(`/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<{ success: boolean }> => {
  const response = await client.delete<{ success: boolean }>(`/products/${id}`);
  return response.data;
};

export const searchProducts = async (teamId: string, query: string): Promise<Product[]> => {
  const response = await client.get<Product[]>(`/products/search?teamId=${teamId}&q=${encodeURIComponent(query)}`);
  return response.data;
};

export const getProductFAQs = async (productId: string): Promise<ProductFAQ[]> => {
  const response = await client.get<ProductFAQ[]>(`/products/${productId}/faqs`);
  return response.data;
};

export const createProductFAQ = async (
  productId: string,
  data: { question: string; answer: string; category?: string }
): Promise<ProductFAQ> => {
  const response = await client.post<ProductFAQ>(`/products/${productId}/faqs`, data);
  return response.data;
};

export const updateProductFAQ = async (
  id: string,
  data: { question?: string; answer?: string; category?: string }
): Promise<ProductFAQ> => {
  const response = await client.put<ProductFAQ>(`/products/faqs/${id}`, data);
  return response.data;
};

export const deleteProductFAQ = async (id: string): Promise<{ success: boolean }> => {
  const response = await client.delete<{ success: boolean }>(`/products/faqs/${id}`);
  return response.data;
};

export const importProductsCSV = async (teamId: string, file: File): Promise<{ success: boolean; imported: number; failed: number }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('teamId', teamId);

  const response = await client.post<{ success: boolean; imported: number; failed: number }>('/products/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
