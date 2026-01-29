import { PrismaClient, Order, OrderItem, Customer, CustomerPreference } from '@prisma/client';
import { getPrismaClient } from '../client';
import { logger } from '../../utils/logger';

export interface CreateOrderInput {
  teamId?: string;
  campaignId?: string;
  callId?: string;
  customerId?: string;
  status?: string;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    specialInstructions?: string;
  }>;
  totalAmount?: number;
  deliveryAddress?: string;
  phone?: string;
  email?: string;
  notes?: string;
  specialInstructions?: string;
}

export interface UpdateOrderInput {
  status?: string;
  deliveryAddress?: string;
  phone?: string;
  email?: string;
  notes?: string;
  cancelReason?: string;
  specialInstructions?: string;
}

export interface CreateCustomerInput {
  teamId?: string;
  phone?: string;
  email?: string;
  address?: string;
  name?: string;
}

export interface UpdateCustomerInput {
  phone?: string;
  email?: string;
  address?: string;
  name?: string;
}

export interface CustomerPreferenceInput {
  favoriteItems?: string[];
  dietaryRestrictions?: string[];
  allergies?: string[];
  deliveryNotes?: string;
}

export interface OrderFilters {
  customerId?: string;
  status?: string;
  campaignId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CustomerFilters {
  teamId?: string;
  phone?: string;
  email?: string;
}

export class OrderRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  // Order CRUD Operations

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const { items, ...orderData } = data;
    
    const order = await this.prisma.order.create({
      data: {
        teamId: orderData.teamId,
        campaignId: orderData.campaignId,
        callId: orderData.callId,
        customerId: orderData.customerId,
        status: orderData.status || 'pending',
        totalAmount: orderData.totalAmount || 0,
        deliveryAddress: orderData.deliveryAddress,
        phone: orderData.phone,
        email: orderData.email,
        notes: orderData.notes,
        specialInstructions: orderData.specialInstructions,
        orderNumber: await this.generateOrderNumber(),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            specialInstructions: item.specialInstructions,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // Update customer order count if customer is specified
    if (data.customerId) {
      await this.prisma.customer.update({
        where: { id: data.customerId },
        data: {
          previousOrders: { increment: 1 },
        },
      });
    }

    return order;
  }

  async updateOrder(id: string, data: UpdateOrderInput): Promise<Order | null> {
    return this.prisma.order.update({
      where: { id },
      data: {
        status: data.status,
        deliveryAddress: data.deliveryAddress,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        cancelReason: data.cancelReason,
        specialInstructions: data.specialInstructions,
      },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async getOrderById(id: string): Promise<(Order & { items: OrderItem[]; customer: Customer | null }) | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<(Order & { items: OrderItem[]; customer: Customer | null }) | null> {
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async getOrderByCallId(callId: string): Promise<(Order & { items: OrderItem[] }) | null> {
    return this.prisma.order.findFirst({
      where: { callId },
      include: {
        items: true,
      },
    });
  }

  async deleteOrder(id: string): Promise<void> {
    await this.prisma.order.delete({
      where: { id },
    });
  }

  // Order Search and Filter

  async searchOrders(
    limit: number = 10,
    offset: number = 0,
    filters?: OrderFilters,
    teamId?: string,
  ): Promise<{ orders: (Order & { items: OrderItem[]; customer: Customer | null })[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (teamId) {
      where.teamId = teamId;
    }
    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.campaignId) {
      where.campaignId = filters.campaignId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.orderTime = {};
      if (filters?.startDate) {
        (where.orderTime as Record<string, Date>).gte = filters.startDate;
      }
      if (filters?.endDate) {
        (where.orderTime as Record<string, Date>).lte = filters.endDate;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { orderTime: 'desc' },
        include: {
          items: true,
          customer: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  async getOrdersByStatus(status: string, limit: number = 100, teamId?: string): Promise<Order[]> {
    const where: Record<string, unknown> = { status };
    if (teamId) {
      where.teamId = teamId;
    }

    return this.prisma.order.findMany({
      where,
      take: limit,
      orderBy: { orderTime: 'asc' },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date, teamId?: string): Promise<Order[]> {
    const where: Record<string, unknown> = {
      orderTime: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (teamId) {
      where.teamId = teamId;
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { orderTime: 'desc' },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async getDuplicateOrders(customerId: string, withinMinutes: number = 5): Promise<Order[]> {
    const fiveMinutesAgo = new Date(Date.now() - withinMinutes * 60 * 1000);

    return this.prisma.order.findMany({
      where: {
        customerId,
        orderTime: {
          gte: fiveMinutesAgo,
        },
        status: {
          not: 'cancelled',
        },
      },
      include: {
        items: true,
      },
    });
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateOrderStatus(id: string, status: string, cancelReason?: string): Promise<Order | null> {
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        cancelReason: status === 'cancelled' ? cancelReason : undefined,
      },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  // Customer CRUD Operations

  async createCustomer(data: CreateCustomerInput): Promise<Customer> {
    return this.prisma.customer.create({
      data: {
        teamId: data.teamId,
        phone: data.phone,
        email: data.email,
        address: data.address,
        name: data.name,
      },
    });
  }

  async updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: {
        phone: data.phone,
        email: data.email,
        address: data.address,
        name: data.name,
      },
    });
  }

  async getCustomerById(id: string): Promise<(Customer & { orders: Order[]; preferences: CustomerPreference | null }) | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { orderTime: 'desc' },
          include: {
            items: true,
          },
        },
        preferences: true,
      },
    });
  }

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { phone },
      include: {
        preferences: true,
        orders: {
          orderBy: { orderTime: 'desc' },
          take: 10,
        },
      },
    });
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { email },
      include: {
        preferences: true,
        orders: {
          orderBy: { orderTime: 'desc' },
          take: 10,
        },
      },
    });
  }

  async searchCustomers(
    limit: number = 10,
    offset: number = 0,
    filters?: CustomerFilters,
  ): Promise<{ customers: Customer[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.phone) {
      where.phone = { contains: filters.phone, mode: 'insensitive' as const };
    }
    if (filters?.email) {
      where.email = { contains: filters.email, mode: 'insensitive' as const };
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          orders: {
            orderBy: { orderTime: 'desc' },
            take: 1,
          },
          preferences: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.prisma.customer.delete({
      where: { id },
    });
  }

  // Customer Preferences

  async getCustomerPreferences(customerId: string): Promise<CustomerPreference | null> {
    return this.prisma.customerPreference.findUnique({
      where: { customerId },
    });
  }

  async createOrUpdateCustomerPreferences(
    customerId: string,
    data: CustomerPreferenceInput,
  ): Promise<CustomerPreference> {
    const existing = await this.prisma.customerPreference.findUnique({
      where: { customerId },
    });

    if (existing) {
      return this.prisma.customerPreference.update({
        where: { customerId },
        data: {
          favoriteItems: data.favoriteItems ? JSON.stringify(data.favoriteItems) : undefined,
          dietaryRestrictions: data.dietaryRestrictions ? JSON.stringify(data.dietaryRestrictions) : undefined,
          allergies: data.allergies ? JSON.stringify(data.allergies) : undefined,
          deliveryNotes: data.deliveryNotes,
        },
      });
    }

    return this.prisma.customerPreference.create({
      data: {
        customerId,
        favoriteItems: data.favoriteItems ? JSON.stringify(data.favoriteItems) : undefined,
        dietaryRestrictions: data.dietaryRestrictions ? JSON.stringify(data.dietaryRestrictions) : undefined,
        allergies: data.allergies ? JSON.stringify(data.allergies) : undefined,
        deliveryNotes: data.deliveryNotes,
      },
    });
  }

  // Analytics

  async getTopOrderedItems(limit: number = 10, teamId?: string): Promise<Array<{ productName: string; totalQuantity: number; orderCount: number }>> {
    const where: Record<string, unknown> = {};
    if (teamId) {
      where.order = { teamId };
    }

    const items = await this.prisma.orderItem.findMany({
      where,
      include: {
        order: {
          select: { teamId: true },
        },
      },
    });

    const itemStats: Record<string, { totalQuantity: number; orderCount: Set<string> }> = {};
    
    items.forEach((item) => {
      if (teamId && item.order.teamId !== teamId) return;
      
      if (!itemStats[item.productName]) {
        itemStats[item.productName] = { totalQuantity: 0, orderCount: new Set() };
      }
      itemStats[item.productName].totalQuantity += item.quantity;
      itemStats[item.productName].orderCount.add(item.orderId);
    });

    return Object.entries(itemStats)
      .map(([productName, stats]) => ({
        productName,
        totalQuantity: stats.totalQuantity,
        orderCount: stats.orderCount.size,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  async getOrderTrends(startDate: Date, endDate: Date, teamId?: string): Promise<Array<{ date: string; orderCount: number; totalRevenue: number }>> {
    const where: Record<string, unknown> = {
      orderTime: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (teamId) {
      where.teamId = teamId;
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        orderTime: true,
        totalAmount: true,
      },
    });

    const dailyStats: Record<string, { orderCount: number; totalRevenue: number }> = {};
    
    orders.forEach((order) => {
      const dateKey = order.orderTime.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { orderCount: 0, totalRevenue: 0 };
      }
      dailyStats[dateKey].orderCount += 1;
      dailyStats[dateKey].totalRevenue += order.totalAmount;
    });

    return Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        orderCount: stats.orderCount,
        totalRevenue: stats.totalRevenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getOrderCountByStatus(teamId?: string): Promise<Record<string, number>> {
    const where: Record<string, unknown> = {};
    if (teamId) {
      where.teamId = teamId;
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: { status: true },
    });

    const statusCount: Record<string, number> = {};
    orders.forEach((order) => {
      statusCount[order.status] = (statusCount[order.status] || 0) + 1;
    });

    return statusCount;
  }

  async getMostFrequentCustomers(limit: number = 10, teamId?: string): Promise<Array<{ customerId: string; customerName: string; orderCount: number; totalSpent: number }>> {
    const where: Record<string, unknown> = {};
    if (teamId) {
      where.teamId = teamId;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { name: true },
        },
      },
    });

    const customerStats: Record<string, { name: string; orderCount: number; totalSpent: number }> = {};
    
    orders.forEach((order) => {
      if (!order.customerId) return;
      
      if (!customerStats[order.customerId]) {
        customerStats[order.customerId] = {
          name: order.customer?.name || 'Unknown',
          orderCount: 0,
          totalSpent: 0,
        };
      }
      customerStats[order.customerId].orderCount += 1;
      customerStats[order.customerId].totalSpent += order.totalAmount;
    });

    return Object.entries(customerStats)
      .map(([customerId, stats]) => ({
        customerId,
        customerName: stats.name,
        orderCount: stats.orderCount,
        totalSpent: stats.totalSpent,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, limit);
  }

  // Utility

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const count = await this.prisma.order.count({
      where: {
        orderTime: {
          gte: startOfDay,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `ORD-${year}-${sequence}`;
  }

  // Update customer from call data

  async findOrCreateCustomer(data: { phone?: string; email?: string; name?: string; address?: string; teamId?: string }): Promise<Customer> {
    if (data.phone) {
      const existing = await this.getCustomerByPhone(data.phone);
      if (existing) {
        return existing;
      }
    }
    
    if (data.email) {
      const existing = await this.getCustomerByEmail(data.email);
      if (existing) {
        return existing;
      }
    }

    return this.createCustomer(data);
  }
}

export const getOrderRepository = (): OrderRepository => {
  return new OrderRepository();
};
