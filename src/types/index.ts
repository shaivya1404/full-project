export type CallStatus = 'active' | 'completed' | 'missed' | 'failed' | 'in-progress';
export type Sentiment = 'positive' | 'neutral' | 'negative';

// Team & User Management Types

export type Role = 'admin' | 'manager' | 'agent' | 'viewer';
export type MemberStatus = 'active' | 'pending' | 'inactive';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  avatarUrl?: string;
  lastActive?: string;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actionType: 'member_added' | 'member_removed' | 'role_changed' | 'settings_updated' | 'team_deleted' | 'invite_sent' | 'invite_revoked';
  actor: {
    id: string;
    name: string;
    email: string;
  };
  target?: string;
  details: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  createdAt: string;
}

export interface UserProfile extends User {
  phone?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  scopes: string[];
}

export interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  createdAt: string;
  lastActive: string;
  current: boolean;
}

export interface TeamSettings {
  name: string;
  description?: string;
  avatarUrl?: string;
  notifications: {
    email: boolean;
    inApp: boolean;
    memberAdded: boolean;
    memberRemoved: boolean;
  };
}

export interface Permission {
  key: string;
  label: string;
  description: string;
}

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
}

// Call Types

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
  // Extended analytics data
  statusBreakdown: { status: CallStatus; count: number; percentage: number }[];
  durationDistribution: { range: string; count: number; percentage: number }[];
  statusTrends: { date: string; status: CallStatus; count: number }[];
  sentimentBreakdown: { sentiment: Sentiment; count: number; percentage: number }[];
  sentimentTrends: { date: string; sentiment: Sentiment; count: number; score: number }[];
  peakHours: { hour: number; count: number; day: string }[];
  dayOfWeekBreakdown: { day: string; count: number }[];
  agentPerformance?: AgentPerformance[];
  callQualityMetrics: CallQualityMetrics;
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  callsHandled: number;
  avgDuration: number;
  completionRate: number;
  avgSentimentScore: number;
}

export interface CallQualityMetrics {
  avgTalkTime: number;
  interruptionRate: number;
  avgLatency: number;
  dropoutRate: number;
  connectionQuality: number; // 0-100
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset?: DateRangePreset;
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
