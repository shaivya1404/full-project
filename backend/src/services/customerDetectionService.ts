import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Customer, Order, CustomerPreference } from '@prisma/client';

export interface CustomerWithDetails extends Customer {
  preferences?: CustomerPreference | null;
  recentOrders?: Order[];
}

export interface OrderSuggestion {
  productId: string;
  productName: string;
  quantity: number;
  lastOrdered: Date;
  orderCount: number;
}

export interface CustomerInsights {
  customerId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: Date | null;
  favoriteItems: string[];
  orderFrequency: string; // daily, weekly, monthly, occasional
  customerSince: Date;
}

export class CustomerDetectionService {
  /**
   * Find customer by phone number
   */
  async findByPhone(phoneNumber: string, teamId?: string): Promise<CustomerWithDetails | null> {
    const normalizedPhone = this.normalizePhone(phoneNumber);

    const where: any = {
      OR: [
        { phone: normalizedPhone },
        { phone: phoneNumber },
        { phone: { endsWith: phoneNumber.slice(-10) } }
      ]
    };

    if (teamId) {
      where.teamId = teamId;
    }

    const customer = await prisma.customer.findFirst({
      where,
      include: {
        preferences: true,
        orders: {
          orderBy: { orderTime: 'desc' },
          take: 5
        }
      }
    });

    if (customer) {
      return {
        ...customer,
        recentOrders: customer.orders
      };
    }

    return null;
  }

  /**
   * Get customer order history
   */
  async getOrderHistory(
    customerId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ orders: Order[]; total: number }> {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        orderBy: { orderTime: 'desc' },
        include: {
          items: true
        },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where: { customerId } })
    ]);

    return { orders, total };
  }

  /**
   * Get last order for a customer
   */
  async getLastOrder(customerId: string): Promise<Order | null> {
    return prisma.order.findFirst({
      where: { customerId },
      orderBy: { orderTime: 'desc' },
      include: {
        items: true
      }
    });
  }

  /**
   * Get customer preferences
   */
  async getPreferences(customerId: string): Promise<CustomerPreference | null> {
    return prisma.customerPreference.findUnique({
      where: { customerId }
    });
  }

  /**
   * Update customer preferences
   */
  async updatePreferences(
    customerId: string,
    preferences: {
      favoriteItems?: string[];
      dietaryRestrictions?: string[];
      allergies?: string[];
      deliveryNotes?: string;
    }
  ): Promise<CustomerPreference> {
    return prisma.customerPreference.upsert({
      where: { customerId },
      create: {
        customerId,
        favoriteItems: preferences.favoriteItems ? JSON.stringify(preferences.favoriteItems) : null,
        dietaryRestrictions: preferences.dietaryRestrictions ? JSON.stringify(preferences.dietaryRestrictions) : null,
        allergies: preferences.allergies ? JSON.stringify(preferences.allergies) : null,
        deliveryNotes: preferences.deliveryNotes
      },
      update: {
        favoriteItems: preferences.favoriteItems ? JSON.stringify(preferences.favoriteItems) : undefined,
        dietaryRestrictions: preferences.dietaryRestrictions ? JSON.stringify(preferences.dietaryRestrictions) : undefined,
        allergies: preferences.allergies ? JSON.stringify(preferences.allergies) : undefined,
        deliveryNotes: preferences.deliveryNotes
      }
    });
  }

  /**
   * Suggest items for reorder based on history
   */
  async suggestReorder(customerId: string, limit: number = 5): Promise<OrderSuggestion[]> {
    // Get all orders with items
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: { in: ['completed', 'delivered'] }
      },
      include: {
        items: true
      },
      orderBy: { orderTime: 'desc' }
    });

    if (orders.length === 0) return [];

    // Aggregate items by product
    const itemStats: Record<string, {
      productId: string;
      productName: string;
      totalQuantity: number;
      orderCount: number;
      lastOrdered: Date;
    }> = {};

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId || item.productName;

        if (!itemStats[key]) {
          itemStats[key] = {
            productId: item.productId || '',
            productName: item.productName,
            totalQuantity: 0,
            orderCount: 0,
            lastOrdered: order.orderTime
          };
        }

        itemStats[key].totalQuantity += item.quantity;
        itemStats[key].orderCount++;
      }
    }

    // Sort by order count (frequency) and return top items
    const suggestions = Object.values(itemStats)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, limit)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: Math.round(item.totalQuantity / item.orderCount), // Average quantity
        lastOrdered: item.lastOrdered,
        orderCount: item.orderCount
      }));

    return suggestions;
  }

  /**
   * Update customer data from a call
   */
  async updateFromCall(
    customerId: string,
    callData: {
      name?: string;
      email?: string;
      address?: string;
      notes?: string;
    }
  ): Promise<void> {
    const updateData: any = {};

    if (callData.name) updateData.name = callData.name;
    if (callData.email) updateData.email = callData.email;
    if (callData.address) updateData.address = callData.address;

    if (Object.keys(updateData).length > 0) {
      await prisma.customer.update({
        where: { id: customerId },
        data: updateData
      });
    }

    // Update delivery notes in preferences if provided
    if (callData.notes) {
      await prisma.customerPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          deliveryNotes: callData.notes
        },
        update: {
          deliveryNotes: callData.notes
        }
      });
    }

    logger.info(`Customer ${customerId} updated from call`);
  }

  /**
   * Create new customer
   */
  async createCustomer(
    teamId: string,
    data: {
      phone: string;
      name?: string;
      email?: string;
      address?: string;
    }
  ): Promise<Customer> {
    return prisma.customer.create({
      data: {
        teamId,
        phone: this.normalizePhone(data.phone),
        name: data.name,
        email: data.email,
        address: data.address,
        previousOrders: 0
      }
    });
  }

  /**
   * Get or create customer by phone
   */
  async getOrCreateByPhone(
    teamId: string,
    phoneNumber: string,
    defaultData?: { name?: string; email?: string }
  ): Promise<Customer> {
    let customer = await this.findByPhone(phoneNumber, teamId);

    if (!customer) {
      customer = await this.createCustomer(teamId, {
        phone: phoneNumber,
        name: defaultData?.name,
        email: defaultData?.email
      });
      logger.info(`New customer created for phone ${phoneNumber}`);
    }

    return customer;
  }

  /**
   * Get customer insights
   */
  async getCustomerInsights(customerId: string): Promise<CustomerInsights | null> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          where: { status: { in: ['completed', 'delivered'] } },
          include: { items: true }
        },
        preferences: true
      }
    });

    if (!customer) return null;

    const orders = customer.orders;
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Get last order date
    const sortedOrders = [...orders].sort((a, b) =>
      new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime()
    );
    const lastOrderDate = sortedOrders.length > 0 ? sortedOrders[0].orderTime : null;

    // Calculate order frequency
    let orderFrequency = 'occasional';
    if (totalOrders >= 2) {
      const firstOrder = sortedOrders[sortedOrders.length - 1].orderTime;
      const lastOrder = sortedOrders[0].orderTime;
      const daysBetween = Math.ceil(
        (new Date(lastOrder).getTime() - new Date(firstOrder).getTime()) / (1000 * 60 * 60 * 24)
      );
      const avgDaysBetweenOrders = daysBetween / (totalOrders - 1);

      if (avgDaysBetweenOrders <= 3) orderFrequency = 'daily';
      else if (avgDaysBetweenOrders <= 10) orderFrequency = 'weekly';
      else if (avgDaysBetweenOrders <= 35) orderFrequency = 'monthly';
    }

    // Get favorite items
    const itemCounts: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productName;
        itemCounts[key] = (itemCounts[key] || 0) + item.quantity;
      }
    }
    const favoriteItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      customerId,
      totalOrders,
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      lastOrderDate,
      favoriteItems,
      orderFrequency,
      customerSince: customer.createdAt
    };
  }

  /**
   * Search customers
   */
  async searchCustomers(
    teamId: string,
    query: string,
    limit: number = 10
  ): Promise<Customer[]> {
    return prisma.customer.findMany({
      where: {
        teamId,
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } }
        ]
      },
      take: limit,
      orderBy: { previousOrders: 'desc' }
    });
  }

  /**
   * Increment order count for customer
   */
  async incrementOrderCount(customerId: string): Promise<void> {
    await prisma.customer.update({
      where: { id: customerId },
      data: { previousOrders: { increment: 1 } }
    });
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^\d+]/g, '');

    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) {
        normalized = '+91' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Generate greeting for returning customer
   */
  async generateGreeting(phoneNumber: string, teamId: string): Promise<{
    isReturning: boolean;
    greeting: string;
    customerName?: string;
    lastOrderSummary?: string;
  }> {
    const customer = await this.findByPhone(phoneNumber, teamId);

    if (!customer) {
      return {
        isReturning: false,
        greeting: 'Welcome! How can I help you today?'
      };
    }

    const lastOrder = customer.recentOrders?.[0];
    let lastOrderSummary: string | undefined;

    if (lastOrder) {
      const daysSinceLastOrder = Math.floor(
        (Date.now() - new Date(lastOrder.orderTime).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastOrder < 7) {
        lastOrderSummary = `your order from ${daysSinceLastOrder} day${daysSinceLastOrder !== 1 ? 's' : ''} ago`;
      }
    }

    const customerName = customer.name?.split(' ')[0] || undefined;
    let greeting = 'Welcome back';

    if (customerName) {
      greeting += `, ${customerName}`;
    }
    greeting += '! ';

    if (lastOrderSummary) {
      greeting += `I hope you enjoyed ${lastOrderSummary}. `;
    }

    greeting += 'How can I help you today?';

    return {
      isReturning: true,
      greeting,
      customerName,
      lastOrderSummary
    };
  }
}

export const customerDetectionService = new CustomerDetectionService();
