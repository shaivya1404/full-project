import PDFDocument from 'pdfkit';
import { createObjectCsvStringifier } from 'csv-writer';
import { prisma } from '../db/client';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type ExportFormat = 'csv' | 'pdf' | 'json';
export type ExportType = 'calls' | 'orders' | 'payments' | 'analytics' | 'agents' | 'campaigns' | 'customers' | 'invoices' | 'audit_logs';

export interface ExportFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  teamId?: string;
  search?: string;
  [key: string]: any;
}

export interface ExportResult {
  jobId: string;
  format: ExportFormat;
  filePath: string;
  fileUrl: string;
  recordCount: number;
  fileSize: number;
}

class ExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(config.RECORDING_STORAGE_PATH, 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  private generateFileName(type: ExportType, format: ExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `${type}_export_${timestamp}_${random}.${format}`;
  }

  async createExportJob(
    userId: string,
    teamId: string | undefined,
    type: ExportType,
    format: ExportFormat,
    filters: ExportFilters
  ): Promise<string> {
    const job = await prisma.exportJob.create({
      data: {
        userId,
        teamId,
        type,
        format,
        status: 'pending',
        filters: JSON.stringify(filters),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Process export asynchronously
    this.processExport(job.id).catch((error) => {
      logger.error('Export job failed', { jobId: job.id, error });
    });

    return job.id;
  }

  async processExport(jobId: string): Promise<void> {
    const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Export job not found');

    try {
      await prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'processing', startedAt: new Date() },
      });

      const filters = job.filters ? JSON.parse(job.filters) : {};
      const fileName = this.generateFileName(job.type as ExportType, job.format as ExportFormat);
      const filePath = path.join(this.exportDir, fileName);

      let result: { content: Buffer | string; recordCount: number };

      switch (job.type) {
        case 'calls':
          result = await this.exportCalls(job.format as ExportFormat, filters);
          break;
        case 'orders':
          result = await this.exportOrders(job.format as ExportFormat, filters);
          break;
        case 'payments':
          result = await this.exportPayments(job.format as ExportFormat, filters);
          break;
        case 'analytics':
          result = await this.exportAnalytics(job.format as ExportFormat, filters);
          break;
        case 'agents':
          result = await this.exportAgents(job.format as ExportFormat, filters);
          break;
        case 'campaigns':
          result = await this.exportCampaigns(job.format as ExportFormat, filters);
          break;
        case 'customers':
          result = await this.exportCustomers(job.format as ExportFormat, filters);
          break;
        case 'invoices':
          result = await this.exportInvoices(job.format as ExportFormat, filters);
          break;
        case 'audit_logs':
          result = await this.exportAuditLogs(job.format as ExportFormat, filters);
          break;
        default:
          throw new Error(`Unknown export type: ${job.type}`);
      }

      // Write file
      fs.writeFileSync(filePath, result.content);
      const stats = fs.statSync(filePath);

      await prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          filePath,
          fileUrl: `/api/export/download/${jobId}`,
          fileSize: stats.size,
          recordCount: result.recordCount,
          completedAt: new Date(),
        },
      });

      logger.info('Export job completed', { jobId, recordCount: result.recordCount });
    } catch (error) {
      logger.error('Export job failed', { jobId, error });
      await prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async getExportJob(jobId: string): Promise<any> {
    return prisma.exportJob.findUnique({ where: { id: jobId } });
  }

  async getExportJobs(userId: string, limit = 20): Promise<any[]> {
    return prisma.exportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async downloadExport(jobId: string): Promise<{ filePath: string; fileName: string } | null> {
    const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'completed' || !job.filePath) {
      return null;
    }

    if (!fs.existsSync(job.filePath)) {
      return null;
    }

    return {
      filePath: job.filePath,
      fileName: path.basename(job.filePath),
    };
  }

  // Export implementations
  private async exportCalls(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.startDate) where.startTime = { gte: filters.startDate };
    if (filters.endDate) where.startTime = { ...where.startTime, lte: filters.endDate };
    if (filters.status) where.status = filters.status;

    const calls = await prisma.call.findMany({
      where,
      include: {
        analytics: true,
        recordings: true,
      },
      orderBy: { startTime: 'desc' },
      take: 10000,
    });

    const data = calls.map((call) => ({
      id: call.id,
      caller: call.caller,
      agent: call.agent || 'N/A',
      startTime: call.startTime.toISOString(),
      endTime: call.endTime?.toISOString() || '',
      duration: call.duration || 0,
      status: call.status,
      sentiment: call.analytics?.[0]?.sentiment || 'N/A',
      notes: call.notes || '',
    }));

    return this.formatData(data, format, 'Calls Export');
  }

  private async exportOrders(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.startDate) where.orderTime = { gte: filters.startDate };
    if (filters.endDate) where.orderTime = { ...where.orderTime, lte: filters.endDate };
    if (filters.status) where.status = filters.status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        customer: true,
      },
      orderBy: { orderTime: 'desc' },
      take: 10000,
    });

    const data = orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || order.phone || 'N/A',
      customerPhone: order.phone || order.customer?.phone || '',
      customerEmail: order.email || order.customer?.email || '',
      status: order.status,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
      items: order.items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
      deliveryAddress: order.deliveryAddress || '',
      orderTime: order.orderTime.toISOString(),
      notes: order.notes || '',
    }));

    return this.formatData(data, format, 'Orders Export');
  }

  private async exportPayments(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.startDate) where.timestamp = { gte: filters.startDate };
    if (filters.endDate) where.timestamp = { ...where.timestamp, lte: filters.endDate };
    if (filters.status) where.status = filters.status;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        order: true,
        customer: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    const data = payments.map((payment) => ({
      id: payment.id,
      transactionId: payment.transactionId || '',
      orderNumber: payment.order?.orderNumber || 'N/A',
      customerName: payment.customer?.name || '',
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      gateway: payment.gateway,
      timestamp: payment.timestamp.toISOString(),
      completedAt: payment.completedAt?.toISOString() || '',
      failureReason: payment.failureReason || '',
      refundAmount: payment.refundAmount || 0,
      refundStatus: payment.refundStatus || '',
    }));

    return this.formatData(data, format, 'Payments Export');
  }

  private async exportAnalytics(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.startDate) where.snapshotTime = { gte: filters.startDate };
    if (filters.endDate) where.snapshotTime = { ...where.snapshotTime, lte: filters.endDate };

    const analytics = await prisma.analytics.findMany({
      where,
      include: {
        call: true,
      },
      orderBy: { snapshotTime: 'desc' },
      take: 10000,
    });

    const data = analytics.map((a) => ({
      callId: a.callId,
      caller: a.call.caller,
      sentiment: a.sentiment || 'N/A',
      sentimentScore: a.sentimentScore || 0,
      talkTime: a.talkTime || 0,
      silenceTime: a.silenceTime || 0,
      interruptions: a.interruptions || 0,
      averageLatency: a.averageLatency || 0,
      snapshotTime: a.snapshotTime.toISOString(),
    }));

    return this.formatData(data, format, 'Analytics Export');
  }

  private async exportAgents(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;

    const agents = await prisma.agent.findMany({
      where,
      include: {
        sessions: {
          take: 10,
          orderBy: { startTime: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      role: agent.role,
      status: agent.availabilityStatus,
      skills: agent.skills || '',
      maxConcurrentCalls: agent.maxConcurrentCalls,
      totalSessions: agent.sessions.length,
      createdAt: agent.createdAt.toISOString(),
    }));

    return this.formatData(data, format, 'Agents Export');
  }

  private async exportCampaigns(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.status) where.status = filters.status;

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        contacts: true,
        callLogs: true,
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      totalContacts: campaign.contacts.length,
      validContacts: campaign.contacts.filter((c) => c.isValid).length,
      totalCalls: campaign.callLogs.length,
      successfulCalls: campaign.callLogs.filter((c) => c.result === 'success').length,
      successRate: campaign.analytics?.successRate || 0,
      roi: campaign.analytics?.roi || 0,
      startDate: campaign.startDate?.toISOString() || '',
      endDate: campaign.endDate?.toISOString() || '',
      createdAt: campaign.createdAt.toISOString(),
    }));

    return this.formatData(data, format, 'Campaigns Export');
  }

  private async exportCustomers(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;

    const customers = await prisma.customer.findMany({
      where,
      include: {
        orders: { take: 5, orderBy: { orderTime: 'desc' } },
        preferences: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const data = customers.map((customer) => ({
      id: customer.id,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      previousOrders: customer.previousOrders,
      totalOrderValue: customer.orders.reduce((sum, o) => sum + o.totalAmount, 0),
      lastOrderDate: customer.orders[0]?.orderTime.toISOString() || '',
      dietaryRestrictions: customer.preferences?.dietaryRestrictions || '',
      allergies: customer.preferences?.allergies || '',
      createdAt: customer.createdAt.toISOString(),
    }));

    return this.formatData(data, format, 'Customers Export');
  }

  private async exportInvoices(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.startDate) where.createdAt = { gte: filters.startDate };
    if (filters.endDate) where.createdAt = { ...where.createdAt, lte: filters.endDate };
    if (filters.status) where.status = filters.status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        order: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const data = invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: invoice.order?.orderNumber || '',
      customerName: invoice.customerName || '',
      customerEmail: invoice.customerEmail || '',
      customerPhone: invoice.customerPhone || '',
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      currency: invoice.currency,
      status: invoice.status,
      sentAt: invoice.sentAt?.toISOString() || '',
      sentVia: invoice.sentVia || '',
      createdAt: invoice.createdAt.toISOString(),
    }));

    return this.formatData(data, format, 'Invoices Export');
  }

  private async exportAuditLogs(format: ExportFormat, filters: ExportFilters): Promise<{ content: Buffer | string; recordCount: number }> {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.startDate) where.createdAt = { gte: filters.startDate };
    if (filters.endDate) where.createdAt = { ...where.createdAt, lte: filters.endDate };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const data = logs.map((log) => ({
      id: log.id,
      userId: log.userId || '',
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId || '',
      details: log.details || '',
      ipAddress: log.ipAddress || '',
      userAgent: log.userAgent || '',
      createdAt: log.createdAt.toISOString(),
    }));

    return this.formatData(data, format, 'Audit Logs Export');
  }

  private formatData(
    data: Record<string, any>[],
    format: ExportFormat,
    title: string
  ): { content: Buffer | string; recordCount: number } {
    const recordCount = data.length;

    switch (format) {
      case 'csv':
        return { content: this.generateCsv(data), recordCount };
      case 'pdf':
        return { content: this.generatePdf(data, title), recordCount };
      case 'json':
        return { content: JSON.stringify(data, null, 2), recordCount };
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  private generateCsv(data: Record<string, any>[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvStringifier = createObjectCsvStringifier({
      header: headers.map((h) => ({ id: h, title: h })),
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);
  }

  private generatePdf(data: Record<string, any>[], title: string): Buffer {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Header
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.fontSize(10).text(`Total Records: ${data.length}`, { align: 'center' });
    doc.moveDown(2);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const colWidth = (doc.page.width - 60) / Math.min(headers.length, 8);

      // Table header
      doc.fontSize(8).font('Helvetica-Bold');
      let xPos = 30;
      headers.slice(0, 8).forEach((header) => {
        doc.text(header.substring(0, 15), xPos, doc.y, { width: colWidth, align: 'left' });
        xPos += colWidth;
      });
      doc.moveDown();

      // Table rows
      doc.font('Helvetica');
      data.slice(0, 100).forEach((row) => {
        xPos = 30;
        const yPos = doc.y;

        headers.slice(0, 8).forEach((header) => {
          const value = String(row[header] || '').substring(0, 20);
          doc.text(value, xPos, yPos, { width: colWidth, align: 'left' });
          xPos += colWidth;
        });
        doc.moveDown(0.5);

        // Check for page break
        if (doc.y > doc.page.height - 50) {
          doc.addPage();
        }
      });

      if (data.length > 100) {
        doc.moveDown();
        doc.text(`... and ${data.length - 100} more records. Download CSV for full data.`, { align: 'center' });
      }
    }

    // Footer
    doc.fontSize(8).text(
      `${config.COMPANY_NAME} | ${config.COMPANY_EMAIL}`,
      30,
      doc.page.height - 30,
      { align: 'center' }
    );

    doc.end();

    return Buffer.concat(chunks);
  }

  // Cleanup expired exports
  async cleanupExpiredExports(): Promise<number> {
    const expiredJobs = await prisma.exportJob.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    let deleted = 0;
    for (const job of expiredJobs) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
      await prisma.exportJob.delete({ where: { id: job.id } });
      deleted++;
    }

    logger.info(`Cleaned up ${deleted} expired export jobs`);
    return deleted;
  }
}

export const exportService = new ExportService();
export default exportService;
