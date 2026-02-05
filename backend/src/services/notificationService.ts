import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SmsOptions {
  to: string;
  body: string;
}

export interface NotificationPayload {
  type: 'order_created' | 'order_status_changed' | 'payment_received' | 'payment_failed' | 'invoice_generated' | 'campaign_started' | 'campaign_completed' | 'call_missed' | 'password_reset' | 'email_verification' | 'team_invitation' | 'custom';
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  data: Record<string, any>;
  teamId?: string;
  userId?: string;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

class NotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    this.initializeEmailTransporter();
    this.initializeTwilioClient();
  }

  private initializeEmailTransporter(): void {
    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASSWORD,
        },
      });

      // Verify connection
      this.emailTransporter.verify((error) => {
        if (error) {
          logger.error('Email transporter verification failed', error);
        } else {
          logger.info('Email transporter ready');
        }
      });
    } else {
      logger.warn('SMTP not configured. Email notifications disabled.');
    }
  }

  private initializeTwilioClient(): void {
    if (config.SMS_ENABLED && config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      logger.info('Twilio SMS client initialized');
    } else {
      logger.warn('SMS notifications disabled.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.emailTransporter) {
      logger.warn('Email not sent - SMTP not configured', { to: options.to });
      return false;
    }

    try {
      const mailOptions = {
        from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL || config.SMTP_USER}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { messageId: result.messageId, to: options.to });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { error, to: options.to });
      return false;
    }
  }

  async sendSms(options: SmsOptions): Promise<boolean> {
    if (!this.twilioClient) {
      logger.warn('SMS not sent - Twilio SMS not configured', { to: options.to });
      return false;
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: options.body,
        from: config.TWILIO_PHONE_NUMBER,
        to: options.to,
      });

      logger.info('SMS sent successfully', { sid: message.sid, to: options.to });
      return true;
    } catch (error) {
      logger.error('Failed to send SMS', { error, to: options.to });
      return false;
    }
  }

  // Template-based notifications
  async sendNotification(payload: NotificationPayload): Promise<{ email: boolean; sms: boolean; inApp: boolean }> {
    const results = { email: false, sms: false, inApp: false };
    const template = this.getNotificationTemplate(payload);

    // Send Email
    if (payload.recipientEmail && template.email) {
      results.email = await this.sendEmail({
        to: payload.recipientEmail,
        subject: template.email.subject,
        html: template.email.html,
        text: template.email.text,
      });
    }

    // Send SMS
    if (payload.recipientPhone && template.sms) {
      results.sms = await this.sendSms({
        to: payload.recipientPhone,
        body: template.sms.body,
      });
    }

    // Create in-app notification
    if (payload.userId) {
      try {
        await this.createInAppNotification({
          userId: payload.userId,
          teamId: payload.teamId,
          type: payload.type,
          title: template.inApp?.title || template.email?.subject || 'Notification',
          message: template.inApp?.message || template.sms?.body || '',
          data: payload.data,
        });
        results.inApp = true;
      } catch (error) {
        logger.error('Failed to create in-app notification', error);
      }
    }

    return results;
  }

  private getNotificationTemplate(payload: NotificationPayload): {
    email?: { subject: string; html: string; text?: string };
    sms?: { body: string };
    inApp?: { title: string; message: string };
  } {
    const { type, data } = payload;

    switch (type) {
      case 'order_created':
        return {
          email: {
            subject: `Order Confirmation - #${data.orderNumber}`,
            html: this.getOrderConfirmationEmail(data),
            text: `Your order #${data.orderNumber} has been placed successfully. Total: ${data.currency || 'INR'} ${data.totalAmount}`,
          },
          sms: {
            body: `Order #${data.orderNumber} confirmed! Total: ${data.currency || 'INR'} ${data.totalAmount}. Track at: ${config.FRONTEND_URL}/orders/${data.orderId}`,
          },
          inApp: {
            title: 'New Order Received',
            message: `Order #${data.orderNumber} has been placed for ${data.currency || 'INR'} ${data.totalAmount}`,
          },
        };

      case 'order_status_changed':
        return {
          email: {
            subject: `Order Update - #${data.orderNumber}`,
            html: this.getOrderStatusEmail(data),
          },
          sms: {
            body: `Order #${data.orderNumber} status: ${data.status.toUpperCase()}. ${data.message || ''}`,
          },
          inApp: {
            title: 'Order Status Updated',
            message: `Order #${data.orderNumber} is now ${data.status}`,
          },
        };

      case 'payment_received':
        return {
          email: {
            subject: `Payment Received - ${data.currency || 'INR'} ${data.amount}`,
            html: this.getPaymentReceivedEmail(data),
          },
          sms: {
            body: `Payment of ${data.currency || 'INR'} ${data.amount} received for Order #${data.orderNumber}. Thank you!`,
          },
          inApp: {
            title: 'Payment Received',
            message: `Payment of ${data.currency || 'INR'} ${data.amount} received`,
          },
        };

      case 'payment_failed':
        return {
          email: {
            subject: `Payment Failed - Order #${data.orderNumber}`,
            html: this.getPaymentFailedEmail(data),
          },
          sms: {
            body: `Payment failed for Order #${data.orderNumber}. Reason: ${data.reason}. Please retry.`,
          },
          inApp: {
            title: 'Payment Failed',
            message: `Payment failed: ${data.reason}`,
          },
        };

      case 'invoice_generated':
        return {
          email: {
            subject: `Invoice ${data.invoiceNumber} - ${config.COMPANY_NAME}`,
            html: this.getInvoiceEmail(data),
          },
          sms: {
            body: `Invoice ${data.invoiceNumber} generated for ${data.currency || 'INR'} ${data.amount}. Check your email for details.`,
          },
          inApp: {
            title: 'Invoice Generated',
            message: `Invoice ${data.invoiceNumber} for ${data.currency || 'INR'} ${data.amount}`,
          },
        };

      case 'password_reset':
        return {
          email: {
            subject: 'Password Reset Request',
            html: this.getPasswordResetEmail(data),
          },
          sms: {
            body: `Your password reset code is: ${data.code}. Valid for 15 minutes. Do not share this code.`,
          },
        };

      case 'email_verification':
        return {
          email: {
            subject: 'Verify Your Email Address',
            html: this.getEmailVerificationEmail(data),
          },
        };

      case 'team_invitation':
        return {
          email: {
            subject: `You've been invited to join ${data.teamName}`,
            html: this.getTeamInvitationEmail(data),
          },
        };

      case 'campaign_started':
        return {
          email: {
            subject: `Campaign Started: ${data.campaignName}`,
            html: this.getCampaignStartedEmail(data),
          },
          inApp: {
            title: 'Campaign Started',
            message: `Campaign "${data.campaignName}" has started`,
          },
        };

      case 'campaign_completed':
        return {
          email: {
            subject: `Campaign Completed: ${data.campaignName}`,
            html: this.getCampaignCompletedEmail(data),
          },
          inApp: {
            title: 'Campaign Completed',
            message: `Campaign "${data.campaignName}" completed. Success rate: ${data.successRate}%`,
          },
        };

      case 'call_missed':
        return {
          email: {
            subject: 'Missed Call Alert',
            html: this.getMissedCallEmail(data),
          },
          sms: {
            body: `Missed call from ${data.caller} at ${data.time}. Total missed today: ${data.missedCount}`,
          },
          inApp: {
            title: 'Missed Call',
            message: `Missed call from ${data.caller}`,
          },
        };

      default:
        return {
          email: payload.subject ? {
            subject: payload.subject,
            html: `<p>${JSON.stringify(data)}</p>`,
          } : undefined,
        };
    }
  }

  // Email Templates
  private getBaseEmailTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .info-box { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${config.COMPANY_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${config.COMPANY_NAME} | ${config.COMPANY_ADDRESS}</p>
      <p>${config.COMPANY_EMAIL} | ${config.COMPANY_PHONE}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getOrderConfirmationEmail(data: Record<string, any>): string {
    const itemsHtml = data.items?.map((item: any) => `
      <tr>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>${data.currency || 'INR'} ${item.unitPrice}</td>
        <td>${data.currency || 'INR'} ${item.quantity * item.unitPrice}</td>
      </tr>
    `).join('') || '';

    return this.getBaseEmailTemplate(`
      <h2>Order Confirmation</h2>
      <p>Thank you for your order! Here are the details:</p>

      <div class="info-box">
        <strong>Order Number:</strong> ${data.orderNumber}<br>
        <strong>Order Date:</strong> ${new Date(data.orderTime || Date.now()).toLocaleDateString()}<br>
        <strong>Status:</strong> ${data.status || 'Pending'}
      </div>

      <h3>Order Items</h3>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr><td colspan="3"><strong>Total</strong></td><td><strong>${data.currency || 'INR'} ${data.totalAmount}</strong></td></tr>
        </tfoot>
      </table>

      ${data.deliveryAddress ? `
      <h3>Delivery Address</h3>
      <p>${data.deliveryAddress}</p>
      ` : ''}

      <p><a href="${config.FRONTEND_URL}/orders/${data.orderId}" class="button">Track Order</a></p>
    `);
  }

  private getOrderStatusEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Order Status Update</h2>
      <p>Your order status has been updated:</p>

      <div class="info-box">
        <strong>Order Number:</strong> ${data.orderNumber}<br>
        <strong>New Status:</strong> ${data.status}<br>
        ${data.message ? `<strong>Note:</strong> ${data.message}` : ''}
      </div>

      <p><a href="${config.FRONTEND_URL}/orders/${data.orderId}" class="button">View Order</a></p>
    `);
  }

  private getPaymentReceivedEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Payment Received</h2>
      <p>We have received your payment. Thank you!</p>

      <div class="info-box">
        <strong>Amount:</strong> ${data.currency || 'INR'} ${data.amount}<br>
        <strong>Transaction ID:</strong> ${data.transactionId}<br>
        <strong>Order Number:</strong> ${data.orderNumber}<br>
        <strong>Payment Method:</strong> ${data.method}
      </div>

      <p><a href="${config.FRONTEND_URL}/orders/${data.orderId}" class="button">View Order</a></p>
    `);
  }

  private getPaymentFailedEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Payment Failed</h2>
      <p>Unfortunately, your payment could not be processed.</p>

      <div class="info-box">
        <strong>Order Number:</strong> ${data.orderNumber}<br>
        <strong>Amount:</strong> ${data.currency || 'INR'} ${data.amount}<br>
        <strong>Reason:</strong> ${data.reason}
      </div>

      <p>Please try again or use a different payment method.</p>
      <p><a href="${config.FRONTEND_URL}/orders/${data.orderId}/payment" class="button">Retry Payment</a></p>
    `);
  }

  private getInvoiceEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Invoice ${data.invoiceNumber}</h2>
      <p>Please find attached your invoice for the recent order.</p>

      <div class="info-box">
        <strong>Invoice Number:</strong> ${data.invoiceNumber}<br>
        <strong>Amount:</strong> ${data.currency || 'INR'} ${data.amount}<br>
        <strong>Date:</strong> ${new Date(data.date || Date.now()).toLocaleDateString()}
      </div>

      <p><a href="${config.FRONTEND_URL}/invoices/${data.invoiceId}" class="button">View Invoice</a></p>
    `);
  }

  private getPasswordResetEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Use the code below:</p>

      <div class="info-box" style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
        ${data.code}
      </div>

      <p style="color: #666; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>

      <p>Or click the link below:</p>
      <p><a href="${config.FRONTEND_URL}/reset-password?token=${data.token}" class="button">Reset Password</a></p>
    `);
  }

  private getEmailVerificationEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Verify Your Email</h2>
      <p>Please verify your email address to complete your registration.</p>

      <p><a href="${config.FRONTEND_URL}/verify-email?token=${data.token}" class="button">Verify Email</a></p>

      <p style="color: #666; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
    `);
  }

  private getTeamInvitationEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Team Invitation</h2>
      <p>${data.inviterName} has invited you to join <strong>${data.teamName}</strong>.</p>

      <div class="info-box">
        <strong>Team:</strong> ${data.teamName}<br>
        <strong>Role:</strong> ${data.role}<br>
        <strong>Invited by:</strong> ${data.inviterName}
      </div>

      <p><a href="${config.FRONTEND_URL}/accept-invitation?token=${data.token}" class="button">Accept Invitation</a></p>

      <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
    `);
  }

  private getCampaignStartedEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Campaign Started</h2>
      <p>Your campaign has been started.</p>

      <div class="info-box">
        <strong>Campaign:</strong> ${data.campaignName}<br>
        <strong>Contacts:</strong> ${data.totalContacts}<br>
        <strong>Started:</strong> ${new Date().toLocaleString()}
      </div>

      <p><a href="${config.FRONTEND_URL}/campaigns/${data.campaignId}" class="button">View Campaign</a></p>
    `);
  }

  private getCampaignCompletedEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Campaign Completed</h2>
      <p>Your campaign has completed. Here's a summary:</p>

      <div class="info-box">
        <strong>Campaign:</strong> ${data.campaignName}<br>
        <strong>Total Calls:</strong> ${data.totalCalls}<br>
        <strong>Successful:</strong> ${data.successfulCalls}<br>
        <strong>Success Rate:</strong> ${data.successRate}%
      </div>

      <p><a href="${config.FRONTEND_URL}/campaigns/${data.campaignId}" class="button">View Report</a></p>
    `);
  }

  private getMissedCallEmail(data: Record<string, any>): string {
    return this.getBaseEmailTemplate(`
      <h2>Missed Call Alert</h2>
      <p>You have a missed call:</p>

      <div class="info-box">
        <strong>Caller:</strong> ${data.caller}<br>
        <strong>Time:</strong> ${data.time}<br>
        <strong>Total Missed Today:</strong> ${data.missedCount}
      </div>

      <p><a href="${config.FRONTEND_URL}/calls" class="button">View Call Log</a></p>
    `);
  }

  // In-App Notifications
  async createInAppNotification(data: {
    userId: string;
    teamId?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<void> {
    // Store in database - we'll create the model if needed
    await prisma.notification.create({
      data: {
        userId: data.userId,
        teamId: data.teamId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ? JSON.stringify(data.data) : null,
        read: false,
      },
    });
  }

  async getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<any[]> {
    const where: any = { userId };
    if (options?.unreadOnly) {
      where.read = false;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
