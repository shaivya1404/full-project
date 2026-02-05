import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
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
  dateFrom?: Date;
  dateTo?: Date;
  slaBreach?: boolean;
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

/**
 * Complaint Management Service
 */
export class ComplaintService {
  private ticketCounter = 0;

  /**
   * Generate a unique ticket number
   */
  private async generateTicketNumber(teamId: string): Promise<string> {
    const count = await prisma.complaint.count({ where: { teamId } });
    const num = count + 1;
    return `TKT-${num.toString().padStart(5, '0')}`;
  }

  /**
   * Get SLA hours for a category
   */
  private async getSlaHours(teamId: string, category: string, priority: string): Promise<number> {
    const cat = await prisma.complaintCategory.findFirst({
      where: { teamId, name: category, isActive: true },
    });

    let baseHours = cat?.slaHours || 24;

    // Adjust SLA based on priority
    switch (priority) {
      case 'critical': return Math.floor(baseHours * 0.25);
      case 'high': return Math.floor(baseHours * 0.5);
      case 'medium': return baseHours;
      case 'low': return baseHours * 2;
      default: return baseHours;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLAINT CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new complaint
   */
  async createComplaint(input: CreateComplaintInput) {
    const ticketNumber = await this.generateTicketNumber(input.teamId);
    const priority = input.priority || 'medium';
    const slaHours = await this.getSlaHours(input.teamId, input.category, priority);
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const complaint = await prisma.complaint.create({
      data: {
        teamId: input.teamId,
        ticketNumber,
        customerId: input.customerId,
        orderId: input.orderId,
        callId: input.callId,
        category: input.category,
        subcategory: input.subcategory,
        priority,
        status: 'open',
        subject: input.subject,
        description: input.description,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        slaDeadline,
      },
      include: {
        customer: true,
        order: true,
        comments: true,
      },
    });

    // Create initial history entry
    await prisma.complaintHistory.create({
      data: {
        complaintId: complaint.id,
        action: 'created',
        toValue: 'open',
        note: `Complaint created: ${input.subject}`,
      },
    });

    logger.info(`Complaint ${ticketNumber} created for team ${input.teamId}`);
    return complaint;
  }

  /**
   * Get a complaint by ID
   */
  async getComplaint(id: string) {
    return prisma.complaint.findUnique({
      where: { id },
      include: {
        customer: true,
        order: { include: { items: true } },
        call: true,
        comments: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' } },
        attachments: true,
      },
    });
  }

  /**
   * Get complaint by ticket number
   */
  async getByTicketNumber(ticketNumber: string) {
    return prisma.complaint.findUnique({
      where: { ticketNumber },
      include: {
        customer: true,
        order: true,
        comments: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * List complaints with filters
   */
  async listComplaints(filter: ComplaintFilter, limit = 50, offset = 0) {
    const where: any = { teamId: filter.teamId };

    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.category) where.category = filter.category;
    if (filter.assignedTo) where.assignedTo = filter.assignedTo;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.slaBreach) where.slaBreach = true;

    if (filter.search) {
      where.OR = [
        { ticketNumber: { contains: filter.search } },
        { subject: { contains: filter.search } },
        { description: { contains: filter.search } },
        { customerName: { contains: filter.search } },
        { customerPhone: { contains: filter.search } },
      ];
    }

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
      if (filter.dateTo) where.createdAt.lte = filter.dateTo;
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.complaint.count({ where }),
    ]);

    return { complaints, total };
  }

  /**
   * Update a complaint
   */
  async updateComplaint(id: string, input: UpdateComplaintInput, performedBy?: string, performedByName?: string) {
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new Error('Complaint not found');

    const historyEntries: any[] = [];

    // Track status changes
    if (input.status && input.status !== existing.status) {
      historyEntries.push({
        complaintId: id,
        action: 'status_change',
        fromValue: existing.status,
        toValue: input.status,
        performedBy,
        performedByName,
      });
    }

    // Track priority changes
    if (input.priority && input.priority !== existing.priority) {
      historyEntries.push({
        complaintId: id,
        action: 'priority_change',
        fromValue: existing.priority,
        toValue: input.priority,
        performedBy,
        performedByName,
      });
    }

    // Track assignment changes
    if (input.assignedTo && input.assignedTo !== existing.assignedTo) {
      historyEntries.push({
        complaintId: id,
        action: 'assignment',
        fromValue: existing.assignedTo || 'unassigned',
        toValue: input.assignedTo,
        performedBy,
        performedByName,
      });
    }

    const updateData: any = { ...input };

    // Set timestamps based on status
    if (input.status === 'in_progress' && !existing.firstResponseAt) {
      updateData.firstResponseAt = new Date();
    }
    if (input.status === 'resolved' && !existing.resolvedAt) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = performedBy;
    }
    if (input.status === 'closed' && !existing.closedAt) {
      updateData.closedAt = new Date();
    }
    if (input.assignedTo && !existing.assignedAt) {
      updateData.assignedAt = new Date();
    }

    const [complaint] = await Promise.all([
      prisma.complaint.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          order: true,
          comments: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
      ...(historyEntries.length > 0
        ? [prisma.complaintHistory.createMany({ data: historyEntries })]
        : []),
    ]);

    return complaint;
  }

  /**
   * Assign a complaint to an agent
   */
  async assignComplaint(id: string, agentId: string, agentName: string, performedBy?: string) {
    return this.updateComplaint(
      id,
      { assignedTo: agentId, status: 'in_progress' },
      performedBy,
      agentName
    );
  }

  /**
   * Resolve a complaint
   */
  async resolveComplaint(
    id: string,
    resolution: string,
    resolutionType: string,
    performedBy: string,
    performedByName: string,
    compensationAmount?: number
  ) {
    return this.updateComplaint(
      id,
      {
        status: 'resolved',
        resolution,
        resolutionType,
        compensationAmount,
      },
      performedBy,
      performedByName
    );
  }

  /**
   * Close a complaint
   */
  async closeComplaint(id: string, performedBy?: string, performedByName?: string) {
    return this.updateComplaint(id, { status: 'closed' }, performedBy, performedByName);
  }

  /**
   * Reopen a complaint
   */
  async reopenComplaint(id: string, reason: string, performedBy?: string, performedByName?: string) {
    const complaint = await this.updateComplaint(
      id,
      { status: 'open' },
      performedBy,
      performedByName
    );

    await prisma.complaintHistory.create({
      data: {
        complaintId: id,
        action: 'reopened',
        note: reason,
        performedBy,
        performedByName,
      },
    });

    return complaint;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a comment to a complaint
   */
  async addComment(
    complaintId: string,
    authorId: string | null,
    authorName: string,
    authorType: string,
    content: string,
    isInternal = false
  ) {
    const comment = await prisma.complaintComment.create({
      data: {
        complaintId,
        authorId,
        authorName,
        authorType,
        content,
        isInternal,
      },
    });

    // Update first response time if this is the first agent comment
    if (authorType === 'agent') {
      const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
      });
      if (complaint && !complaint.firstResponseAt) {
        await prisma.complaint.update({
          where: { id: complaintId },
          data: { firstResponseAt: new Date() },
        });
      }
    }

    return comment;
  }

  /**
   * Get comments for a complaint
   */
  async getComments(complaintId: string, includeInternal = true) {
    const where: any = { complaintId };
    if (!includeInternal) where.isInternal = false;

    return prisma.complaintComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record customer feedback on resolution
   */
  async recordFeedback(id: string, satisfied: boolean, score: number, comment?: string) {
    return prisma.complaint.update({
      where: { id },
      data: {
        customerSatisfied: satisfied,
        feedbackScore: score,
        feedbackComment: comment,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check and update SLA breaches
   */
  async checkSlaBreaches(teamId: string) {
    const now = new Date();

    const breached = await prisma.complaint.updateMany({
      where: {
        teamId,
        status: { in: ['open', 'in_progress', 'pending_customer'] },
        slaBreach: false,
        slaDeadline: { lt: now },
      },
      data: { slaBreach: true },
    });

    if (breached.count > 0) {
      logger.warn(`${breached.count} complaints breached SLA for team ${teamId}`);
    }

    return breached.count;
  }

  /**
   * Get SLA-breached complaints
   */
  async getSlaBreachedComplaints(teamId: string) {
    return prisma.complaint.findMany({
      where: {
        teamId,
        slaBreach: true,
        status: { in: ['open', 'in_progress', 'pending_customer'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { slaDeadline: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get complaint categories for a team
   */
  async getCategories(teamId: string) {
    return prisma.complaintCategory.findMany({
      where: { teamId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a complaint category
   */
  async createCategory(teamId: string, data: {
    name: string;
    description?: string;
    subcategories?: string[];
    defaultPriority?: string;
    slaHours?: number;
  }) {
    return prisma.complaintCategory.create({
      data: {
        teamId,
        name: data.name,
        description: data.description,
        subcategories: data.subcategories ? JSON.stringify(data.subcategories) : null,
        defaultPriority: data.defaultPriority || 'medium',
        slaHours: data.slaHours || 24,
      },
    });
  }

  /**
   * Update a complaint category
   */
  async updateCategory(id: string, data: {
    name?: string;
    description?: string;
    subcategories?: string[];
    defaultPriority?: string;
    slaHours?: number;
    isActive?: boolean;
  }) {
    const updateData: any = { ...data };
    if (data.subcategories) {
      updateData.subcategories = JSON.stringify(data.subcategories);
    }
    return prisma.complaintCategory.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a complaint category
   */
  async deleteCategory(id: string) {
    return prisma.complaintCategory.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get complaint statistics
   */
  async getStats(teamId: string, dateFrom?: Date, dateTo?: Date): Promise<ComplaintStats> {
    const where: any = { teamId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [
      total,
      open,
      inProgress,
      pendingCustomer,
      resolved,
      closed,
      slaBreached,
      resolvedComplaints,
      feedbackComplaints,
      allComplaints,
    ] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.count({ where: { ...where, status: 'open' } }),
      prisma.complaint.count({ where: { ...where, status: 'in_progress' } }),
      prisma.complaint.count({ where: { ...where, status: 'pending_customer' } }),
      prisma.complaint.count({ where: { ...where, status: 'resolved' } }),
      prisma.complaint.count({ where: { ...where, status: 'closed' } }),
      prisma.complaint.count({ where: { ...where, slaBreach: true } }),
      prisma.complaint.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.complaint.findMany({
        where: { ...where, feedbackScore: { not: null } },
        select: { feedbackScore: true },
      }),
      prisma.complaint.findMany({
        where,
        select: { category: true, priority: true },
      }),
    ]);

    // Calculate average resolution time
    let avgResolutionHours = 0;
    if (resolvedComplaints.length > 0) {
      const totalHours = resolvedComplaints.reduce((sum: number, c: any) => {
        const diff = c.resolvedAt!.getTime() - c.createdAt.getTime();
        return sum + diff / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedComplaints.length);
    }

    // Calculate satisfaction score
    let satisfactionScore = 0;
    if (feedbackComplaints.length > 0) {
      const totalScore = feedbackComplaints.reduce((sum: number, c: any) => sum + (c.feedbackScore || 0), 0);
      satisfactionScore = Math.round((totalScore / feedbackComplaints.length) * 10) / 10;
    }

    // Group by category
    const categoryMap = new Map<string, number>();
    allComplaints.forEach((c: any) => {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
    });
    const byCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    // Group by priority
    const priorityMap = new Map<string, number>();
    allComplaints.forEach((c: any) => {
      priorityMap.set(c.priority, (priorityMap.get(c.priority) || 0) + 1);
    });
    const byPriority = Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count }));

    return {
      total,
      open,
      inProgress,
      pendingCustomer,
      resolved,
      closed,
      slaBreached,
      avgResolutionHours,
      satisfactionScore,
      byCategory,
      byPriority,
    };
  }
}

export const complaintService = new ComplaintService();
