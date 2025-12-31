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

// Bot Analytics Types

export interface UnansweredQuestion {
  id: string;
  text: string;
  frequency: number;
  category: string;
  lastAsked: string;
  sentiment: Sentiment;
  confidenceScore: number;
  isKnowledgeGap: boolean;
  trends: { date: string; count: number }[];
  keywords: string[];
}

export interface BotPerformanceMetrics {
  questionAnsweringRate: number;
  confidenceScoreDistribution: { range: string; count: number }[];
  topCategories: { category: string; count: number }[];
  humanTransfers: number;
  knowledgeBaseUsage: number;
  responseQuality: number;
}

export interface KnowledgeGap {
  id: string;
  topic: string;
  frequency: number;
  impactScore: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
}

export interface BotImprovementInsight {
  id: string;
  scenario: string;
  frustrationLevel: number;
  escalationRate: number;
  suggestion: string;
}

export interface BotAnalyticsData {
  unansweredQuestions: UnansweredQuestion[];
  performanceMetrics: BotPerformanceMetrics;
  knowledgeGaps: KnowledgeGap[];
  improvementInsights: BotImprovementInsight[];
  unansweredTrends: { date: string; count: number }[];
}

// Knowledge Base & Products Types

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  price?: number;
  details?: Record<string, unknown>;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFAQ {
  id: string;
  productId: string;
  question: string;
  answer: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  data: Product[];
  total: number;
  limit: number;
  offset: number;
}

// Campaign Management Types

export interface Campaign {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  type: 'inbound' | 'outbound';
  status: 'active' | 'paused' | 'completed' | 'draft';
  callLimit?: number;
  retryCount?: number;
  retryDelay?: number;
  operatingHours?: {
    startTime: string;
    endTime: string;
    timezone: string;
  };
  prompt?: string;
  knowledgeBaseId?: string;
  contactsCount?: number;
  callsMade?: number;
  successRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignContact {
  id: string;
  campaignId: string;
  name: string;
  phone: string;
  email?: string;
  status: 'pending' | 'called' | 'completed' | 'failed' | 'transferred';
  notes?: string;
  lastCalled?: string;
  callCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignAnalyticsData {
  totalContacts: number;
  callsMade: number;
  callsCompleted: number;
  successRate: number;
  averageDuration: number;
  statusBreakdown: {
    pending: number;
    called: number;
    completed: number;
    failed: number;
    transferred: number;
  };
}

export interface CampaignResponse {
  data: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

// Live Call Monitoring Types

export interface LiveCall {
  id: string;
  callId: string;
  teamId: string;
  callerId: string;
  callerName: string;
  callerPhone: string;
  agentId?: string;
  agentName?: string;
  status: 'active' | 'on-hold' | 'transferring' | 'recording';
  startTime: string;
  duration: number; // in seconds, live-updating
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  campaign?: string;
  callQuality: number; // 0-100
  talkTime?: number;
  silenceTime?: number;
  interruptions?: number;
  latency?: number;
  isRecording?: boolean;
  transcript?: TranscriptLine[];
  updatedAt: string;
}

export interface TranscriptLine {
  id: string;
  speaker: 'customer' | 'agent' | 'ai';
  text: string;
  timestamp: number;
  confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface CallMetrics {
  duration: number;
  talkTime: number;
  silenceTime: number;
  interruptions: number;
  averageLatency: number;
  packetLoss: number;
  jitter: number;
  audioQuality: number;
  networkQuality: number;
  sentiment: string;
  sentimentScore: number;
}

export interface CallQualityMetrics {
  audioQuality: number;
  networkQuality: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  bandwidth: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CallAlert {
  id: string;
  callId: string;
  type: 'sentiment_drop' | 'quality_issue' | 'long_duration' | 'escalation' | 'compliance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface LiveCallsResponse {
  data: LiveCall[];
  total: number;
  timestamp: string;
}

export interface AgentAvailability {
  agentId: string;
  agentName: string;
  status: 'available' | 'busy' | 'offline' | 'in-call';
  currentCalls: number;
  skillTags?: string[];
  queuePosition?: number;
}

export interface CallTransferRequest {
  callId: string;
  targetAgentId: string;
  note?: string;
  warmTransfer: boolean;
}

export interface InterventionRequest {
  callId: string;
  type: 'join' | 'whisper' | 'message';
  message?: string;
  duration?: number;
}

export interface Agent {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  managerId?: string;
  role: 'agent' | 'senior_agent' | 'supervisor' | 'admin';
  status: 'online' | 'offline' | 'break' | 'away' | 'busy';
  activeStatus?: string; // whether agent is actively working
  hireDate?: string;
  terminationDate?: string;
  agentType?: 'full_time' | 'part_time' | 'contract';
  skills?: AgentSkill[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkill {
  id: string;
  agentId: string;
  skillName: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  isPrimary?: boolean;
  validationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSchedule {
  id: string;
  agentId: string;
  dayOfWeek: number; // 0-6 (Sun-Sat)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  shiftType?: 'regular' | 'oncall' | 'training';
  isRecurring?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPerformanceData {
  agentId: string;
  date: string;
  totalCalls: number;
  averageHandleTime: number;
  averageAfterCallWork: number;
  customerSatisfactionScore: number;
  firstCallResolution: number;
  callQualityScore: number;
  scheduleAdherence: number;
  attendance: number;
}

export interface AgentStatusUpdate {
  agentId: string;
  status: 'online' | 'offline' | 'break' | 'away' | 'busy';
  reason?: string;
  timestamp: string;
  timeInStatus: number; // seconds
}

export interface AgentQueueItem {
  agentId: string;
  callId: string;
  customerId: string;
  customerName: string;
  skillRequired: string;
  waitTime: number; // seconds
  position: number;
}

export interface AgentActivityLogEntry {
  id: string;
  agentId: string;
  activityType: 'call' | 'status_change' | 'login' | 'logout' | 'break' | 'note';
  description: string;
  timestamp: string;
  duration?: number;
}

export interface Certification {
  id: string;
  agentId: string;
  name: string;
  issueDate: string;
  expiryDate?: string;
  documentUrl?: string;
  status: 'active' | 'expired' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface AgentsResponse {
  data: Agent[];
  total: number;
  limit: number;
  offset: number;
}
