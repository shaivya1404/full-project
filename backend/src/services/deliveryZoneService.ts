import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { StoreInfo, DeliveryZone } from '@prisma/client';

export interface OperatingHours {
  [day: string]: {
    open: string;
    close: string;
    isClosed?: boolean;
  };
}

export interface DeliveryCheckResult {
  deliverable: boolean;
  zone?: DeliveryZone;
  deliveryFee: number;
  estimatedTime: number;
  reason?: string;
}

export interface StoreInfoWithZones extends StoreInfo {
  deliveryZones: DeliveryZone[];
}

export class DeliveryZoneService {
  /**
   * Get store info for a team
   */
  async getStoreInfo(teamId: string): Promise<StoreInfoWithZones | null> {
    return prisma.storeInfo.findUnique({
      where: { teamId },
      include: { deliveryZones: true }
    });
  }

  /**
   * Create or update store info
   */
  async upsertStoreInfo(
    teamId: string,
    data: {
      storeName: string;
      address: string;
      phone?: string;
      operatingHours: OperatingHours;
      timezone?: string;
      deliveryEnabled?: boolean;
      minOrderAmount?: number;
      avgPrepTime?: number;
    }
  ): Promise<StoreInfo> {
    return prisma.storeInfo.upsert({
      where: { teamId },
      create: {
        teamId,
        storeName: data.storeName,
        address: data.address,
        phone: data.phone,
        operatingHours: JSON.stringify(data.operatingHours),
        timezone: data.timezone || 'Asia/Kolkata',
        deliveryEnabled: data.deliveryEnabled ?? true,
        minOrderAmount: data.minOrderAmount || 0,
        avgPrepTime: data.avgPrepTime || 30
      },
      update: {
        storeName: data.storeName,
        address: data.address,
        phone: data.phone,
        operatingHours: JSON.stringify(data.operatingHours),
        timezone: data.timezone,
        deliveryEnabled: data.deliveryEnabled,
        minOrderAmount: data.minOrderAmount,
        avgPrepTime: data.avgPrepTime
      }
    });
  }

  /**
   * Get store operating hours
   */
  async getStoreHours(teamId: string): Promise<OperatingHours | null> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId },
      select: { operatingHours: true }
    });

    if (!store) return null;

    try {
      return JSON.parse(store.operatingHours);
    } catch {
      return null;
    }
  }

  /**
   * Update store operating hours
   */
  async updateStoreHours(teamId: string, hours: OperatingHours): Promise<void> {
    await prisma.storeInfo.update({
      where: { teamId },
      data: { operatingHours: JSON.stringify(hours) }
    });
  }

  /**
   * Check if store is currently open
   */
  async isStoreOpen(teamId: string): Promise<boolean> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId },
      select: { operatingHours: true, timezone: true }
    });

    if (!store) return false;

    try {
      const hours: OperatingHours = JSON.parse(store.operatingHours);
      const now = new Date();

      // Get current day and time in store's timezone
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: store.timezone,
        weekday: 'long'
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: store.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const currentDay = dayFormatter.format(now).toLowerCase();
      const currentTime = timeFormatter.format(now);

      const todayHours = hours[currentDay];
      if (!todayHours || todayHours.isClosed) return false;

      return currentTime >= todayHours.open && currentTime <= todayHours.close;
    } catch {
      return false;
    }
  }

  /**
   * Find delivery zone by postal code
   */
  async findZoneByPostalCode(teamId: string, postalCode: string): Promise<DeliveryZone | null> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId },
      include: {
        deliveryZones: {
          where: { isActive: true }
        }
      }
    });

    if (!store) return null;

    for (const zone of store.deliveryZones) {
      try {
        const postalCodes: string[] = JSON.parse(zone.postalCodes);
        if (postalCodes.includes(postalCode)) {
          return zone;
        }
      } catch {
        // Skip malformed zones
      }
    }

    return null;
  }

  /**
   * Calculate delivery fee for a postal code
   */
  async calculateDeliveryFee(teamId: string, postalCode: string): Promise<number> {
    const zone = await this.findZoneByPostalCode(teamId, postalCode);
    return zone?.deliveryFee || 0;
  }

  /**
   * Get estimated delivery time
   */
  async getEstimatedDeliveryTime(teamId: string, postalCode: string): Promise<number> {
    const [store, zone] = await Promise.all([
      prisma.storeInfo.findUnique({
        where: { teamId },
        select: { avgPrepTime: true }
      }),
      this.findZoneByPostalCode(teamId, postalCode)
    ]);

    const prepTime = store?.avgPrepTime || 30;
    const deliveryTime = zone?.estimatedTime || 30;

    return prepTime + deliveryTime;
  }

  /**
   * Check if delivery is available to a location
   */
  async isDeliveryAvailable(teamId: string, postalCode: string): Promise<DeliveryCheckResult> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId },
      include: { deliveryZones: { where: { isActive: true } } }
    });

    if (!store) {
      return {
        deliverable: false,
        deliveryFee: 0,
        estimatedTime: 0,
        reason: 'Store not found'
      };
    }

    if (!store.deliveryEnabled) {
      return {
        deliverable: false,
        deliveryFee: 0,
        estimatedTime: 0,
        reason: 'Delivery is not available'
      };
    }

    const zone = await this.findZoneByPostalCode(teamId, postalCode);

    if (!zone) {
      return {
        deliverable: false,
        deliveryFee: 0,
        estimatedTime: 0,
        reason: 'Location not in delivery area'
      };
    }

    return {
      deliverable: true,
      zone,
      deliveryFee: zone.deliveryFee,
      estimatedTime: store.avgPrepTime + zone.estimatedTime
    };
  }

  /**
   * Create delivery zone
   */
  async createDeliveryZone(
    teamId: string,
    data: {
      zoneName: string;
      postalCodes: string[];
      deliveryFee: number;
      minOrderAmount?: number;
      estimatedTime: number;
    }
  ): Promise<DeliveryZone> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId }
    });

    if (!store) {
      throw new Error('Store info not found. Create store info first.');
    }

    return prisma.deliveryZone.create({
      data: {
        storeId: store.id,
        zoneName: data.zoneName,
        postalCodes: JSON.stringify(data.postalCodes),
        deliveryFee: data.deliveryFee,
        minOrderAmount: data.minOrderAmount || 0,
        estimatedTime: data.estimatedTime,
        isActive: true
      }
    });
  }

  /**
   * Update delivery zone
   */
  async updateDeliveryZone(
    zoneId: string,
    data: {
      zoneName?: string;
      postalCodes?: string[];
      deliveryFee?: number;
      minOrderAmount?: number;
      estimatedTime?: number;
      isActive?: boolean;
    }
  ): Promise<DeliveryZone> {
    const updateData: any = {};

    if (data.zoneName) updateData.zoneName = data.zoneName;
    if (data.postalCodes) updateData.postalCodes = JSON.stringify(data.postalCodes);
    if (data.deliveryFee !== undefined) updateData.deliveryFee = data.deliveryFee;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.deliveryZone.update({
      where: { id: zoneId },
      data: updateData
    });
  }

  /**
   * Delete delivery zone
   */
  async deleteDeliveryZone(zoneId: string): Promise<void> {
    await prisma.deliveryZone.delete({
      where: { id: zoneId }
    });
  }

  /**
   * Get all delivery zones for a store
   */
  async getDeliveryZones(teamId: string): Promise<DeliveryZone[]> {
    const store = await prisma.storeInfo.findUnique({
      where: { teamId },
      include: { deliveryZones: true }
    });

    if (!store) return [];

    return store.deliveryZones.map(zone => ({
      ...zone,
      postalCodes: zone.postalCodes // Keep as string, let frontend parse
    }));
  }

  /**
   * Get delivery zones with parsed postal codes
   */
  async getDeliveryZonesParsed(teamId: string): Promise<(DeliveryZone & { postalCodesList: string[] })[]> {
    const zones = await this.getDeliveryZones(teamId);

    return zones.map(zone => ({
      ...zone,
      postalCodesList: this.parsePostalCodes(zone.postalCodes)
    }));
  }

  /**
   * Parse postal codes string
   */
  private parsePostalCodes(postalCodesJson: string): string[] {
    try {
      return JSON.parse(postalCodesJson);
    } catch {
      return [];
    }
  }

  /**
   * Check minimum order amount for delivery
   */
  async checkMinOrderAmount(teamId: string, postalCode: string, orderAmount: number): Promise<{
    meetsMinimum: boolean;
    minimumAmount: number;
    shortfall: number;
  }> {
    const [store, zone] = await Promise.all([
      prisma.storeInfo.findUnique({
        where: { teamId },
        select: { minOrderAmount: true }
      }),
      this.findZoneByPostalCode(teamId, postalCode)
    ]);

    // Use the higher of store minimum and zone minimum
    const storeMin = store?.minOrderAmount || 0;
    const zoneMin = zone?.minOrderAmount || 0;
    const minimumAmount = Math.max(storeMin, zoneMin);

    return {
      meetsMinimum: orderAmount >= minimumAmount,
      minimumAmount,
      shortfall: Math.max(0, minimumAmount - orderAmount)
    };
  }
}

export const deliveryZoneService = new DeliveryZoneService();
