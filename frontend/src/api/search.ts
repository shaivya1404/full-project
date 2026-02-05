import { useQuery } from '@tanstack/react-query';
import client from './client';

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  relevance: number;
  data: Record<string, any>;
  createdAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    type: Record<string, number>;
  };
  took: number;
}

export interface SearchOptions {
  query: string;
  types?: string[];
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}

// Global search
export const useSearch = (options: SearchOptions | null) => {
  return useQuery({
    queryKey: ['search', options],
    queryFn: async () => {
      if (!options || !options.query || options.query.length < 2) {
        return { results: [], total: 0, facets: { type: {} }, took: 0 } as SearchResponse;
      }

      const params = new URLSearchParams();
      params.append('q', options.query);
      if (options.types?.length) params.append('types', options.types.join(','));
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.dateFrom) params.append('dateFrom', options.dateFrom);
      if (options.dateTo) params.append('dateTo', options.dateTo);

      const response = await client.get(`/search?${params.toString()}`);
      return response.data.data as SearchResponse;
    },
    enabled: !!options?.query && options.query.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });
};

// Quick search for autocomplete
export const useQuickSearch = (query: string) => {
  return useQuery({
    queryKey: ['quickSearch', query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { results: [], total: 0, facets: { type: {} }, took: 0 } as SearchResponse;
      }

      const response = await client.get(`/search/quick?q=${encodeURIComponent(query)}`);
      return response.data.data as SearchResponse;
    },
    enabled: query.length >= 2,
    staleTime: 10000, // Cache for 10 seconds
  });
};

// Search result type icons
export const getSearchTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    call: 'phone',
    order: 'shopping-cart',
    customer: 'user',
    product: 'package',
    knowledge: 'book',
    faq: 'help-circle',
    agent: 'headphones',
    campaign: 'megaphone',
  };
  return icons[type] || 'file';
};

// Search result type colors
export const getSearchTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    call: 'bg-blue-100 text-blue-800',
    order: 'bg-green-100 text-green-800',
    customer: 'bg-purple-100 text-purple-800',
    product: 'bg-orange-100 text-orange-800',
    knowledge: 'bg-yellow-100 text-yellow-800',
    faq: 'bg-cyan-100 text-cyan-800',
    agent: 'bg-indigo-100 text-indigo-800',
    campaign: 'bg-pink-100 text-pink-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};
