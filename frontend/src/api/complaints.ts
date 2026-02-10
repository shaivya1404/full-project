import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface Complaint {
  id: string;
  teamId: string;
  ticketNumber: string;
  customerId?: string;
  orderId?: string;
  callId?: string;
  category: string;
  subcategory?: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  assignedTo?: string;
  assignedAt?: string;
  resolution?: string;
  resolutionType?: string;
  compensationAmount?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  customerSatisfied?: boolean;
  feedbackScore?: number;
  feedbackComment?: string;
  slaDeadline?: string;
  slaBreach: boolean;
  firstResponseAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name?: string; phone?: string };
  order?: { id: string; orderNumber: string; status: string };
  call?: { id: string; caller: string };
  comments?: ComplaintComment[];
  history?: ComplaintHistory[];
  attachments?: ComplaintAttachment[];
  _count?: { comments: number };
}

export interface ComplaintComment {
  id: string;
  complaintId: string;
  authorId?: string;
  authorName: string;
  authorType: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ComplaintHistory {
  id: string;
  complaintId: string;
  action: string;
  fromValue?: string;
  toValue?: string;
  performedBy?: string;
  performedByName?: string;
  note?: string;
  createdAt: string;
}

export interface ComplaintAttachment {
  id: string;
  complaintId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy?: string;
  createdAt: string;
}

export interface ComplaintCategory {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  subcategories?: string;
  defaultPriority: string;
  slaHours: number;
  isActive: boolean;
}

export interface ComplaintStats {
  total: number;
  open: number;
  inProgress: number;
  pendingCustomer: number;
  resolved: number;
  closed: number;
  slaBreached: number;
  avgResolutionHours: number;
  satisfactionScore: number;
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

export interface CreateComplaintInput {
  teamId: string;
  customerId?: string;
  orderId?: string;
  callId?: string;
  category: string;
  subcategory?: string;
  priority?: string;
  subject: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface UpdateComplaintInput {
  category?: string;
  subcategory?: string;
  priority?: string;
  status?: string;
  subject?: string;
  description?: string;
  assignedTo?: string;
  resolution?: string;
  resolutionType?: string;
  compensationAmount?: number;
}

export interface ComplaintFilter {
  teamId: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  slaBreach?: boolean;
  limit?: number;
  offset?: number;
}

// API functions
const complaintsApi = {
  createComplaint: async (data: CreateComplaintInput): Promise<Complaint> => {
    const response = await apiClient.post('/complaints', data);
    return response.data.data;
  },

  listComplaints: async (filter: ComplaintFilter): Promise<{ complaints: Complaint[]; total: number }> => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const response = await apiClient.get(`/complaints?${params.toString()}`);
    return { complaints: response.data.data, total: response.data.total };
  },

  getComplaint: async (id: string): Promise<Complaint> => {
    const response = await apiClient.get(`/complaints/${id}`);
    return response.data.data;
  },

  getByTicketNumber: async (ticketNumber: string): Promise<Complaint> => {
    const response = await apiClient.get(`/complaints/ticket/${ticketNumber}`);
    return response.data.data;
  },

  updateComplaint: async (id: string, data: UpdateComplaintInput): Promise<Complaint> => {
    const response = await apiClient.put(`/complaints/${id}`, data);
    return response.data.data;
  },

  assignComplaint: async (id: string, agentId: string, agentName?: string): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/assign`, { agentId, agentName });
    return response.data.data;
  },

  resolveComplaint: async (
    id: string,
    resolution: string,
    resolutionType: string,
    compensationAmount?: number
  ): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/resolve`, {
      resolution,
      resolutionType,
      compensationAmount,
    });
    return response.data.data;
  },

  closeComplaint: async (id: string): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/close`);
    return response.data.data;
  },

  reopenComplaint: async (id: string, reason: string): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/reopen`, { reason });
    return response.data.data;
  },

  addComment: async (id: string, content: string, isInternal?: boolean): Promise<ComplaintComment> => {
    const response = await apiClient.post(`/complaints/${id}/comments`, { content, isInternal });
    return response.data.data;
  },

  getComments: async (id: string, includeInternal?: boolean): Promise<ComplaintComment[]> => {
    const params = includeInternal === false ? '?includeInternal=false' : '';
    const response = await apiClient.get(`/complaints/${id}/comments${params}`);
    return response.data.data;
  },

  recordFeedback: async (
    id: string,
    satisfied: boolean,
    score: number,
    comment?: string
  ): Promise<Complaint> => {
    const response = await apiClient.post(`/complaints/${id}/feedback`, { satisfied, score, comment });
    return response.data.data;
  },

  checkSlaBreaches: async (teamId: string): Promise<{ breachedCount: number }> => {
    const response = await apiClient.post('/complaints/sla/check', { teamId });
    return response.data.data;
  },

  getSlaBreachedComplaints: async (teamId: string): Promise<Complaint[]> => {
    const response = await apiClient.get(`/complaints/sla/breached?teamId=${teamId}`);
    return response.data.data;
  },

  getCategories: async (teamId: string): Promise<ComplaintCategory[]> => {
    const response = await apiClient.get(`/complaints/categories/list?teamId=${teamId}`);
    return response.data.data;
  },

  createCategory: async (data: {
    teamId: string;
    name: string;
    description?: string;
    subcategories?: string[];
    defaultPriority?: string;
    slaHours?: number;
  }): Promise<ComplaintCategory> => {
    const response = await apiClient.post('/complaints/categories', data);
    return response.data.data;
  },

  updateCategory: async (id: string, data: Partial<ComplaintCategory>): Promise<ComplaintCategory> => {
    const response = await apiClient.put(`/complaints/categories/${id}`, data);
    return response.data.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/complaints/categories/${id}`);
  },

  getStats: async (teamId: string, dateFrom?: string, dateTo?: string): Promise<ComplaintStats> => {
    const params = new URLSearchParams({ teamId });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const response = await apiClient.get(`/complaints/stats/overview?${params.toString()}`);
    return response.data.data;
  },
};

// Hooks

export function useComplaints(filter: ComplaintFilter) {
  return useQuery({
    queryKey: ['complaints', filter],
    queryFn: () => complaintsApi.listComplaints(filter),
    enabled: !!filter.teamId,
  });
}

export function useComplaint(id: string) {
  return useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getComplaint(id),
    enabled: !!id,
  });
}

export function useComplaintByTicket(ticketNumber: string) {
  return useQuery({
    queryKey: ['complaint-ticket', ticketNumber],
    queryFn: () => complaintsApi.getByTicketNumber(ticketNumber),
    enabled: !!ticketNumber,
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: complaintsApi.createComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useUpdateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateComplaintInput }) =>
      complaintsApi.updateComplaint(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useAssignComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, agentId, agentName }: { id: string; agentId: string; agentName?: string }) =>
      complaintsApi.assignComplaint(id, agentId, agentName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
    },
  });
}

export function useResolveComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      resolution,
      resolutionType,
      compensationAmount,
    }: {
      id: string;
      resolution: string;
      resolutionType: string;
      compensationAmount?: number;
    }) => complaintsApi.resolveComplaint(id, resolution, resolutionType, compensationAmount),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useCloseComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: complaintsApi.closeComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useReopenComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      complaintsApi.reopenComplaint(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content, isInternal }: { id: string; content: string; isInternal?: boolean }) =>
      complaintsApi.addComment(id, content, isInternal),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-comments', variables.id] });
    },
  });
}

export function useComplaintComments(id: string, includeInternal = true) {
  return useQuery({
    queryKey: ['complaint-comments', id, includeInternal],
    queryFn: () => complaintsApi.getComments(id, includeInternal),
    enabled: !!id,
  });
}

export function useRecordFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      satisfied,
      score,
      comment,
    }: {
      id: string;
      satisfied: boolean;
      score: number;
      comment?: string;
    }) => complaintsApi.recordFeedback(id, satisfied, score, comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
    },
  });
}

export function useCheckSlaBreaches() {
  return useMutation({
    mutationFn: complaintsApi.checkSlaBreaches,
  });
}

export function useSlaBreachedComplaints(teamId: string) {
  return useQuery({
    queryKey: ['sla-breached', teamId],
    queryFn: () => complaintsApi.getSlaBreachedComplaints(teamId),
    enabled: !!teamId,
  });
}

export function useComplaintCategories(teamId: string) {
  return useQuery({
    queryKey: ['complaint-categories', teamId],
    queryFn: () => complaintsApi.getCategories(teamId),
    enabled: !!teamId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: complaintsApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComplaintCategory> }) =>
      complaintsApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: complaintsApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-categories'] });
    },
  });
}

export function useComplaintStats(teamId: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['complaint-stats', teamId, dateFrom, dateTo],
    queryFn: () => complaintsApi.getStats(teamId, dateFrom, dateTo),
    enabled: !!teamId,
  });
}

// Constants
export const COMPLAINT_STATUSES = [
  { value: 'open', label: 'Open', color: 'red' },
  { value: 'in_progress', label: 'In Progress', color: 'yellow' },
  { value: 'pending_customer', label: 'Pending Customer', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
  { value: 'closed', label: 'Closed', color: 'gray' },
];

export const COMPLAINT_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'critical', label: 'Critical', color: 'red' },
];

export const RESOLUTION_TYPES = [
  { value: 'refund', label: 'Refund' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'apology', label: 'Apology' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'other', label: 'Other' },
];

export const DEFAULT_CATEGORIES = [
  'product_quality',
  'delivery',
  'service',
  'billing',
  'other',
];

export default complaintsApi;
