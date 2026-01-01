import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '../types';
import { getBotAnalytics, getUnansweredQuestions } from '../services/api';

export const useBotAnalytics = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['botAnalytics', dateRange],
    queryFn: () => getBotAnalytics(dateRange),
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
};

export const useUnansweredQuestions = (
  page: number,
  limit: number,
  filters?: { category?: string; sentiment?: string; startDate?: string; endDate?: string }
) => {
  return useQuery({
    queryKey: ['unansweredQuestions', page, limit, filters],
    queryFn: () => getUnansweredQuestions(page, limit, filters),
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
};
