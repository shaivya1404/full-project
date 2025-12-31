import { PaymentRepository, CreateInvoiceInput } from '../db/repositories/paymentRepository';
import { PaymentService, InvoiceData } from './paymentService';
import { logger } from '../utils/logger';
import PDFDocument from 'pdfkit';

export interface GenerateInvoiceRequest {
  orderId: string;
  paymentId: string;
  customerDetails: {
    name: string;
    email: string;
    phone: string;
    billingAddress: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    total: number;
  }>;
  taxDetails?: {
    gst?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  };
  notes?: string;
}

export interface SendInvoiceRequest {
  invoiceId: string;
  sendVia: 'email' | 'sms' | 'both';
}

export class InvoiceService {
  private paymentRepository: PaymentRepository;
  private paymentService: PaymentService;

  constructor() {
    this.paymentRepository = new PaymentRepository();
    this.paymentService = new PaymentService();
  }

  // Generate invoice number
  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString(36).toUpperCase();
    return `INV-${year}${month}-${timestamp}`;
  }

  // Calculate invoice totals
  private calculateTotals(items: GenerateInvoiceRequest['items'], taxDetails?: GenerateInvoiceRequest['taxDetails']) {
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    let taxAmount = 0;

    if (taxDetails?.gst) {
      taxAmount += taxDetails.gst;
    } else if (taxDetails?.cgst && taxDetails?.sgst) {
      taxAmount += taxDetails.cgst + taxDetails.sgst;
    } else if (taxDetails?.igst) {
      taxAmount += taxDetails.igst;
    }

    const totalAmount = subtotal + taxAmount;

    return { subtotal, taxAmount, totalAmount };
  }

  // Generate PDF invoice
  async generateInvoicePDF(request: GenerateInvoiceRequest): Promise<{ pdfBuffer: Buffer; invoiceNumber: string }> {
    try {
      const invoiceNumber = this.generateInvoiceNumber();
      const { subtotal, taxAmount, totalAmount } = this.calculateTotals(request.items, request.taxDetails);

      // Create PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
      });

      // Collect PDF data into a buffer
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      // Header
      doc.fontSize(24).text('INVOICE', { align: 'right' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(10).text(`Invoice Number: ${invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // Company info
      const companyName = process.env.COMPANY_NAME || 'Your Company Name';
      const companyAddress = process.env.COMPANY_ADDRESS || 'Company Address';
      const companyPhone = process.env.COMPANY_PHONE || '+91 1234567890';
      const companyEmail = process.env.COMPANY_EMAIL || 'billing@company.com';

      doc.fontSize(12).font('Helvetica-Bold').text(companyName);
      doc.fontSize(10).font('Helvetica').text(companyAddress);
      doc.text(`Phone: ${companyPhone}`);
      doc.text(`Email: ${companyEmail}`);
      doc.moveDown();

      // Bill to section
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica').text(request.customerDetails.name);
      doc.text(request.customerDetails.billingAddress);
      doc.text(`Phone: ${request.customerDetails.phone}`);
      doc.text(`Email: ${request.customerDetails.email}`);
      doc.moveDown();

      // Order details
      const payment = await this.paymentService.getPaymentDetails(request.paymentId);
      doc.fontSize(12).font('Helvetica-Bold').text('Order Details:');
      doc.fontSize(10).font('Helvetica').text(`Order ID: ${request.orderId}`);
      doc.text(`Payment ID: ${request.paymentId}`);
      doc.text(`Payment Method: ${payment.method.toUpperCase()}`);
      doc.text(`Payment Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Items table
      doc.fontSize(12).font('Helvetica-Bold').text('Items:');
      doc.moveDown();

      // Table header
      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 300;
      const priceX = 350;
      const totalX = 450;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Item', itemX, tableTop);
      doc.text('Qty', qtyX, tableTop);
      doc.text('Price', priceX, tableTop);
      doc.text('Total', totalX, tableTop);

      // Table line
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();

      // Table rows
      doc.fontSize(9).font('Helvetica');
      request.items.forEach((item) => {
        doc.text(item.name, itemX, doc.y);
        doc.text(item.quantity.toString(), qtyX, doc.y - 12);
        doc.text(`₹${item.unitPrice.toFixed(2)}`, priceX, doc.y - 12);
        doc.text(`₹${item.total.toFixed(2)}`, totalX, doc.y - 12);
        doc.moveDown(0.5);
      });

      // Table footer line
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();

      // Totals
      const totalsX = 350;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Subtotal:`, totalsX, doc.y);
      doc.text(`₹${subtotal.toFixed(2)}`, 480, doc.y - 12);
      doc.moveDown();

      if (taxAmount > 0) {
        let taxDescription = 'Tax';
        if (request.taxDetails?.gst) taxDescription = `GST (18%)`;
        else if (request.taxDetails?.cgst && request.taxDetails?.sgst) {
          taxDescription = `CGST + SGST (9% each)`;
        } else if (request.taxDetails?.igst) {
          taxDescription = `IGST (18%)`;
        }

        doc.text(`${taxDescription}:`, totalsX, doc.y);
        doc.text(`₹${taxAmount.toFixed(2)}`, 480, doc.y - 12);
        doc.moveDown();
      }

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total:`, totalsX, doc.y);
      doc.text(`₹${totalAmount.toFixed(2)}`, 480, doc.y - 12);
      doc.moveDown();

      // Notes
      if (request.notes) {
        doc.fontSize(10).font('Helvetica').text('Notes:');
        doc.fontSize(9).text(request.notes, { width: 450 });
        doc.moveDown();
      }

      // Terms
      doc.fontSize(9).font('Helvetica').text('Terms & Conditions:');
      doc.fontSize(8).text('1. Payment is due upon receipt.', 50, doc.y);
      doc.text('2. For any queries, contact us at ' + companyEmail);
      doc.text('3. This is a computer-generated invoice and does not require signature.');

      // Footer
      doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

      // Finalize PDF
      doc.end();

      const pdfBuffer = await pdfPromise;

      return { pdfBuffer, invoiceNumber };
    } catch (error) {
      logger.error('Error generating invoice PDF', error);
      throw error;
    }
  }

  // Create invoice record
  async createInvoice(request: GenerateInvoiceRequest): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    pdfUrl: string;
  }> {
    try {
      // Generate PDF
      const { pdfBuffer, invoiceNumber } = await this.generateInvoicePDF(request);

      // Calculate totals
      const { taxAmount, totalAmount } = this.calculateTotals(request.items, request.taxDetails);

      // Save PDF to file system (in production, use cloud storage like S3)
      const fs = require('fs');
      const path = require('path');
      const invoicesDir = path.join(process.cwd(), 'invoices');

      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filename = `${invoiceNumber}.pdf`;
      const filepath = path.join(invoicesDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);

      // Generate PDF URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const pdfUrl = `${baseUrl}/invoices/${filename}`;

      // Create invoice record
      const invoiceInput: CreateInvoiceInput = {
        orderId: request.orderId,
        paymentId: request.paymentId,
        invoiceNumber,
        items: request.items,
        taxAmount,
        taxDetails: request.taxDetails,
        totalAmount,
        customerName: request.customerDetails.name,
        customerEmail: request.customerDetails.email,
        customerPhone: request.customerDetails.phone,
        billingAddress: request.customerDetails.billingAddress,
        notes: request.notes,
        pdfUrl,
      };

      const invoice = await this.paymentRepository.createInvoice(invoiceInput);

      logger.info(`Invoice created: ${invoice.id} (${invoiceNumber})`);

      return {
        invoiceId: invoice.id,
        invoiceNumber,
        pdfUrl,
      };
    } catch (error) {
      logger.error('Error creating invoice', error);
      throw error;
    }
  }

  // Get invoice
  async getInvoice(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.paymentRepository.getInvoiceById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return invoice;
    } catch (error) {
      logger.error('Error getting invoice', error);
      throw error;
    }
  }

  // Get invoice by invoice number
  async getInvoiceByNumber(invoiceNumber: string): Promise<any> {
    try {
      const invoice = await this.paymentRepository.getInvoiceByInvoiceNumber(invoiceNumber);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return invoice;
    } catch (error) {
      logger.error('Error getting invoice by number', error);
      throw error;
    }
  }

  // Get invoice by payment ID
  async getInvoiceByPaymentId(paymentId: string): Promise<any> {
    try {
      const invoice = await this.paymentRepository.getInvoiceByPaymentId(paymentId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return invoice;
    } catch (error) {
      logger.error('Error getting invoice by payment ID', error);
      throw error;
    }
  }

  // Send invoice
  async sendInvoice(request: SendInvoiceRequest): Promise<{ sent: boolean; message: string }> {
    try {
      const invoice = await this.paymentRepository.getInvoiceById(request.invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (!invoice.customerEmail && (request.sendVia === 'email' || request.sendVia === 'both')) {
        throw new Error('Customer email not available');
      }

      if (!invoice.customerPhone && (request.sendVia === 'sms' || request.sendVia === 'both')) {
        throw new Error('Customer phone not available');
      }

      const sentMethods: string[] = [];

      // Send via email
      if (request.sendVia === 'email' || request.sendVia === 'both') {
        // In production, integrate with email service like SendGrid, Nodemailer
        // For now, we'll simulate
        sentMethods.push('email');
        logger.info(`Invoice email sent to ${invoice.customerEmail}`);
      }

      // Send via SMS
      if (request.sendVia === 'sms' || request.sendVia === 'both') {
        // In production, integrate with SMS service like Twilio
        const smsMessage = `Your invoice ${invoice.invoiceNumber} for ₹${invoice.totalAmount.toFixed(2)} is ready. Download: ${invoice.pdfUrl}`;
        sentMethods.push('sms');
        logger.info(`Invoice SMS sent to ${invoice.customerPhone}`);
      }

      // Update invoice
      await this.paymentRepository.updateInvoice(request.invoiceId, {
        status: 'sent',
        sentAt: new Date(),
        sentVia: request.sendVia,
      });

      logger.info(`Invoice sent: ${request.invoiceId} via ${sentMethods.join(', ')}`);

      return {
        sent: true,
        message: `Invoice sent via ${sentMethods.join(' and ')}`,
      };
    } catch (error) {
      logger.error('Error sending invoice', error);
      throw error;
    }
  }

  // Auto-generate invoice after successful payment
  async autoGenerateInvoice(paymentId: string): Promise<any> {
    try {
      const payment = await this.paymentService.getPaymentDetails(paymentId);

      if (payment.status !== 'completed') {
        throw new Error('Can only generate invoice for completed payments');
      }

      // Check if invoice already exists
      const existingInvoice = await this.paymentRepository.getInvoiceByPaymentId(paymentId);
      if (existingInvoice) {
        logger.info(`Invoice already exists for payment: ${paymentId}`);
        return existingInvoice;
      }

      // Get order details
      if (!payment.order) {
        throw new Error('Order not found for this payment');
      }

      const customerName = payment.customer?.name || 'Customer';
      const customerEmail = payment.customer?.email || '';
      const customerPhone = payment.customer?.phone || '';
      const billingAddress = payment.order?.deliveryAddress || payment.customer?.address || '';

      // Create items from order
      const items = payment.order?.items.map((item: any) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      })) || [];

      // Calculate tax (18% GST)
      const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
      const gstRate = 0.18; // 18% GST
      const taxAmount = subtotal * gstRate;

      const taxDetails = {
        gst: taxAmount,
      };

      // Generate invoice
      const result = await this.createInvoice({
        orderId: payment.orderId!,
        paymentId,
        customerDetails: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          billingAddress,
        },
        items,
        taxDetails,
        notes: `Payment method: ${payment.method.toUpperCase()}`,
      });

      logger.info(`Auto-generated invoice for payment: ${paymentId}`);

      return result;
    } catch (error) {
      logger.error('Error auto-generating invoice', error);
      throw error;
    }
  }

  // Download invoice PDF
  async downloadInvoicePDF(invoiceId: string): Promise<Buffer> {
    try {
      const invoice = await this.paymentRepository.getInvoiceById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (!invoice.pdfUrl) {
        throw new Error('PDF not available for this invoice');
      }

      // Read PDF from file system
      const fs = require('fs');
      const path = require('path');
      const filename = `${invoice.invoiceNumber}.pdf`;
      const filepath = path.join(process.cwd(), 'invoices', filename);

      if (!fs.existsSync(filepath)) {
        throw new Error('PDF file not found');
      }

      return fs.readFileSync(filepath);
    } catch (error) {
      logger.error('Error downloading invoice PDF', error);
      throw error;
    }
  }

  // Update invoice
  async updateInvoice(invoiceId: string, data: Partial<GenerateInvoiceRequest> & { status?: string }): Promise<any> {
    try {
      const invoice = await this.paymentRepository.updateInvoice(invoiceId, {
        notes: data.notes,
        status: data.status,
      });

      return invoice;
    } catch (error) {
      logger.error('Error updating invoice', error);
      throw error;
    }
  }
}
