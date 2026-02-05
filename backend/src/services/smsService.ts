import { prisma } from '../db/client';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import twilio from 'twilio';

// Types
export interface SendSmsInput {
  to: string;
  message: string;
  teamId?: string;
  orderId?: string;
  customerId?: string;
  templateType?: SmsTemplateType;
}

export interface SmsTemplate {
  id: string;
  teamId: string;
  type: SmsTemplateType;
  name: string;
  content: string;
  isActive: boolean;
}

export type SmsTemplateType =
  | 'order_confirmation'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'callback_reminder'
  | 'follow_up'
  | 'promotional'
  | 'custom';

export interface SmsLog {
  id: string;
  teamId?: string;
  to: string;
  message: string;
  templateType?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  messageSid?: string;
  errorMessage?: string;
  orderId?: string;
  customerId?: string;
  createdAt: Date;
}

// Default templates
const DEFAULT_TEMPLATES: Record<SmsTemplateType, string> = {
  order_confirmation: `Hi {{customer_name}}! Your order #{{order_number}} has been confirmed. Total: Rs {{total_amount}}. We'll notify you when it's ready. Thank you for ordering from {{company_name}}!`,
  order_ready: `Great news! Your order #{{order_number}} is ready for pickup/delivery. {{company_name}}`,
  order_out_for_delivery: `Your order #{{order_number}} is out for delivery! Our delivery partner will reach you shortly. Track: {{tracking_link}}`,
  order_delivered: `Your order #{{order_number}} has been delivered. Thank you for choosing {{company_name}}! Rate us: {{feedback_link}}`,
  order_cancelled: `Your order #{{order_number}} has been cancelled. {{cancel_reason}} If you have questions, call us at {{support_phone}}. - {{company_name}}`,
  payment_received: `Payment of Rs {{amount}} received for order #{{order_number}}. Thank you! - {{company_name}}`,
  payment_failed: `Payment failed for order #{{order_number}}. Please retry or contact support at {{support_phone}}. - {{company_name}}`,
  callback_reminder: `Hi {{customer_name}}, this is a reminder about your scheduled callback at {{callback_time}}. We'll call you soon! - {{company_name}}`,
  follow_up: `Hi {{customer_name}}, thank you for your interest! {{custom_message}} - {{company_name}}`,
  promotional: `{{custom_message}} - {{company_name}}. Reply STOP to unsubscribe.`,
  custom: `{{custom_message}}`,
};

/**
 * SMS Service for sending notifications
 */
export class SmsService {
  private twilioClient: twilio.Twilio | null = null;
  private fromNumber: string | null = null;

  constructor() {
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilio() {
    const accountSid = config.TWILIO_ACCOUNT_SID;
    const authToken = config.TWILIO_AUTH_TOKEN;
    const phoneNumber = config.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && phoneNumber) {
      this.twilioClient = twilio(accountSid, authToken);
      this.fromNumber = phoneNumber;
      logger.info('Twilio SMS service initialized');
    } else {
      logger.warn('Twilio SMS credentials not configured');
    }
  }

  /**
   * Send an SMS
   */
  async sendSms(input: SendSmsInput): Promise<SmsLog> {
    const { to, message, teamId, orderId, customerId, templateType } = input;

    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(to);

    // Create log entry
    const logEntry = await prisma.smsLog.create({
      data: {
        teamId,
        to: normalizedPhone,
        message,
        templateType,
        status: 'pending',
        orderId,
        customerId,
      },
    });

    try {
      if (!this.twilioClient || !this.fromNumber) {
        // Log but don't fail in development
        logger.warn(`SMS would be sent to ${normalizedPhone}: ${message}`);

        await prisma.smsLog.update({
          where: { id: logEntry.id },
          data: {
            status: 'sent',
            errorMessage: 'Twilio not configured - logged only',
          },
        });

        return { ...logEntry, status: 'sent' } as SmsLog;
      }

      // Send via Twilio
      const result = await this.twilioClient.messages.create({
        body: message,
        to: normalizedPhone,
        from: this.fromNumber,
      });

      // Update log with success
      await prisma.smsLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'sent',
          messageSid: result.sid,
        },
      });

      logger.info(`SMS sent to ${normalizedPhone}, SID: ${result.sid}`);
      return { ...logEntry, status: 'sent', messageSid: result.sid } as SmsLog;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.smsLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      logger.error(`Failed to send SMS to ${normalizedPhone}`, error);
      return { ...logEntry, status: 'failed', errorMessage } as SmsLog;
    }
  }

  /**
   * Send SMS using a template
   */
  async sendTemplatedSms(
    templateType: SmsTemplateType,
    to: string,
    variables: Record<string, string>,
    options?: {
      teamId?: string;
      orderId?: string;
      customerId?: string;
    }
  ): Promise<SmsLog> {
    // Get custom template or use default
    let template = DEFAULT_TEMPLATES[templateType];

    if (options?.teamId) {
      const customTemplate = await prisma.smsTemplate.findFirst({
        where: {
          teamId: options.teamId,
          type: templateType,
          isActive: true,
        },
      });

      if (customTemplate) {
        template = customTemplate.content;
      }
    }

    // Render template with variables
    const message = this.renderTemplate(template, variables);

    return this.sendSms({
      to,
      message,
      teamId: options?.teamId,
      orderId: options?.orderId,
      customerId: options?.customerId,
      templateType,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send order confirmation SMS
   */
  async sendOrderConfirmation(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        team: true,
      },
    });

    if (!order || !order.phone) {
      logger.warn(`Cannot send order confirmation: order ${orderId} not found or no phone`);
      return null;
    }

    const variables = {
      customer_name: order.customer?.name || 'Customer',
      order_number: order.orderNumber,
      total_amount: order.totalAmount.toString(),
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('order_confirmation', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  /**
   * Send order ready notification
   */
  async sendOrderReady(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, team: true },
    });

    if (!order || !order.phone) return null;

    const variables = {
      order_number: order.orderNumber,
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('order_ready', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  /**
   * Send out for delivery notification
   */
  async sendOutForDelivery(orderId: string, trackingLink?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, team: true },
    });

    if (!order || !order.phone) return null;

    const variables = {
      order_number: order.orderNumber,
      tracking_link: trackingLink || 'N/A',
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('order_out_for_delivery', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  /**
   * Send order delivered notification
   */
  async sendOrderDelivered(orderId: string, feedbackLink?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, team: true },
    });

    if (!order || !order.phone) return null;

    const variables = {
      order_number: order.orderNumber,
      feedback_link: feedbackLink || '',
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('order_delivered', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  /**
   * Send order cancelled notification
   */
  async sendOrderCancelled(orderId: string, cancelReason?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, team: true },
    });

    if (!order || !order.phone) return null;

    const variables = {
      order_number: order.orderNumber,
      cancel_reason: cancelReason || order.cancelReason || 'Your order has been cancelled.',
      support_phone: config.COMPANY_PHONE || '',
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('order_cancelled', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  /**
   * Send payment received notification
   */
  async sendPaymentReceived(orderId: string, amount: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, team: true },
    });

    if (!order || !order.phone) return null;

    const variables = {
      amount: amount.toString(),
      order_number: order.orderNumber,
      company_name: order.team?.name || config.COMPANY_NAME || 'Our Store',
    };

    return this.sendTemplatedSms('payment_received', order.phone, variables, {
      teamId: order.teamId || undefined,
      orderId: order.id,
      customerId: order.customerId || undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get templates for a team
   */
  async getTemplates(teamId: string): Promise<SmsTemplate[]> {
    const templates = await prisma.smsTemplate.findMany({
      where: { teamId },
      orderBy: { type: 'asc' },
    });

    // Fill in defaults for missing types
    const templateMap = new Map(templates.map((t) => [t.type, t]));
    const allTemplates: SmsTemplate[] = [];

    for (const [type, defaultContent] of Object.entries(DEFAULT_TEMPLATES)) {
      const existing = templateMap.get(type);
      if (existing) {
        allTemplates.push(existing as SmsTemplate);
      } else {
        allTemplates.push({
          id: `default_${type}`,
          teamId,
          type: type as SmsTemplateType,
          name: this.getTemplateName(type as SmsTemplateType),
          content: defaultContent,
          isActive: true,
        });
      }
    }

    return allTemplates;
  }

  /**
   * Create or update a template
   */
  async saveTemplate(
    teamId: string,
    type: SmsTemplateType,
    content: string,
    name?: string
  ): Promise<SmsTemplate> {
    const existing = await prisma.smsTemplate.findFirst({
      where: { teamId, type },
    });

    if (existing) {
      return prisma.smsTemplate.update({
        where: { id: existing.id },
        data: { content, name: name || existing.name },
      }) as Promise<SmsTemplate>;
    }

    return prisma.smsTemplate.create({
      data: {
        teamId,
        type,
        name: name || this.getTemplateName(type),
        content,
        isActive: true,
      },
    }) as Promise<SmsTemplate>;
  }

  /**
   * Reset template to default
   */
  async resetTemplate(teamId: string, type: SmsTemplateType): Promise<void> {
    await prisma.smsTemplate.deleteMany({
      where: { teamId, type },
    });
  }

  /**
   * Get SMS logs
   */
  async getLogs(
    teamId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      orderId?: string;
      customerId?: string;
    }
  ) {
    const where: any = { teamId };

    if (options?.status) where.status = options.status;
    if (options?.orderId) where.orderId = options.orderId;
    if (options?.customerId) where.customerId = options.customerId;

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.smsLog.count({ where }),
    ]);

    return { logs, total };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Add India country code if not present
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else if (!cleaned.startsWith('+')) {
      cleaned = `+${cleaned}`;
    }

    return cleaned;
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    // Remove any remaining unfilled variables
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');
    return rendered.trim();
  }

  private getTemplateName(type: SmsTemplateType): string {
    const names: Record<SmsTemplateType, string> = {
      order_confirmation: 'Order Confirmation',
      order_ready: 'Order Ready',
      order_out_for_delivery: 'Out for Delivery',
      order_delivered: 'Order Delivered',
      order_cancelled: 'Order Cancelled',
      payment_received: 'Payment Received',
      payment_failed: 'Payment Failed',
      callback_reminder: 'Callback Reminder',
      follow_up: 'Follow Up',
      promotional: 'Promotional',
      custom: 'Custom Message',
    };
    return names[type];
  }

  /**
   * Get template variables list
   */
  getTemplateVariables(): string[] {
    return [
      'customer_name',
      'order_number',
      'total_amount',
      'company_name',
      'tracking_link',
      'feedback_link',
      'cancel_reason',
      'support_phone',
      'amount',
      'callback_time',
      'custom_message',
    ];
  }
}

export const smsService = new SmsService();
