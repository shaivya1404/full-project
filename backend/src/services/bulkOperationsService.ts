import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import fs from 'fs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

export type BulkOperationType = 'import_contacts' | 'import_products' | 'import_customers' | 'import_orders' | 'update_orders' | 'update_agents';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  warnings: string[];
  processedAt: Date;
}

export interface ImportOptions {
  teamId: string;
  userId: string;
  skipDuplicates?: boolean;
  validateOnly?: boolean;
  mapping?: Record<string, string>;
}

class BulkOperationsService {
  // Import contacts from CSV
  async importContacts(
    fileContent: string | Buffer,
    options: ImportOptions
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    const rows = await this.parseCsv(fileContent);
    logger.info(`Importing ${rows.length} contacts`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const phone = this.normalizePhone(row.phone || row.Phone || row.PHONE);
        if (!phone) {
          result.errors.push({ row: i + 1, error: 'Missing or invalid phone number', data: row });
          result.failed++;
          continue;
        }

        // Check for duplicate
        if (options.skipDuplicates) {
          const existing = await prisma.contact.findFirst({
            where: { phone, campaignId: row.campaignId || null },
          });
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Contact ${phone} already exists, skipping`);
            continue;
          }
        }

        if (!options.validateOnly) {
          await prisma.contact.create({
            data: {
              phone,
              name: row.name || row.Name || null,
              email: row.email || row.Email || null,
              campaignId: row.campaignId || null,
              isValid: true,
              metadata: JSON.stringify(row),
            },
          });
        }

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: i + 1, error: error.message, data: row });
        result.failed++;
      }
    }

    return result;
  }

  // Import products from CSV
  async importProducts(
    fileContent: string | Buffer,
    options: ImportOptions
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    const rows = await this.parseCsv(fileContent);
    logger.info(`Importing ${rows.length} products`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name || row.Name || row.product_name;
        if (!name) {
          result.errors.push({ row: i + 1, error: 'Missing product name', data: row });
          result.failed++;
          continue;
        }

        // Check for duplicate
        if (options.skipDuplicates) {
          const existing = await prisma.product.findFirst({
            where: { name, teamId: options.teamId },
          });
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Product "${name}" already exists, skipping`);
            continue;
          }
        }

        if (!options.validateOnly) {
          await prisma.product.create({
            data: {
              teamId: options.teamId,
              name,
              description: row.description || row.Description || '',
              category: row.category || row.Category || null,
              price: parseFloat(row.price || row.Price || '0') || null,
              details: row.details ? JSON.stringify(row.details) : null,
            },
          });
        }

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: i + 1, error: error.message, data: row });
        result.failed++;
      }
    }

    return result;
  }

  // Import customers from CSV
  async importCustomers(
    fileContent: string | Buffer,
    options: ImportOptions
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    const rows = await this.parseCsv(fileContent);
    logger.info(`Importing ${rows.length} customers`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const phone = this.normalizePhone(row.phone || row.Phone);
        const email = row.email || row.Email;

        if (!phone && !email) {
          result.errors.push({ row: i + 1, error: 'Missing phone and email', data: row });
          result.failed++;
          continue;
        }

        // Check for duplicate
        if (options.skipDuplicates) {
          const existing = await prisma.customer.findFirst({
            where: {
              OR: [
                phone ? { phone } : {},
                email ? { email } : {},
              ].filter((o) => Object.keys(o).length > 0),
              teamId: options.teamId,
            },
          });
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Customer ${phone || email} already exists, skipping`);
            continue;
          }
        }

        if (!options.validateOnly) {
          await prisma.customer.create({
            data: {
              teamId: options.teamId,
              phone,
              email,
              name: row.name || row.Name || null,
              address: row.address || row.Address || null,
            },
          });
        }

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: i + 1, error: error.message, data: row });
        result.failed++;
      }
    }

    return result;
  }

  // Bulk update order statuses
  async bulkUpdateOrders(
    orderIds: string[],
    updates: { status?: string; notes?: string },
    options: { teamId: string; userId: string }
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    for (const orderId of orderIds) {
      try {
        const order = await prisma.order.findFirst({
          where: { id: orderId, teamId: options.teamId },
        });

        if (!order) {
          result.errors.push({ row: 0, error: `Order ${orderId} not found` });
          result.failed++;
          continue;
        }

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: updates.status || order.status,
            notes: updates.notes ? `${order.notes || ''}\n${updates.notes}` : order.notes,
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            teamId: options.teamId,
            userId: options.userId,
            action: 'bulk_update',
            resourceType: 'order',
            resourceId: orderId,
            details: JSON.stringify(updates),
          },
        });

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: 0, error: error.message, data: { orderId } });
        result.failed++;
      }
    }

    return result;
  }

  // Bulk update agent availability
  async bulkUpdateAgents(
    agentIds: string[],
    updates: { availabilityStatus?: string; maxConcurrentCalls?: number },
    options: { teamId: string; userId: string }
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    for (const agentId of agentIds) {
      try {
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, teamId: options.teamId },
        });

        if (!agent) {
          result.errors.push({ row: 0, error: `Agent ${agentId} not found` });
          result.failed++;
          continue;
        }

        await prisma.agent.update({
          where: { id: agentId },
          data: {
            availabilityStatus: updates.availabilityStatus || agent.availabilityStatus,
            maxConcurrentCalls: updates.maxConcurrentCalls ?? agent.maxConcurrentCalls,
          },
        });

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: 0, error: error.message, data: { agentId } });
        result.failed++;
      }
    }

    return result;
  }

  // Bulk delete with confirmation
  async bulkDelete(
    type: 'contacts' | 'products' | 'customers' | 'orders',
    ids: string[],
    options: { teamId: string; userId: string }
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      warnings: [],
      processedAt: new Date(),
    };

    const modelMap: Record<string, any> = {
      contacts: prisma.contact,
      products: prisma.product,
      customers: prisma.customer,
      orders: prisma.order,
    };

    const model = modelMap[type];
    if (!model) {
      result.errors.push({ row: 0, error: `Unknown type: ${type}` });
      return result;
    }

    for (const id of ids) {
      try {
        // Verify ownership for team-scoped resources
        if (['products', 'customers', 'orders'].includes(type)) {
          const item = await model.findFirst({
            where: { id, teamId: options.teamId },
          });

          if (!item) {
            result.errors.push({ row: 0, error: `${type} ${id} not found or access denied` });
            result.failed++;
            continue;
          }
        }

        await model.delete({ where: { id } });

        // Audit log
        await prisma.auditLog.create({
          data: {
            teamId: options.teamId,
            userId: options.userId,
            action: 'bulk_delete',
            resourceType: type,
            resourceId: id,
          },
        });

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: 0, error: error.message, data: { id } });
        result.failed++;
      }
    }

    return result;
  }

  // Helper: Parse CSV
  private async parseCsv(content: string | Buffer): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      const stream = typeof content === 'string'
        ? Readable.from([content])
        : Readable.from([content.toString()]);

      stream
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  // Helper: Normalize phone number
  private normalizePhone(phone: string | undefined): string | null {
    if (!phone) return null;

    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with + for international format
    if (!normalized.startsWith('+') && normalized.length === 10) {
      // Assume Indian number
      normalized = '+91' + normalized;
    } else if (!normalized.startsWith('+') && normalized.length > 10) {
      normalized = '+' + normalized;
    }

    // Validate length
    if (normalized.length < 10 || normalized.length > 15) {
      return null;
    }

    return normalized;
  }
}

export const bulkOperationsService = new BulkOperationsService();
export default bulkOperationsService;
