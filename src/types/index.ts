export type CallStatus = 'active' | 'completed' | 'missed';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Call {
  id: string;
  caller: string;
  agent: string;
  duration: number; // seconds
  startTime: string; // ISO date
  status: CallStatus;
  sentiment: Sentiment;
  transcript?: string;
  recordingUrl?: string;
  notes?: string;
}

export interface CallStats {
  totalCalls: number;
  avgDuration: number;
  sentimentScore: number; // 0-100
  activeCalls: number;
  callVolumeHistory: { date: string; count: number }[];
}

export interface CallFilter {
  search?: string;
  status?: CallStatus;
  sentiment?: Sentiment;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
