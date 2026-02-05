import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Product, InventoryMovement } from '@prisma/client';

export type MovementType = 'sale' | 'restock' | 'adjustment' | 'return' | 'waste';

export interface StockAdjustment {
  productId: string;
  quantity: number;
  movementType: MovementType;
  reason?: string;
  orderId?: string;
  createdBy?: string;
}

export interface LowStockProduct extends Product {
  stockStatus: 'out_of_stock' | 'low_stock' | 'critical';
}

export interface InventoryStats {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalStockValue: number;
  recentMovements: InventoryMovement[];
}

export class InventoryService {
  /**
   * Check if product is available in requested quantity
   */
  async checkAvailability(productId: string, quantity: number = 1): Promise<{
    available: boolean;
    currentStock: number;
    requestedQuantity: number;
  }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        stockQuantity: true,
        isAvailable: true
      }
    });

    if (!product) {
      return {
        available: false,
        currentStock: 0,
        requestedQuantity: quantity
      };
    }

    return {
      available: product.isAvailable && product.stockQuantity >= quantity,
      currentStock: product.stockQuantity,
      requestedQuantity: quantity
    };
  }

  /**
   * Reserve stock for an order
   */
  async reserveStock(productId: string, quantity: number, orderId: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.stockQuantity < quantity) {
      return false;
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock - quantity;

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          stockQuantity: newStock,
          isAvailable: newStock > 0
        }
      }),
      prisma.inventoryMovement.create({
        data: {
          productId,
          movementType: 'sale',
          quantity: -quantity,
          previousStock,
          newStock,
          orderId,
          reason: `Reserved for order ${orderId}`
        }
      })
    ]);

    logger.info(`Reserved ${quantity} units of product ${productId} for order ${orderId}`);

    // Check if we need to alert for low stock
    if (newStock <= product.reorderLevel) {
      logger.warn(`Product ${productId} is at or below reorder level (${newStock}/${product.reorderLevel})`);
    }

    return true;
  }

  /**
   * Release stock (e.g., cancelled order)
   */
  async releaseStock(productId: string, quantity: number, orderId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock + quantity;

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          stockQuantity: newStock,
          isAvailable: true
        }
      }),
      prisma.inventoryMovement.create({
        data: {
          productId,
          movementType: 'return',
          quantity,
          previousStock,
          newStock,
          orderId,
          reason: `Released from cancelled order ${orderId}`
        }
      })
    ]);

    logger.info(`Released ${quantity} units of product ${productId} from order ${orderId}`);
  }

  /**
   * Adjust stock (manual adjustment, waste, etc.)
   */
  async adjustStock(adjustment: StockAdjustment): Promise<InventoryMovement> {
    const product = await prisma.product.findUnique({
      where: { id: adjustment.productId }
    });

    if (!product) {
      throw new Error(`Product ${adjustment.productId} not found`);
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock + adjustment.quantity;

    if (newStock < 0) {
      throw new Error(`Cannot adjust stock below 0. Current: ${previousStock}, Adjustment: ${adjustment.quantity}`);
    }

    const [_, movement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: adjustment.productId },
        data: {
          stockQuantity: newStock,
          isAvailable: newStock > 0
        }
      }),
      prisma.inventoryMovement.create({
        data: {
          productId: adjustment.productId,
          movementType: adjustment.movementType,
          quantity: adjustment.quantity,
          previousStock,
          newStock,
          reason: adjustment.reason,
          orderId: adjustment.orderId,
          createdBy: adjustment.createdBy
        }
      })
    ]);

    logger.info(`Stock adjusted for product ${adjustment.productId}: ${previousStock} -> ${newStock}`);
    return movement;
  }

  /**
   * Restock a product
   */
  async restockProduct(
    productId: string,
    quantity: number,
    createdBy?: string,
    reason?: string
  ): Promise<InventoryMovement> {
    return this.adjustStock({
      productId,
      quantity,
      movementType: 'restock',
      reason: reason || 'Restock',
      createdBy
    });
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(teamId: string): Promise<LowStockProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        teamId,
        OR: [
          { stockQuantity: 0 },
          {
            stockQuantity: {
              lte: prisma.product.fields.reorderLevel
            }
          }
        ]
      },
      orderBy: { stockQuantity: 'asc' }
    });

    // Since Prisma doesn't support field comparison in where, filter in memory
    const allProducts = await prisma.product.findMany({
      where: { teamId }
    });

    const lowStockProducts: LowStockProduct[] = allProducts
      .filter(p => p.stockQuantity <= p.reorderLevel)
      .map(p => ({
        ...p,
        stockStatus: p.stockQuantity === 0
          ? 'out_of_stock' as const
          : p.stockQuantity <= p.minStockLevel
            ? 'critical' as const
            : 'low_stock' as const
      }))
      .sort((a, b) => a.stockQuantity - b.stockQuantity);

    return lowStockProducts;
  }

  /**
   * Get stock history for a product
   */
  async getStockHistory(
    productId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ movements: InventoryMovement[]; total: number }> {
    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.inventoryMovement.count({ where: { productId } })
    ]);

    return { movements, total };
  }

  /**
   * Record an inventory movement
   */
  async recordMovement(
    productId: string,
    movementType: MovementType,
    quantity: number,
    previousStock: number,
    newStock: number,
    options?: {
      reason?: string;
      orderId?: string;
      createdBy?: string;
    }
  ): Promise<InventoryMovement> {
    return prisma.inventoryMovement.create({
      data: {
        productId,
        movementType,
        quantity,
        previousStock,
        newStock,
        reason: options?.reason,
        orderId: options?.orderId,
        createdBy: options?.createdBy
      }
    });
  }

  /**
   * Get inventory statistics for a team
   */
  async getInventoryStats(teamId: string): Promise<InventoryStats> {
    const products = await prisma.product.findMany({
      where: { teamId },
      select: {
        id: true,
        stockQuantity: true,
        price: true,
        reorderLevel: true,
        minStockLevel: true
      }
    });

    const totalProducts = products.length;
    const outOfStockProducts = products.filter(p => p.stockQuantity === 0).length;
    const lowStockProducts = products.filter(p =>
      p.stockQuantity > 0 && p.stockQuantity <= p.reorderLevel
    ).length;
    const inStockProducts = totalProducts - outOfStockProducts;

    const totalStockValue = products.reduce((sum, p) => {
      return sum + (p.stockQuantity * (p.price || 0));
    }, 0);

    // Get recent movements
    const recentMovements = await prisma.inventoryMovement.findMany({
      where: {
        product: { teamId }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    return {
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      lowStockProducts,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      recentMovements
    };
  }

  /**
   * Bulk update stock
   */
  async bulkUpdateStock(
    updates: { productId: string; quantity: number }[],
    createdBy?: string
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        await this.adjustStock({
          productId: update.productId,
          quantity: update.quantity,
          movementType: 'adjustment',
          reason: 'Bulk stock update',
          createdBy
        });
        updated++;
      } catch (err) {
        logger.error(`Failed to update stock for ${update.productId}:`, err);
        failed++;
      }
    }

    return { updated, failed };
  }

  /**
   * Get product with stock info
   */
  async getProductWithStock(productId: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id: productId }
    });
  }

  /**
   * Update product availability
   */
  async updateProductAvailability(productId: string, isAvailable: boolean): Promise<void> {
    await prisma.product.update({
      where: { id: productId },
      data: { isAvailable }
    });
  }

  /**
   * Get inventory for all products
   */
  async getInventory(
    teamId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      category?: string;
      stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
      search?: string;
    }
  ): Promise<{ products: Product[]; total: number }> {
    const where: any = { teamId };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { sku: { contains: filters.search } }
      ];
    }

    if (filters?.stockStatus) {
      switch (filters.stockStatus) {
        case 'out_of_stock':
          where.stockQuantity = 0;
          break;
        case 'in_stock':
          where.stockQuantity = { gt: 0 };
          break;
        // low_stock requires post-filtering
      }
    }

    let [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    // Post-filter for low stock if needed
    if (filters?.stockStatus === 'low_stock') {
      products = products.filter(p =>
        p.stockQuantity > 0 && p.stockQuantity <= p.reorderLevel
      );
      total = products.length;
    }

    return { products, total };
  }
}

export const inventoryService = new InventoryService();
