import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export type ActionType =
  | 'cancel_order'
  | 'modify_order'
  | 'process_refund'
  | 'apply_discount'
  | 'reschedule_delivery'
  | 'escalate_priority'
  | 'create_ticket'
  | 'send_notification'
  | 'update_contact_info'
  | 'schedule_callback';

export interface ActionRequest {
  type: ActionType;
  entityId: string;
  entityType: string;
  parameters: Record<string, any>;
  reason: string;
  requestedBy: 'ai' | 'human';
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  message: string;
  details?: any;
  requiresApproval?: boolean;
  approvalReason?: string;
}

export interface ActionAuthority {
  type: ActionType;
  maxAmount?: number;       // Max $ amount AI can handle
  requiresApproval: boolean;
  allowedConditions?: string[];
  blockedConditions?: string[];
}

export interface ActionLog {
  id: string;
  callId: string;
  actionType: ActionType;
  entityId: string;
  parameters: Record<string, any>;
  result: 'success' | 'failed' | 'pending_approval';
  performedBy: 'ai' | 'human';
  createdAt: Date;
}

// AI Action Authority Configuration
// Defines what actions AI can take without human approval
const AI_AUTHORITY_CONFIG: Record<ActionType, ActionAuthority> = {
  cancel_order: {
    type: 'cancel_order',
    maxAmount: 5000, // Can cancel orders up to Rs 5000
    requiresApproval: false,
    allowedConditions: ['pending', 'processing', 'not_shipped'],
    blockedConditions: ['shipped', 'delivered', 'refunded'],
  },
  modify_order: {
    type: 'modify_order',
    requiresApproval: false,
    allowedConditions: ['pending', 'processing'],
    blockedConditions: ['shipped', 'delivered', 'cancelled'],
  },
  process_refund: {
    type: 'process_refund',
    maxAmount: 2000, // Can process refunds up to Rs 2000 automatically
    requiresApproval: false,
  },
  apply_discount: {
    type: 'apply_discount',
    maxAmount: 500, // Can apply discounts up to Rs 500
    requiresApproval: false,
  },
  reschedule_delivery: {
    type: 'reschedule_delivery',
    requiresApproval: false,
    allowedConditions: ['pending', 'processing', 'scheduled'],
  },
  escalate_priority: {
    type: 'escalate_priority',
    requiresApproval: false,
  },
  create_ticket: {
    type: 'create_ticket',
    requiresApproval: false,
  },
  send_notification: {
    type: 'send_notification',
    requiresApproval: false,
  },
  update_contact_info: {
    type: 'update_contact_info',
    requiresApproval: false,
  },
  schedule_callback: {
    type: 'schedule_callback',
    requiresApproval: false,
  },
};

/**
 * Service that grants AI the authority to perform actions
 * with appropriate guardrails and logging
 */
export class ActionAuthorityService {
  /**
   * Check if AI can perform a specific action
   */
  canPerformAction(
    actionType: ActionType,
    context: {
      amount?: number;
      orderStatus?: string;
      customerTier?: string;
    }
  ): { allowed: boolean; reason?: string } {
    const authority = AI_AUTHORITY_CONFIG[actionType];

    if (!authority) {
      return { allowed: false, reason: 'Unknown action type' };
    }

    // Check amount limit
    if (authority.maxAmount && context.amount && context.amount > authority.maxAmount) {
      return {
        allowed: false,
        reason: `Amount ${context.amount} exceeds AI authority limit of ${authority.maxAmount}`,
      };
    }

    // Check allowed conditions
    if (authority.allowedConditions && context.orderStatus) {
      if (!authority.allowedConditions.includes(context.orderStatus)) {
        return {
          allowed: false,
          reason: `Order status "${context.orderStatus}" not in allowed conditions`,
        };
      }
    }

    // Check blocked conditions
    if (authority.blockedConditions && context.orderStatus) {
      if (authority.blockedConditions.includes(context.orderStatus)) {
        return {
          allowed: false,
          reason: `Order status "${context.orderStatus}" is blocked for this action`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Execute an action with full logging and validation
   */
  async executeAction(request: ActionRequest, callId: string): Promise<ActionResult> {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      logger.info(`Executing action: ${request.type}`, {
        actionId,
        callId,
        entityId: request.entityId,
        reason: request.reason,
      });

      // Check authority first
      const canPerform = this.canPerformAction(request.type, {
        amount: request.parameters.amount,
        orderStatus: request.parameters.orderStatus,
      });

      if (!canPerform.allowed) {
        logger.warn(`Action denied: ${canPerform.reason}`);
        return {
          success: false,
          actionId,
          message: `Action not authorized: ${canPerform.reason}`,
          requiresApproval: true,
          approvalReason: canPerform.reason,
        };
      }

      // Execute the specific action
      let result: ActionResult;
      switch (request.type) {
        case 'cancel_order':
          result = await this.cancelOrder(request, actionId);
          break;
        case 'modify_order':
          result = await this.modifyOrder(request, actionId);
          break;
        case 'process_refund':
          result = await this.processRefund(request, actionId);
          break;
        case 'apply_discount':
          result = await this.applyDiscount(request, actionId);
          break;
        case 'reschedule_delivery':
          result = await this.rescheduleDelivery(request, actionId);
          break;
        case 'escalate_priority':
          result = await this.escalatePriority(request, actionId);
          break;
        case 'create_ticket':
          result = await this.createTicket(request, actionId);
          break;
        case 'send_notification':
          result = await this.sendNotification(request, actionId);
          break;
        case 'update_contact_info':
          result = await this.updateContactInfo(request, actionId);
          break;
        case 'schedule_callback':
          result = await this.scheduleCallback(request, actionId);
          break;
        default:
          result = {
            success: false,
            actionId,
            message: 'Unknown action type',
          };
      }

      // Log the action
      await this.logAction(callId, request, result);

      return result;
    } catch (error) {
      logger.error('Error executing action', error);
      return {
        success: false,
        actionId,
        message: 'An error occurred while executing the action',
      };
    }
  }

  /**
   * Cancel an order
   */
  private async cancelOrder(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: request.entityId },
      });

      if (!order) {
        return {
          success: false,
          actionId,
          message: 'Order not found',
        };
      }

      // Check if order can be cancelled
      const nonCancellableStatuses = ['shipped', 'delivered', 'cancelled', 'refunded'];
      if (nonCancellableStatuses.includes(order.status)) {
        return {
          success: false,
          actionId,
          message: `Cannot cancel order with status: ${order.status}`,
          requiresApproval: true,
          approvalReason: 'Order is in non-cancellable status',
        };
      }

      // Cancel the order
      await prisma.order.update({
        where: { id: request.entityId },
        data: {
          status: 'cancelled',
          notes: `Cancelled by AI: ${request.reason}`,
        },
      });

      return {
        success: true,
        actionId,
        message: 'Order cancelled successfully',
        details: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: 'cancelled',
        },
      };
    } catch (error) {
      logger.error('Error cancelling order', error);
      return {
        success: false,
        actionId,
        message: 'Failed to cancel order',
      };
    }
  }

  /**
   * Modify an order
   */
  private async modifyOrder(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: request.entityId },
        include: { items: true },
      });

      if (!order) {
        return {
          success: false,
          actionId,
          message: 'Order not found',
        };
      }

      // Check if order can be modified
      const modifiableStatuses = ['pending', 'processing'];
      if (!modifiableStatuses.includes(order.status)) {
        return {
          success: false,
          actionId,
          message: `Cannot modify order with status: ${order.status}`,
          requiresApproval: true,
        };
      }

      const { modifications } = request.parameters;

      // Apply modifications (simplified - would need more complex logic in production)
      if (modifications.deliveryAddress) {
        await prisma.order.update({
          where: { id: request.entityId },
          data: {
            deliveryAddress: modifications.deliveryAddress,
            notes: `Address modified by AI: ${request.reason}`,
          },
        });
      }

      if (modifications.deliveryInstructions) {
        await prisma.order.update({
          where: { id: request.entityId },
          data: {
            notes: modifications.deliveryInstructions,
          },
        });
      }

      return {
        success: true,
        actionId,
        message: 'Order modified successfully',
        details: {
          orderId: order.id,
          modifications: Object.keys(modifications),
        },
      };
    } catch (error) {
      logger.error('Error modifying order', error);
      return {
        success: false,
        actionId,
        message: 'Failed to modify order',
      };
    }
  }

  /**
   * Process a refund
   */
  private async processRefund(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { amount, reason: refundReason } = request.parameters;

      // Check amount limit
      if (amount > AI_AUTHORITY_CONFIG.process_refund.maxAmount!) {
        return {
          success: false,
          actionId,
          message: `Refund amount ${amount} exceeds AI authority limit`,
          requiresApproval: true,
          approvalReason: `Refund of ${amount} requires human approval`,
        };
      }

      // Get order
      const order = await prisma.order.findUnique({
        where: { id: request.entityId },
        include: { payments: true },
      });

      if (!order) {
        return {
          success: false,
          actionId,
          message: 'Order not found',
        };
      }

      // Create refund record
      const payment = order.payments[0];
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'refund_pending',
            refundAmount: amount,
          },
        });
      }

      // Update order notes
      await prisma.order.update({
        where: { id: request.entityId },
        data: {
          notes: `Refund of ${amount} initiated by AI: ${refundReason || request.reason}`,
        },
      });

      return {
        success: true,
        actionId,
        message: `Refund of Rs ${amount} initiated`,
        details: {
          orderId: order.id,
          refundAmount: amount,
          expectedProcessingDays: '3-5 business days',
        },
      };
    } catch (error) {
      logger.error('Error processing refund', error);
      return {
        success: false,
        actionId,
        message: 'Failed to process refund',
      };
    }
  }

  /**
   * Apply a discount
   */
  private async applyDiscount(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { amount, percentage, reason: discountReason } = request.parameters;

      const discountAmount = amount || 0;

      // Check amount limit
      if (discountAmount > AI_AUTHORITY_CONFIG.apply_discount.maxAmount!) {
        return {
          success: false,
          actionId,
          message: `Discount amount ${discountAmount} exceeds AI authority limit`,
          requiresApproval: true,
        };
      }

      // Apply discount to order (update notes and total)
      const order = await prisma.order.findUnique({ where: { id: request.entityId } });
      if (order) {
        await prisma.order.update({
          where: { id: request.entityId },
          data: {
            totalAmount: Math.max(0, order.totalAmount - discountAmount),
            notes: `${order.notes || ''}\nDiscount of ${discountAmount} applied by AI: ${discountReason || request.reason}`,
          },
        });
      }

      return {
        success: true,
        actionId,
        message: `Discount of Rs ${discountAmount} applied`,
        details: {
          orderId: request.entityId,
          discountAmount,
        },
      };
    } catch (error) {
      logger.error('Error applying discount', error);
      return {
        success: false,
        actionId,
        message: 'Failed to apply discount',
      };
    }
  }

  /**
   * Reschedule delivery
   */
  private async rescheduleDelivery(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { newDate, newTime } = request.parameters;

      const order = await prisma.order.findUnique({ where: { id: request.entityId } });
      await prisma.order.update({
        where: { id: request.entityId },
        data: {
          notes: `${order?.notes || ''}\nDelivery rescheduled by AI to ${newDate} ${newTime || ''}`,
        },
      });

      return {
        success: true,
        actionId,
        message: `Delivery rescheduled to ${newDate}`,
        details: {
          orderId: request.entityId,
          newDeliveryDate: newDate,
          newDeliveryTime: newTime,
        },
      };
    } catch (error) {
      logger.error('Error rescheduling delivery', error);
      return {
        success: false,
        actionId,
        message: 'Failed to reschedule delivery',
      };
    }
  }

  /**
   * Escalate order priority
   */
  private async escalatePriority(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const order = await prisma.order.findUnique({ where: { id: request.entityId } });
      await prisma.order.update({
        where: { id: request.entityId },
        data: {
          notes: `${order?.notes || ''}\n[PRIORITY: HIGH] Escalated by AI: ${request.reason}`,
        },
      });

      return {
        success: true,
        actionId,
        message: 'Order priority escalated',
        details: {
          orderId: request.entityId,
          newPriority: 'high',
        },
      };
    } catch (error) {
      logger.error('Error escalating priority', error);
      return {
        success: false,
        actionId,
        message: 'Failed to escalate priority',
      };
    }
  }

  /**
   * Create a support ticket
   */
  private async createTicket(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { subject, description, priority, category } = request.parameters;

      // In a real system, this would create a ticket in a ticketing system
      // For now, we'll log it
      logger.info('Creating support ticket', {
        subject,
        description,
        priority,
        category,
        entityId: request.entityId,
        reason: request.reason,
      });

      return {
        success: true,
        actionId,
        message: 'Support ticket created',
        details: {
          ticketId: `TICKET-${actionId.slice(-6).toUpperCase()}`,
          subject,
          priority,
        },
      };
    } catch (error) {
      logger.error('Error creating ticket', error);
      return {
        success: false,
        actionId,
        message: 'Failed to create ticket',
      };
    }
  }

  /**
   * Send notification to customer
   */
  private async sendNotification(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { type, message, channel } = request.parameters;

      // In a real system, this would send actual notifications
      logger.info('Sending notification', {
        type,
        message,
        channel,
        entityId: request.entityId,
      });

      return {
        success: true,
        actionId,
        message: `${channel} notification sent`,
        details: {
          notificationType: type,
          channel,
        },
      };
    } catch (error) {
      logger.error('Error sending notification', error);
      return {
        success: false,
        actionId,
        message: 'Failed to send notification',
      };
    }
  }

  /**
   * Update customer contact information
   */
  private async updateContactInfo(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { phone, email, address } = request.parameters;

      const updateData: any = {};
      if (phone) updateData.phone = phone;
      if (email) updateData.email = email;
      if (address) updateData.address = address;

      await prisma.customer.update({
        where: { id: request.entityId },
        data: updateData,
      });

      return {
        success: true,
        actionId,
        message: 'Contact information updated',
        details: {
          updatedFields: Object.keys(updateData),
        },
      };
    } catch (error) {
      logger.error('Error updating contact info', error);
      return {
        success: false,
        actionId,
        message: 'Failed to update contact information',
      };
    }
  }

  /**
   * Schedule a callback
   */
  private async scheduleCallback(request: ActionRequest, actionId: string): Promise<ActionResult> {
    try {
      const { date, time, reason: callbackReason } = request.parameters;

      // Get contact to get teamId
      const contact = await prisma.contact.findUnique({ where: { id: request.entityId } });
      if (!contact) {
        return {
          success: false,
          actionId,
          message: 'Contact not found',
        };
      }

      await prisma.callbackSchedule.create({
        data: {
          teamId: contact.campaignId || '', // Use campaign's team or empty string
          contactId: request.entityId,
          scheduledTime: new Date(`${date} ${time}`),
          reason: callbackReason || request.reason,
          status: 'pending',
          priority: 1, // Normal priority
        },
      });

      return {
        success: true,
        actionId,
        message: `Callback scheduled for ${date} at ${time}`,
        details: {
          scheduledDate: date,
          scheduledTime: time,
        },
      };
    } catch (error) {
      logger.error('Error scheduling callback', error);
      return {
        success: false,
        actionId,
        message: 'Failed to schedule callback',
      };
    }
  }

  /**
   * Log action for audit trail
   */
  private async logAction(
    callId: string,
    request: ActionRequest,
    result: ActionResult
  ): Promise<void> {
    try {
      // In production, this would write to an audit log table
      logger.info('Action logged', {
        callId,
        actionId: result.actionId,
        actionType: request.type,
        entityId: request.entityId,
        success: result.success,
        performedBy: request.requestedBy,
        reason: request.reason,
      });
    } catch (error) {
      logger.error('Error logging action', error);
    }
  }

  /**
   * Get action history for a call
   */
  async getActionHistory(callId: string): Promise<ActionLog[]> {
    // In production, this would query the audit log table
    return [];
  }

  /**
   * Get available actions for an entity
   */
  getAvailableActions(
    entityType: string,
    entityStatus?: string
  ): { action: ActionType; description: string }[] {
    const actions: { action: ActionType; description: string }[] = [];

    if (entityType === 'order') {
      actions.push(
        { action: 'cancel_order', description: 'Cancel this order' },
        { action: 'modify_order', description: 'Modify order details' },
        { action: 'process_refund', description: 'Process a refund' },
        { action: 'apply_discount', description: 'Apply a discount' },
        { action: 'reschedule_delivery', description: 'Reschedule delivery' },
        { action: 'escalate_priority', description: 'Escalate priority' }
      );
    }

    if (entityType === 'customer') {
      actions.push(
        { action: 'update_contact_info', description: 'Update contact information' },
        { action: 'schedule_callback', description: 'Schedule a callback' },
        { action: 'send_notification', description: 'Send notification' }
      );
    }

    // Always available
    actions.push({ action: 'create_ticket', description: 'Create support ticket' });

    return actions;
  }
}

export const actionAuthorityService = new ActionAuthorityService();
