import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export interface CreateSequenceInput {
  teamId: string;
  campaignId?: string;
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
  isActive?: boolean;
  priority?: number;
  maxExecutions?: number;
  cooldownHours?: number;
}

export interface CreateStepInput {
  sequenceId: string;
  stepOrder: number;
  actionType: ActionType;
  delayMinutes?: number;
  delayType?: DelayType;
  specificTime?: string;
  templateContent?: string;
  subject?: string;
  callbackPriority?: number;
  conditions?: StepConditions;
  skipIfContacted?: boolean;
}

export type TriggerEvent =
  | 'call_completed'
  | 'call_no_answer'
  | 'call_voicemail'
  | 'call_busy'
  | 'lead_interested'
  | 'lead_not_interested'
  | 'lead_callback_requested'
  | 'order_placed'
  | 'order_cancelled';

export type ActionType =
  | 'sms'
  | 'email'
  | 'callback'
  | 'whatsapp'
  | 'wait';

export type DelayType =
  | 'after_previous'
  | 'after_trigger'
  | 'specific_time';

export interface StepConditions {
  dayOfWeek?: number[];        // 0-6, Sunday = 0
  timeRange?: { start: string; end: string };
  leadTier?: string[];
  leadScore?: { min?: number; max?: number };
  previousStepResult?: string;
}

export interface SequenceAnalytics {
  totalExecutions: number;
  completedExecutions: number;
  cancelledExecutions: number;
  activeExecutions: number;
  stepAnalytics: {
    stepOrder: number;
    actionType: string;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
  }[];
  conversionRate: number;
}

// Template variables
const TEMPLATE_VARIABLES = [
  '{{contact_name}}',
  '{{contact_phone}}',
  '{{company_name}}',
  '{{agent_name}}',
  '{{campaign_name}}',
  '{{callback_time}}',
  '{{product_name}}',
  '{{custom_field_1}}',
  '{{custom_field_2}}',
];

/**
 * Service for managing campaign follow-up sequences
 */
export class FollowUpSequenceService {
  // ═══════════════════════════════════════════════════════════════════════════
  // SEQUENCE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new follow-up sequence
   */
  async createSequence(input: CreateSequenceInput) {
    try {
      const sequence = await prisma.followUpSequence.create({
        data: {
          teamId: input.teamId,
          campaignId: input.campaignId,
          name: input.name,
          description: input.description,
          triggerEvent: input.triggerEvent,
          isActive: input.isActive ?? true,
          priority: input.priority ?? 0,
          maxExecutions: input.maxExecutions ?? 1,
          cooldownHours: input.cooldownHours ?? 24,
        },
        include: {
          steps: true,
          campaign: true,
        },
      });

      logger.info(`Created follow-up sequence: ${sequence.id}`);
      return sequence;
    } catch (error) {
      logger.error('Error creating follow-up sequence', error);
      throw error;
    }
  }

  /**
   * Get sequence by ID
   */
  async getSequence(sequenceId: string) {
    return prisma.followUpSequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        campaign: true,
        _count: { select: { executions: true } },
      },
    });
  }

  /**
   * List sequences for a team
   */
  async listSequences(teamId: string, campaignId?: string) {
    return prisma.followUpSequence.findMany({
      where: {
        teamId,
        ...(campaignId && { campaignId }),
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        campaign: { select: { id: true, name: true } },
        _count: { select: { executions: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Update a sequence
   */
  async updateSequence(sequenceId: string, data: Partial<CreateSequenceInput>) {
    return prisma.followUpSequence.update({
      where: { id: sequenceId },
      data,
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  /**
   * Delete a sequence
   */
  async deleteSequence(sequenceId: string) {
    await prisma.followUpSequence.delete({
      where: { id: sequenceId },
    });
    logger.info(`Deleted follow-up sequence: ${sequenceId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a step to a sequence
   */
  async addStep(input: CreateStepInput) {
    try {
      const step = await prisma.followUpStep.create({
        data: {
          sequenceId: input.sequenceId,
          stepOrder: input.stepOrder,
          actionType: input.actionType,
          delayMinutes: input.delayMinutes ?? 0,
          delayType: input.delayType ?? 'after_previous',
          specificTime: input.specificTime,
          templateContent: input.templateContent,
          subject: input.subject,
          callbackPriority: input.callbackPriority,
          conditions: input.conditions ? JSON.stringify(input.conditions) : null,
          skipIfContacted: input.skipIfContacted ?? true,
        },
      });

      logger.info(`Added step ${step.stepOrder} to sequence ${input.sequenceId}`);
      return step;
    } catch (error) {
      logger.error('Error adding step to sequence', error);
      throw error;
    }
  }

  /**
   * Update a step
   */
  async updateStep(stepId: string, data: Partial<CreateStepInput>) {
    return prisma.followUpStep.update({
      where: { id: stepId },
      data: {
        ...data,
        conditions: data.conditions ? JSON.stringify(data.conditions) : undefined,
      },
    });
  }

  /**
   * Delete a step
   */
  async deleteStep(stepId: string) {
    await prisma.followUpStep.delete({
      where: { id: stepId },
    });
  }

  /**
   * Reorder steps
   */
  async reorderSteps(sequenceId: string, stepIds: string[]) {
    const updates = stepIds.map((stepId, index) =>
      prisma.followUpStep.update({
        where: { id: stepId },
        data: { stepOrder: index + 1 },
      })
    );

    await prisma.$transaction(updates);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Trigger follow-up sequence for a contact
   */
  async triggerSequence(
    triggerEvent: TriggerEvent,
    contactId: string,
    callLogId?: string,
    campaignId?: string
  ) {
    try {
      // Get contact info
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: { campaign: true },
      });

      if (!contact) {
        logger.warn(`Contact ${contactId} not found for follow-up trigger`);
        return null;
      }

      const teamId = contact.campaign?.teamId;
      if (!teamId) {
        logger.warn(`No team found for contact ${contactId}`);
        return null;
      }

      // Find matching sequences
      const sequences = await prisma.followUpSequence.findMany({
        where: {
          teamId,
          triggerEvent,
          isActive: true,
          ...(campaignId && { campaignId }),
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' }, where: { isActive: true } },
        },
        orderBy: { priority: 'desc' },
      });

      if (sequences.length === 0) {
        logger.debug(`No active sequences found for trigger: ${triggerEvent}`);
        return null;
      }

      const executions = [];

      for (const sequence of sequences) {
        // Check if contact already has active/recent execution
        const existingExecution = await prisma.followUpExecution.findFirst({
          where: {
            sequenceId: sequence.id,
            contactId,
            OR: [
              { status: 'pending' },
              { status: 'in_progress' },
              {
                completedAt: {
                  gte: new Date(Date.now() - sequence.cooldownHours * 60 * 60 * 1000),
                },
              },
            ],
          },
        });

        if (existingExecution) {
          logger.debug(`Skipping sequence ${sequence.id}: cooldown or active execution`);
          continue;
        }

        // Check max executions
        const executionCount = await prisma.followUpExecution.count({
          where: {
            sequenceId: sequence.id,
            contactId,
            status: 'completed',
          },
        });

        if (executionCount >= sequence.maxExecutions) {
          logger.debug(`Skipping sequence ${sequence.id}: max executions reached`);
          continue;
        }

        // Create execution
        const execution = await prisma.followUpExecution.create({
          data: {
            sequenceId: sequence.id,
            contactId,
            callLogId,
            status: 'pending',
            currentStepOrder: 0,
          },
          include: {
            sequence: { include: { steps: true } },
          },
        });

        // Schedule first step
        if (sequence.steps.length > 0) {
          await this.scheduleStep(execution.id, sequence.steps[0]);
        }

        executions.push(execution);
        logger.info(`Triggered sequence ${sequence.id} for contact ${contactId}`);
      }

      return executions;
    } catch (error) {
      logger.error('Error triggering follow-up sequence', error);
      throw error;
    }
  }

  /**
   * Schedule a step for execution
   */
  private async scheduleStep(executionId: string, step: any) {
    const execution = await prisma.followUpExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) return;

    let scheduledFor = new Date();

    switch (step.delayType) {
      case 'after_previous':
        scheduledFor = new Date(Date.now() + step.delayMinutes * 60 * 1000);
        break;
      case 'after_trigger':
        scheduledFor = new Date(
          (execution.startedAt || execution.createdAt).getTime() +
            step.delayMinutes * 60 * 1000
        );
        break;
      case 'specific_time':
        if (step.specificTime) {
          const [hours, minutes] = step.specificTime.split(':').map(Number);
          scheduledFor = new Date();
          scheduledFor.setHours(hours, minutes, 0, 0);
          if (scheduledFor <= new Date()) {
            scheduledFor.setDate(scheduledFor.getDate() + 1);
          }
        }
        break;
    }

    await prisma.followUpStepExecution.create({
      data: {
        executionId,
        stepId: step.id,
        status: 'scheduled',
        scheduledFor,
      },
    });

    // Update execution status
    await prisma.followUpExecution.update({
      where: { id: executionId },
      data: {
        status: 'in_progress',
        startedAt: execution.startedAt || new Date(),
        currentStepOrder: step.stepOrder,
      },
    });
  }

  /**
   * Process scheduled steps (called by cron job)
   */
  async processScheduledSteps() {
    try {
      const now = new Date();

      // Find steps due for execution
      const dueSteps = await prisma.followUpStepExecution.findMany({
        where: {
          status: 'scheduled',
          scheduledFor: { lte: now },
        },
        include: {
          step: true,
          execution: {
            include: {
              contact: true,
              sequence: { include: { campaign: true } },
            },
          },
        },
        take: 100, // Process in batches
      });

      logger.info(`Processing ${dueSteps.length} scheduled follow-up steps`);

      for (const stepExecution of dueSteps) {
        await this.executeStep(stepExecution);
      }

      return dueSteps.length;
    } catch (error) {
      logger.error('Error processing scheduled steps', error);
      throw error;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(stepExecution: any) {
    const { step, execution } = stepExecution;
    const { contact, sequence } = execution;

    try {
      // Check if contact was contacted since scheduling
      if (step.skipIfContacted) {
        const recentContact = await this.checkRecentContact(
          contact.id,
          stepExecution.scheduledFor
        );
        if (recentContact) {
          await this.markStepSkipped(stepExecution.id, 'Contact was reached');
          return;
        }
      }

      // Check step conditions
      if (step.conditions) {
        const conditions = JSON.parse(step.conditions) as StepConditions;
        const conditionsMet = await this.evaluateConditions(conditions, contact);
        if (!conditionsMet) {
          await this.markStepSkipped(stepExecution.id, 'Conditions not met');
          return;
        }
      }

      // Execute based on action type
      let result: any;
      switch (step.actionType) {
        case 'sms':
          result = await this.sendSms(contact, step, sequence);
          break;
        case 'email':
          result = await this.sendEmail(contact, step, sequence);
          break;
        case 'callback':
          result = await this.scheduleCallback(contact, step, sequence);
          break;
        case 'whatsapp':
          result = await this.sendWhatsApp(contact, step, sequence);
          break;
        case 'wait':
          result = { success: true, message: 'Wait step completed' };
          break;
      }

      // Update step execution
      await prisma.followUpStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          executedAt: new Date(),
          result: JSON.stringify(result),
          errorMessage: result.error,
        },
      });

      // Schedule next step
      await this.scheduleNextStep(execution.id, step.stepOrder);
    } catch (error) {
      logger.error(`Error executing step ${stepExecution.id}`, error);
      await prisma.followUpStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: 'failed',
          executedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Schedule the next step in sequence
   */
  private async scheduleNextStep(executionId: string, currentStepOrder: number) {
    const execution = await prisma.followUpExecution.findUnique({
      where: { id: executionId },
      include: {
        sequence: {
          include: {
            steps: {
              where: {
                stepOrder: { gt: currentStepOrder },
                isActive: true,
              },
              orderBy: { stepOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!execution) return;

    const nextStep = execution.sequence.steps[0];

    if (nextStep) {
      await this.scheduleStep(executionId, nextStep);
    } else {
      // Sequence completed
      await prisma.followUpExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
      logger.info(`Follow-up execution ${executionId} completed`);
    }
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string, reason: string) {
    await prisma.followUpExecution.update({
      where: { id: executionId },
      data: {
        status: 'cancelled',
        cancelReason: reason,
        completedAt: new Date(),
      },
    });

    // Cancel pending step executions
    await prisma.followUpStepExecution.updateMany({
      where: {
        executionId,
        status: { in: ['pending', 'scheduled'] },
      },
      data: {
        status: 'skipped',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkRecentContact(contactId: string, since: Date): Promise<boolean> {
    const recentCall = await prisma.callLog.findFirst({
      where: {
        contactId,
        createdAt: { gte: since },
        result: { in: ['completed', 'answered'] },
      },
    });
    return !!recentCall;
  }

  private async evaluateConditions(conditions: StepConditions, contact: any): Promise<boolean> {
    // Check day of week
    if (conditions.dayOfWeek && conditions.dayOfWeek.length > 0) {
      const today = new Date().getDay();
      if (!conditions.dayOfWeek.includes(today)) return false;
    }

    // Check time range
    if (conditions.timeRange) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < conditions.timeRange.start || currentTime > conditions.timeRange.end) {
        return false;
      }
    }

    // Check lead tier
    if (conditions.leadTier && conditions.leadTier.length > 0) {
      if (!conditions.leadTier.includes(contact.leadTier)) return false;
    }

    // Check lead score
    if (conditions.leadScore) {
      if (conditions.leadScore.min !== undefined && contact.leadScore < conditions.leadScore.min) {
        return false;
      }
      if (conditions.leadScore.max !== undefined && contact.leadScore > conditions.leadScore.max) {
        return false;
      }
    }

    return true;
  }

  private async markStepSkipped(stepExecutionId: string, reason: string) {
    await prisma.followUpStepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: 'skipped',
        executedAt: new Date(),
        result: JSON.stringify({ skipped: true, reason }),
      },
    });
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return rendered;
  }

  // Action implementations using actual service integrations
  private async sendSms(contact: any, step: any, sequence: any) {
    const variables = {
      contact_name: contact.name || 'Customer',
      contact_phone: contact.phone,
      company_name: sequence.campaign?.name || 'Our Team',
      campaign_name: sequence.campaign?.name || '',
    };

    const message = this.renderTemplate(step.templateContent || '', variables);

    try {
      const { smsService } = await import('./smsService');
      const result = await smsService.sendSms({
        to: contact.phone,
        message,
        teamId: sequence.teamId,
        templateType: 'follow_up',
      });
      logger.info(`Follow-up SMS sent to ${contact.phone}, status: ${result.status}`);
      return { success: result.status !== 'failed', message: 'SMS sent', recipient: contact.phone };
    } catch (error) {
      logger.error(`Failed to send follow-up SMS to ${contact.phone}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'SMS send failed' };
    }
  }

  private async sendEmail(contact: any, step: any, sequence: any) {
    if (!contact.email) {
      return { success: false, error: 'No email address' };
    }

    const variables = {
      contact_name: contact.name || 'Customer',
      contact_phone: contact.phone,
      company_name: sequence.campaign?.name || 'Our Team',
      campaign_name: sequence.campaign?.name || '',
    };

    const body = this.renderTemplate(step.templateContent || '', variables);
    const subject = this.renderTemplate(step.subject || 'Follow-up', variables);

    try {
      const nodemailer = await import('nodemailer');
      const { config } = await import('../config/env');

      if (!config.SMTP_HOST) {
        logger.warn(`Email to ${contact.email} skipped: SMTP not configured`);
        return { success: true, message: 'Email skipped (SMTP not configured)', recipient: contact.email };
      }

      const transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
      });

      await transporter.sendMail({
        from: config.SMTP_FROM_EMAIL || config.COMPANY_EMAIL,
        to: contact.email,
        subject,
        html: body,
      });

      logger.info(`Follow-up email sent to ${contact.email}: ${subject}`);
      return { success: true, message: 'Email sent', recipient: contact.email };
    } catch (error) {
      logger.error(`Failed to send follow-up email to ${contact.email}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Email send failed' };
    }
  }

  private async scheduleCallback(contact: any, step: any, sequence: any) {
    const callback = await prisma.callbackSchedule.create({
      data: {
        contactId: contact.id,
        teamId: sequence.teamId,
        campaignId: sequence.campaignId,
        scheduledTime: new Date(Date.now() + 30 * 60 * 1000),
        priority: step.callbackPriority || 0,
        reason: 'Follow-up sequence callback',
        status: 'pending',
      },
    });

    return { success: true, callbackId: callback.id };
  }

  private async sendWhatsApp(contact: any, step: any, sequence: any) {
    const variables = {
      contact_name: contact.name || 'Customer',
      contact_phone: contact.phone,
      company_name: sequence.campaign?.name || 'Our Team',
      campaign_name: sequence.campaign?.name || '',
    };

    const message = this.renderTemplate(step.templateContent || '', variables);

    try {
      // WhatsApp via Twilio WhatsApp API
      const { config } = await import('../config/env');
      if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
        logger.warn(`WhatsApp to ${contact.phone} skipped: Twilio not configured`);
        return { success: true, message: 'WhatsApp skipped (Twilio not configured)' };
      }

      const twilio = await import('twilio');
      const client = twilio.default(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      const normalizedPhone = contact.phone.startsWith('+') ? contact.phone : `+91${contact.phone.replace(/\D/g, '')}`;

      await client.messages.create({
        body: message,
        from: `whatsapp:${config.TWILIO_PHONE_NUMBER}`,
        to: `whatsapp:${normalizedPhone}`,
      });

      logger.info(`Follow-up WhatsApp sent to ${contact.phone}`);
      return { success: true, message: 'WhatsApp sent', recipient: contact.phone };
    } catch (error) {
      logger.error(`Failed to send WhatsApp to ${contact.phone}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'WhatsApp send failed' };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get sequence analytics
   */
  async getSequenceAnalytics(sequenceId: string): Promise<SequenceAnalytics> {
    const [executions, stepStats] = await Promise.all([
      prisma.followUpExecution.groupBy({
        by: ['status'],
        where: { sequenceId },
        _count: true,
      }),
      prisma.followUpStepExecution.groupBy({
        by: ['status'],
        where: { step: { sequenceId } },
        _count: true,
      }),
    ]);

    const statusCounts = executions.reduce(
      (acc, e) => ({ ...acc, [e.status]: e._count }),
      {} as Record<string, number>
    );

    const steps = await prisma.followUpStep.findMany({
      where: { sequenceId },
      include: {
        stepExecutions: {
          select: { status: true },
        },
      },
      orderBy: { stepOrder: 'asc' },
    });

    const stepAnalytics = steps.map((step) => {
      const counts = step.stepExecutions.reduce(
        (acc, se) => ({ ...acc, [se.status]: (acc[se.status] || 0) + 1 }),
        {} as Record<string, number>
      );

      return {
        stepOrder: step.stepOrder,
        actionType: step.actionType,
        sent: counts['sent'] || 0,
        delivered: counts['delivered'] || 0,
        failed: counts['failed'] || 0,
        skipped: counts['skipped'] || 0,
      };
    });

    const totalExecutions =
      (statusCounts['completed'] || 0) +
      (statusCounts['cancelled'] || 0) +
      (statusCounts['in_progress'] || 0) +
      (statusCounts['pending'] || 0);

    return {
      totalExecutions,
      completedExecutions: statusCounts['completed'] || 0,
      cancelledExecutions: statusCounts['cancelled'] || 0,
      activeExecutions: (statusCounts['in_progress'] || 0) + (statusCounts['pending'] || 0),
      stepAnalytics,
      conversionRate: totalExecutions > 0
        ? (statusCounts['completed'] || 0) / totalExecutions
        : 0,
    };
  }

  /**
   * Get template variables
   */
  getTemplateVariables(): string[] {
    return TEMPLATE_VARIABLES;
  }
}

export const followUpSequenceService = new FollowUpSequenceService();
