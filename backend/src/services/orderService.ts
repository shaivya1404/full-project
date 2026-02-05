import { OrderRepository, CreateOrderInput, UpdateOrderInput, CustomerPreferenceInput } from '../db/repositories/orderRepository';
import { logger } from '../utils/logger';
import { notifyOrderUpdate } from './websocketService';

export interface OrderItemInput {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

export interface CreateOrderRequest {
  teamId?: string;
  campaignId?: string;
  callId?: string;
  items: OrderItemInput[];
  deliveryAddress?: string;
  phone?: string;
  email?: string;
  customerName?: string;
  notes?: string;
  specialInstructions?: string;
  validateOnly?: boolean;
}

export interface CustomerData {
  phone?: string;
  email?: string;
  name?: string;
  address?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  items: OrderItemInput[];
  deliveryAddress: string;
  phone: string;
  email?: string;
  estimatedReadyTime?: Date;
}

export class OrderService {
  private orderRepository: OrderRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
  }

  // Validation Methods

  validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-()]{10,15}$/;
    return phoneRegex.test(phone);
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateAddress(address: string): boolean {
    if (!address || address.trim().length < 10) {
      return false;
    }
    const addressRegex = /^[a-zA-Z0-9\s,.\-#]+$/;
    return addressRegex.test(address);
  }

  validateOrderItems(items: OrderItemInput[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('Order must have at least one item');
      return { valid: false, errors };
    }

    const minOrderAmount = 5.0;
    let totalAmount = 0;

    items.forEach((item, index) => {
      if (!item.productName || item.productName.trim() === '') {
        errors.push(`Item ${index + 1}: Product name is required`);
      }
      if (item.quantity < 1) {
        errors.push(`Item ${index + 1}: Quantity must be at least 1`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Price cannot be negative`);
      }
      if (item.quantity > 50) {
        warnings.push(`Item ${index + 1}: Large quantity order (${item.quantity})`);
      }
      totalAmount += item.unitPrice * item.quantity;
    });

    if (totalAmount < minOrderAmount) {
      errors.push(`Minimum order amount is $${minOrderAmount.toFixed(2)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCustomerData(data: CustomerData): ValidationResult {
    const errors: string[] = [];

    if (!data.phone && !data.email) {
      errors.push('At least one contact method (phone or email) is required');
    }

    if (data.phone && !this.validatePhone(data.phone)) {
      errors.push('Invalid phone number format');
    }

    if (data.email && !this.validateEmail(data.email)) {
      errors.push('Invalid email address format');
    }

    if (data.address && !this.validateAddress(data.address)) {
      errors.push('Invalid delivery address format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async checkForDuplicates(customerId: string, items: OrderItemInput[]): Promise<any | null> {
    const recentOrders = await this.orderRepository.getDuplicateOrders(customerId, 5);
    
    if (recentOrders.length === 0) {
      return null;
    }

    for (const order of recentOrders) {
      const orderItems = await this.orderRepository.getOrderItems(order.id);
      const itemNames = orderItems.map((i) => i.productName).sort();
      const newItemNames = items.map((i) => i.productName).sort();

      if (JSON.stringify(itemNames) === JSON.stringify(newItemNames)) {
        return recentOrders as any;
      }
    }

    return null;
  }

  async validateOrder(request: CreateOrderRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate items
    const itemsValidation = this.validateOrderItems(request.items);
    if (!itemsValidation.valid) {
      errors.push(...itemsValidation.errors);
    }
    if (itemsValidation.warnings) {
      warnings.push(...itemsValidation.warnings);
    }

    // Validate customer data
    const customerData: CustomerData = {
      phone: request.phone,
      email: request.email,
      address: request.deliveryAddress,
    };
    const customerValidation = this.validateCustomerData(customerData);
    if (!customerValidation.valid) {
      errors.push(...customerValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Order Operations

  async createOrder(request: CreateOrderRequest): Promise<{
    order: any;
    validation: ValidationResult;
    duplicateWarning?: string;
  }> {
    const validation = await this.validateOrder(request);

    if (!validation.valid) {
      return {
        order: null,
        validation,
      };
    }

    try {
      // Find or create customer
      const customer = await this.orderRepository.findOrCreateCustomer({
        phone: request.phone,
        email: request.email,
        name: request.customerName,
        address: request.deliveryAddress,
        teamId: request.teamId,
      });

      // Check for duplicates
      const duplicates = await this.checkForDuplicates(customer.id, request.items);

      // Calculate total amount
      const totalAmount = request.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );

      const order = await this.orderRepository.createOrder({
        teamId: request.teamId,
        campaignId: request.campaignId,
        callId: request.callId,
        customerId: customer.id,
        status: 'pending',
        items: request.items,
        totalAmount,
        deliveryAddress: request.deliveryAddress,
        phone: request.phone,
        email: request.email,
        notes: request.notes,
        specialInstructions: request.specialInstructions,
      });

      logger.info(`Order created: ${order.orderNumber} for customer ${customer.id}`);

      // Notify dashboard about new order
      if (request.teamId) {
        notifyOrderUpdate(request.teamId, order.id, 'pending', {
          orderNumber: order.orderNumber,
          customerName: customer.name,
          totalAmount,
          itemCount: request.items.length,
        });
      }

      return {
        order,
        validation,
        duplicateWarning: duplicates
          ? 'This appears to be a duplicate order. Please confirm you want to place a new order.'
          : undefined,
      };
    } catch (error) {
      logger.error('Error creating order', error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<any> {
    return this.orderRepository.getOrderById(orderId);
  }

  async getOrderByNumber(orderNumber: string): Promise<any> {
    return this.orderRepository.getOrderByOrderNumber(orderNumber);
  }

  async getOrderByCallId(callId: string): Promise<any> {
    return this.orderRepository.getOrderByCallId(callId);
  }

  async updateOrder(orderId: string, data: UpdateOrderInput): Promise<any> {
    return this.orderRepository.updateOrder(orderId, data);
  }

  async cancelOrder(orderId: string, reason: string): Promise<any> {
    const order = await this.orderRepository.updateOrderStatus(orderId, 'cancelled', reason);
    if (order?.teamId) {
      notifyOrderUpdate(order.teamId, orderId, 'cancelled', { reason });
    }
    return order;
  }

  async confirmOrder(orderId: string): Promise<any> {
    const order = await this.orderRepository.updateOrderStatus(orderId, 'confirmed');
    if (order?.teamId) {
      notifyOrderUpdate(order.teamId, orderId, 'confirmed');
    }
    return order;
  }

  async processOrder(orderId: string): Promise<any> {
    const order = await this.orderRepository.updateOrderStatus(orderId, 'processing');
    if (order?.teamId) {
      notifyOrderUpdate(order.teamId, orderId, 'processing');
    }
    return order;
  }

  async markOrderReady(orderId: string): Promise<any> {
    const order = await this.orderRepository.updateOrderStatus(orderId, 'ready');
    if (order?.teamId) {
      notifyOrderUpdate(order.teamId, orderId, 'ready');
    }
    return order;
  }

  async markOrderDelivered(orderId: string): Promise<any> {
    const order = await this.orderRepository.updateOrderStatus(orderId, 'delivered');
    if (order?.teamId) {
      notifyOrderUpdate(order.teamId, orderId, 'delivered');
    }
    return order;
  }

  async deleteOrder(orderId: string): Promise<void> {
    await this.orderRepository.deleteOrder(orderId);
  }

  // Order Search

  async searchOrders(
    options: {
      limit?: number;
      offset?: number;
      customerId?: string;
      status?: string;
      campaignId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    teamId?: string,
  ): Promise<{ orders: any[]; total: number }> {
    return this.orderRepository.searchOrders(
      options.limit || 10,
      options.offset || 0,
      {
        customerId: options.customerId,
        status: options.status,
        campaignId: options.campaignId,
        startDate: options.startDate,
        endDate: options.endDate,
      },
      teamId,
    );
  }

  async getPendingOrders(teamId?: string): Promise<any[]> {
    return this.orderRepository.getOrdersByStatus('pending', 100, teamId);
  }

  async getCompletedOrders(teamId?: string): Promise<any[]> {
    return this.orderRepository.getOrdersByStatus('delivered', 100, teamId);
  }

  // Customer Operations

  async getCustomer(customerId: string): Promise<any> {
    return this.orderRepository.getCustomerById(customerId);
  }

  async searchCustomers(
    options: {
      limit?: number;
      offset?: number;
      phone?: string;
      email?: string;
    },
    teamId?: string,
  ): Promise<{ customers: any[]; total: number }> {
    return this.orderRepository.searchCustomers(
      options.limit || 10,
      options.offset || 0,
      {
        teamId,
        phone: options.phone,
        email: options.email,
      },
    );
  }

  async updateCustomer(customerId: string, data: {
    phone?: string;
    email?: string;
    address?: string;
    name?: string;
  }): Promise<any> {
    return this.orderRepository.updateCustomer(customerId, data);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.orderRepository.deleteCustomer(customerId);
  }

  // Customer Preferences

  async getCustomerPreferences(customerId: string): Promise<any> {
    const prefs = await this.orderRepository.getCustomerPreferences(customerId);
    if (prefs) {
      return {
        ...prefs,
        favoriteItems: prefs.favoriteItems ? JSON.parse(prefs.favoriteItems) : [],
        dietaryRestrictions: prefs.dietaryRestrictions ? JSON.parse(prefs.dietaryRestrictions) : [],
        allergies: prefs.allergies ? JSON.parse(prefs.allergies) : [],
      };
    }
    return null;
  }

  async saveCustomerPreferences(customerId: string, preferences: CustomerPreferenceInput): Promise<any> {
    return this.orderRepository.createOrUpdateCustomerPreferences(customerId, preferences);
  }

  async updatePreferencesFromOrder(customerId: string, items: OrderItemInput[]): Promise<void> {
    const existingPrefs = await this.orderRepository.getCustomerPreferences(customerId);
    
    const favoriteItems = existingPrefs?.favoriteItems 
      ? JSON.parse(existingPrefs.favoriteItems) as string[]
      : [];

    items.forEach((item) => {
      if (!favoriteItems.includes(item.productName)) {
        favoriteItems.push(item.productName);
      }
    });

    await this.orderRepository.createOrUpdateCustomerPreferences(customerId, {
      favoriteItems: favoriteItems.slice(-10),
    });
  }

  // Analytics

  async getTopItems(limit: number = 10, teamId?: string): Promise<any[]> {
    return this.orderRepository.getTopOrderedItems(limit, teamId);
  }

  async getOrderTrends(startDate: Date, endDate: Date, teamId?: string): Promise<any[]> {
    return this.orderRepository.getOrderTrends(startDate, endDate, teamId);
  }

  async getOrderStats(teamId?: string): Promise<{
    byStatus: Record<string, number>;
    topItems: any[];
    frequentCustomers: any[];
  }> {
    const [byStatus, topItems, frequentCustomers] = await Promise.all([
      this.orderRepository.getOrderCountByStatus(teamId),
      this.orderRepository.getTopOrderedItems(10, teamId),
      this.orderRepository.getMostFrequentCustomers(10, teamId),
    ]);

    return { byStatus, topItems, frequentCustomers };
  }

  // Extract customer data from call transcript

  extractCustomerDataFromTranscript(transcript: string): Partial<CustomerData> {
    const data: Partial<CustomerData> = {};

    // Simple regex patterns for extracting info from transcript
    // In production, this would use NLP or LLM

    const phonePattern = /(?:phone|call|number)[:\s]*(\+?[\d\s\-()]{10,})/i;
    const emailPattern = /(?:email|mail)[:\s]*([^\s@]+@[^\s@]+\.[^\s@]+)/i;
    const namePattern = /(?:my name is|this is|I'm|is)[\s:]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i;
    const addressPattern = /(?:address|delivery)[:\s]*([a-zA-Z0-9\s,.\-#]+)/i;

    const phoneMatch = transcript.match(phonePattern);
    if (phoneMatch) {
      data.phone = phoneMatch[1].trim();
    }

    const emailMatch = transcript.match(emailPattern);
    if (emailMatch) {
      data.email = emailMatch[1].trim();
    }

    const nameMatch = transcript.match(namePattern);
    if (nameMatch && (!data.phone || data.phone.length < 10)) {
      data.name = nameMatch[1].trim();
    }

    const addressMatch = transcript.match(addressPattern);
    if (addressMatch) {
      data.address = addressMatch[1].trim();
    }

    return data;
  }

  // Extract order items from transcript

  extractOrderItemsFromTranscript(transcript: string): OrderItemInput[] {
    const items: OrderItemInput[] = [];

    // Pattern to match common order phrases
    const orderPatterns = [
      /(?:I'd like|can I get|can you add|order|get)[\s:]*(\d+)?[\s]*([a-zA-Z\s]+)[\s]*(?:please|thanks|thank you)?/gi,
      /(?:number|qty|quantity)[:\s]*(\d+)[\s]*(?:of)?[\s]*([a-zA-Z\s]+)/gi,
    ];

    // Common product keywords to filter
    const productKeywords = ['pizza', 'burger', 'fries', 'drink', 'soda', 'salad', 'sandwich', 'pasta', 'wings', 'chicken', 'steak', 'fish', 'soup'];

    for (const pattern of orderPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        let quantity = 1;
        let productName = '';

        if (match[1] && match[2]) {
          quantity = parseInt(match[1]) || 1;
          productName = match[2].trim();
        } else if (match[1]) {
          productName = match[1].trim();
        }

        // Clean up product name
        productName = productName.replace(/^(a |an |one |two )/i, '').trim();

        // Filter out non-product matches
        const isProduct = productKeywords.some(keyword => 
          productName.toLowerCase().includes(keyword)
        );

        if (productName.length > 2 && (isProduct || productName.includes(' '))) {
          items.push({
            productName,
            quantity,
            unitPrice: 0, // Would be looked up from menu
          });
        }
      }
    }

    // Remove duplicates
    const uniqueItems = items.reduce((acc, item) => {
      const existing = acc.find(i => i.productName.toLowerCase() === item.productName.toLowerCase());
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        acc.push(item);
      }
      return acc;
    }, [] as OrderItemInput[]);

    return uniqueItems;
  }
}

export const getOrderService = (): OrderService => {
  return new OrderService();
};
