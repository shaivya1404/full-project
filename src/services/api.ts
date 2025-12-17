/**
 * API Service Layer
 * 
 * This module provides all API client functions for backend communication.
 * Authentication tokens are automatically attached to requests via axios interceptor.
 * Error handling is done via the response interceptor which handles 401 responses.
 */

import client from '../api/client';
import type { Call, PaginatedResponse, CallStats } from '../types';

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

export const getAnalytics = async (): Promise<CallStats> => {
  const response = await client.get<CallStats>('/analytics/summary');
  return response.data;
};

export const getCallStats = async (): Promise<CallStats> => {
  const response = await client.get<CallStats>('/analytics/calls');
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
