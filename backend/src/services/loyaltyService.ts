import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { LoyaltyProgram, LoyaltyTier, Reward } from '@prisma/client';

// Types
export interface CreateProgramInput {
  teamId: string;
  name?: string;
  description?: string;
  pointsPerRupee?: number;
  minimumOrderAmount?: number;
  pointsExpireDays?: number;
  referralPoints?: number;
  refereePoints?: number;
}

export interface CreateTierInput {
  programId: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  multiplier?: number;
  benefits?: TierBenefits;
  color?: string;
  icon?: string;
  tierOrder?: number;
}

export interface TierBenefits {
  freeDelivery?: boolean;
  prioritySupport?: boolean;
  exclusiveOffers?: boolean;
  birthdayBonus?: number;
  bonusPointsPercent?: number;
  earlyAccess?: boolean;
}

export interface CreateRewardInput {
  programId: string;
  name: string;
  description?: string;
  type: RewardType;
  value: number;
  pointsCost: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  productId?: string;
  validDays?: number;
  maxRedemptions?: number;
  startDate?: Date;
  endDate?: Date;
}

export type RewardType =
  | 'discount_percent'
  | 'discount_flat'
  | 'free_item'
  | 'free_delivery'
  | 'bonus_points';

export type TransactionType =
  | 'earn'
  | 'redeem'
  | 'expire'
  | 'adjust'
  | 'referral_bonus'
  | 'signup_bonus'
  | 'birthday_bonus';

export interface LoyaltySummary {
  currentPoints: number;
  totalEarned: number;
  totalRedeemed: number;
  lifetimeValue: number;
  tier: {
    name: string;
    color?: string;
    benefits?: TierBenefits;
    nextTier?: {
      name: string;
      pointsNeeded: number;
    };
  } | null;
  availableRewards: number;
  referralCode: string;
  referralCount: number;
}

/**
 * Service for managing loyalty and rewards programs
 */
export class LoyaltyService {
  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRAM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create or get loyalty program for a team
   */
  async getOrCreateProgram(teamId: string, input?: Partial<CreateProgramInput>): Promise<LoyaltyProgram & { tiers: LoyaltyTier[]; rewards: Reward[] }> {
    let program = await prisma.loyaltyProgram.findUnique({
      where: { teamId },
      include: {
        tiers: { orderBy: { tierOrder: 'asc' } },
        rewards: { where: { isActive: true } },
      },
    });

    if (!program) {
      program = await this.createProgramInternal({ teamId, ...input });
    }

    return program;
  }

  /**
   * Create a new loyalty program (internal - avoids recursion)
   */
  private async createProgramInternal(input: CreateProgramInput): Promise<LoyaltyProgram & { tiers: LoyaltyTier[]; rewards: Reward[] }> {
    try {
      const program = await prisma.loyaltyProgram.create({
        data: {
          teamId: input.teamId,
          name: input.name || 'Rewards Program',
          description: input.description,
          pointsPerRupee: input.pointsPerRupee ?? 1,
          minimumOrderAmount: input.minimumOrderAmount ?? 0,
          pointsExpireDays: input.pointsExpireDays,
          referralPoints: input.referralPoints ?? 100,
          refereePoints: input.refereePoints ?? 50,
        },
        include: {
          tiers: true,
          rewards: true,
        },
      });

      // Create default tiers
      await this.createDefaultTiers(program.id);

      logger.info(`Created loyalty program for team ${input.teamId}`);

      // Fetch program with tiers populated
      const updatedProgram = await prisma.loyaltyProgram.findUnique({
        where: { teamId: input.teamId },
        include: {
          tiers: { orderBy: { tierOrder: 'asc' } },
          rewards: { where: { isActive: true } },
        },
      });

      return updatedProgram!;
    } catch (error) {
      logger.error('Error creating loyalty program', error);
      throw error;
    }
  }

  /**
   * Create a new loyalty program (public method)
   */
  async createProgram(input: CreateProgramInput): Promise<LoyaltyProgram & { tiers: LoyaltyTier[]; rewards: Reward[] }> {
    return this.createProgramInternal(input);
  }

  /**
   * Create default tiers for a program
   */
  private async createDefaultTiers(programId: string) {
    const defaultTiers = [
      {
        name: 'Bronze',
        minPoints: 0,
        maxPoints: 499,
        multiplier: 1,
        color: '#CD7F32',
        tierOrder: 1,
        benefits: { bonusPointsPercent: 0 },
      },
      {
        name: 'Silver',
        minPoints: 500,
        maxPoints: 1999,
        multiplier: 1.25,
        color: '#C0C0C0',
        tierOrder: 2,
        benefits: { bonusPointsPercent: 25, prioritySupport: true },
      },
      {
        name: 'Gold',
        minPoints: 2000,
        maxPoints: 4999,
        multiplier: 1.5,
        color: '#FFD700',
        tierOrder: 3,
        benefits: { bonusPointsPercent: 50, prioritySupport: true, freeDelivery: true },
      },
      {
        name: 'Platinum',
        minPoints: 5000,
        maxPoints: null,
        multiplier: 2,
        color: '#E5E4E2',
        tierOrder: 4,
        benefits: {
          bonusPointsPercent: 100,
          prioritySupport: true,
          freeDelivery: true,
          exclusiveOffers: true,
          earlyAccess: true,
          birthdayBonus: 500,
        },
      },
    ];

    for (const tier of defaultTiers) {
      await prisma.loyaltyTier.create({
        data: {
          programId,
          name: tier.name,
          minPoints: tier.minPoints,
          maxPoints: tier.maxPoints,
          multiplier: tier.multiplier,
          color: tier.color,
          tierOrder: tier.tierOrder,
          benefits: JSON.stringify(tier.benefits),
        },
      });
    }
  }

  /**
   * Update program settings
   */
  async updateProgram(teamId: string, data: Partial<CreateProgramInput>) {
    return prisma.loyaltyProgram.update({
      where: { teamId },
      data,
      include: {
        tiers: { orderBy: { tierOrder: 'asc' } },
        rewards: { where: { isActive: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a tier
   */
  async createTier(input: CreateTierInput) {
    return prisma.loyaltyTier.create({
      data: {
        programId: input.programId,
        name: input.name,
        minPoints: input.minPoints,
        maxPoints: input.maxPoints,
        multiplier: input.multiplier ?? 1,
        benefits: input.benefits ? JSON.stringify(input.benefits) : null,
        color: input.color,
        icon: input.icon,
        tierOrder: input.tierOrder ?? 0,
      },
    });
  }

  /**
   * Update a tier
   */
  async updateTier(tierId: string, data: Partial<CreateTierInput>) {
    return prisma.loyaltyTier.update({
      where: { id: tierId },
      data: {
        ...data,
        benefits: data.benefits ? JSON.stringify(data.benefits) : undefined,
      },
    });
  }

  /**
   * Delete a tier
   */
  async deleteTier(tierId: string) {
    await prisma.loyaltyTier.delete({
      where: { id: tierId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER LOYALTY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or create customer loyalty record
   */
  async getOrCreateCustomerLoyalty(customerId: string, teamId: string) {
    let loyalty = await prisma.customerLoyalty.findUnique({
      where: { customerId },
      include: {
        tier: true,
        customer: true,
      },
    });

    if (!loyalty) {
      // Get program
      const program = await this.getOrCreateProgram(teamId);
      const baseTier = program.tiers.find((t: LoyaltyTier) => t.minPoints === 0);

      loyalty = await prisma.customerLoyalty.create({
        data: {
          customerId,
          teamId,
          tierId: baseTier?.id,
          referralCode: this.generateReferralCode(),
        },
        include: {
          tier: true,
          customer: true,
        },
      });

      logger.info(`Created loyalty record for customer ${customerId}`);
    }

    return loyalty;
  }

  /**
   * Get customer loyalty summary
   */
  async getCustomerSummary(customerId: string, teamId: string): Promise<LoyaltySummary> {
    const loyalty = await this.getOrCreateCustomerLoyalty(customerId, teamId);
    const program = await this.getOrCreateProgram(teamId);

    // Find next tier
    let nextTier = null;
    if (loyalty.tier) {
      const higherTiers = program.tiers.filter(
        (t: LoyaltyTier) => t.minPoints > loyalty.totalPointsEarned
      );
      if (higherTiers.length > 0) {
        const next = higherTiers[0];
        nextTier = {
          name: next.name,
          pointsNeeded: next.minPoints - loyalty.totalPointsEarned,
        };
      }
    }

    // Count available rewards
    const availableRewards = program.rewards.filter(
      (r: Reward) => r.pointsCost <= loyalty.currentPoints && r.isActive
    ).length;

    return {
      currentPoints: loyalty.currentPoints,
      totalEarned: loyalty.totalPointsEarned,
      totalRedeemed: loyalty.totalPointsRedeemed,
      lifetimeValue: loyalty.lifetimeValue,
      tier: loyalty.tier
        ? {
            name: loyalty.tier.name,
            color: loyalty.tier.color || undefined,
            benefits: loyalty.tier.benefits
              ? JSON.parse(loyalty.tier.benefits)
              : undefined,
            nextTier: nextTier || undefined,
          }
        : null,
      availableRewards,
      referralCode: loyalty.referralCode || '',
      referralCount: loyalty.referralCount,
    };
  }

  /**
   * Earn points from an order
   */
  async earnPoints(customerId: string, teamId: string, orderId: string, orderAmount: number) {
    try {
      const program = await this.getOrCreateProgram(teamId);
      const loyalty = await this.getOrCreateCustomerLoyalty(customerId, teamId);

      // Check minimum order amount
      if (orderAmount < program.minimumOrderAmount) {
        logger.debug(`Order amount ${orderAmount} below minimum ${program.minimumOrderAmount}`);
        return null;
      }

      // Calculate base points
      let points = Math.floor(orderAmount * program.pointsPerRupee);

      // Apply tier multiplier
      if (loyalty.tier) {
        points = Math.floor(points * loyalty.tier.multiplier);
      }

      // Calculate expiry date
      const expiresAt = program.pointsExpireDays
        ? new Date(Date.now() + program.pointsExpireDays * 24 * 60 * 60 * 1000)
        : null;

      // Create transaction
      const newBalance = loyalty.currentPoints + points;
      const transaction = await prisma.loyaltyTransaction.create({
        data: {
          customerLoyaltyId: loyalty.id,
          type: 'earn',
          points,
          balanceAfter: newBalance,
          description: `Earned from order`,
          orderId,
          expiresAt,
        },
      });

      // Update loyalty record
      await prisma.customerLoyalty.update({
        where: { id: loyalty.id },
        data: {
          currentPoints: newBalance,
          totalPointsEarned: loyalty.totalPointsEarned + points,
          lifetimeValue: loyalty.lifetimeValue + orderAmount,
          totalOrders: loyalty.totalOrders + 1,
          lastOrderAt: new Date(),
        },
      });

      // Check for tier upgrade
      await this.checkAndUpdateTier(loyalty.id, teamId);

      logger.info(`Customer ${customerId} earned ${points} points from order ${orderId}`);
      return transaction;
    } catch (error) {
      logger.error('Error earning points', error);
      throw error;
    }
  }

  /**
   * Check and update customer tier
   */
  private async checkAndUpdateTier(loyaltyId: string, teamId: string) {
    const loyalty = await prisma.customerLoyalty.findUnique({
      where: { id: loyaltyId },
    });

    if (!loyalty) return;

    const program = await this.getOrCreateProgram(teamId);
    const totalPoints = loyalty.totalPointsEarned;

    // Find appropriate tier
    const newTier = program.tiers
      .filter((t: LoyaltyTier) => totalPoints >= t.minPoints)
      .sort((a: LoyaltyTier, b: LoyaltyTier) => b.minPoints - a.minPoints)[0];

    if (newTier && newTier.id !== loyalty.tierId) {
      await prisma.customerLoyalty.update({
        where: { id: loyaltyId },
        data: { tierId: newTier.id },
      });
      logger.info(`Customer upgraded to ${newTier.name} tier`);
    }
  }

  /**
   * Redeem points for a reward
   */
  async redeemReward(customerId: string, teamId: string, rewardId: string) {
    try {
      const loyalty = await this.getOrCreateCustomerLoyalty(customerId, teamId);
      const reward = await prisma.reward.findUnique({
        where: { id: rewardId },
      });

      if (!reward) {
        throw new Error('Reward not found');
      }

      if (!reward.isActive) {
        throw new Error('Reward is not active');
      }

      if (loyalty.currentPoints < reward.pointsCost) {
        throw new Error('Insufficient points');
      }

      if (reward.maxRedemptions && reward.currentRedemptions >= reward.maxRedemptions) {
        throw new Error('Reward is sold out');
      }

      // Check date validity
      const now = new Date();
      if (reward.startDate && now < reward.startDate) {
        throw new Error('Reward not yet available');
      }
      if (reward.endDate && now > reward.endDate) {
        throw new Error('Reward has expired');
      }

      // Create redemption
      const code = this.generateRedemptionCode();
      const expiresAt = new Date(Date.now() + reward.validDays * 24 * 60 * 60 * 1000);

      const redemption = await prisma.rewardRedemption.create({
        data: {
          customerLoyaltyId: loyalty.id,
          rewardId,
          pointsSpent: reward.pointsCost,
          code,
          expiresAt,
        },
        include: {
          reward: true,
        },
      });

      // Deduct points
      const newBalance = loyalty.currentPoints - reward.pointsCost;
      await prisma.loyaltyTransaction.create({
        data: {
          customerLoyaltyId: loyalty.id,
          type: 'redeem',
          points: -reward.pointsCost,
          balanceAfter: newBalance,
          description: `Redeemed: ${reward.name}`,
        },
      });

      // Update loyalty and reward
      await prisma.$transaction([
        prisma.customerLoyalty.update({
          where: { id: loyalty.id },
          data: {
            currentPoints: newBalance,
            totalPointsRedeemed: loyalty.totalPointsRedeemed + reward.pointsCost,
          },
        }),
        prisma.reward.update({
          where: { id: rewardId },
          data: {
            currentRedemptions: { increment: 1 },
          },
        }),
      ]);

      logger.info(`Customer ${customerId} redeemed reward ${reward.name}`);
      return redemption;
    } catch (error) {
      logger.error('Error redeeming reward', error);
      throw error;
    }
  }

  /**
   * Apply redemption to order
   */
  async applyRedemption(redemptionCode: string, orderId: string) {
    const redemption = await prisma.rewardRedemption.findUnique({
      where: { code: redemptionCode },
      include: { reward: true },
    });

    if (!redemption) {
      throw new Error('Invalid redemption code');
    }

    if (redemption.status !== 'active') {
      throw new Error(`Redemption is ${redemption.status}`);
    }

    if (new Date() > redemption.expiresAt) {
      await prisma.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: 'expired' },
      });
      throw new Error('Redemption has expired');
    }

    // Mark as used
    await prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: 'used',
        usedAt: new Date(),
        orderId,
      },
    });

    return {
      reward: redemption.reward,
      discountType: redemption.reward.type,
      discountValue: redemption.reward.value,
      maxDiscount: redemption.reward.maxDiscount,
      minOrderAmount: redemption.reward.minOrderAmount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REWARDS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a reward
   */
  async createReward(input: CreateRewardInput) {
    return prisma.reward.create({
      data: {
        programId: input.programId,
        name: input.name,
        description: input.description,
        type: input.type,
        value: input.value,
        pointsCost: input.pointsCost,
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        productId: input.productId,
        validDays: input.validDays ?? 30,
        maxRedemptions: input.maxRedemptions,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
  }

  /**
   * List rewards for a program
   */
  async listRewards(programId: string, activeOnly = true) {
    return prisma.reward.findMany({
      where: {
        programId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { pointsCost: 'asc' },
    });
  }

  /**
   * Get available rewards for a customer
   */
  async getAvailableRewards(customerId: string, teamId: string) {
    const loyalty = await this.getOrCreateCustomerLoyalty(customerId, teamId);
    const program = await this.getOrCreateProgram(teamId);

    return program.rewards.filter(
      (r: Reward) =>
        r.isActive &&
        r.pointsCost <= loyalty.currentPoints &&
        (!r.maxRedemptions || r.currentRedemptions < r.maxRedemptions) &&
        (!r.startDate || new Date() >= r.startDate) &&
        (!r.endDate || new Date() <= r.endDate)
    );
  }

  /**
   * Update a reward
   */
  async updateReward(rewardId: string, data: Partial<CreateRewardInput>) {
    return prisma.reward.update({
      where: { id: rewardId },
      data,
    });
  }

  /**
   * Delete a reward
   */
  async deleteReward(rewardId: string) {
    await prisma.reward.delete({
      where: { id: rewardId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERRAL SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process referral signup
   */
  async processReferral(newCustomerId: string, referralCode: string, teamId: string) {
    try {
      // Find referrer
      const referrer = await prisma.customerLoyalty.findUnique({
        where: { referralCode },
      });

      if (!referrer || referrer.teamId !== teamId) {
        logger.warn(`Invalid referral code: ${referralCode}`);
        return null;
      }

      const program = await this.getOrCreateProgram(teamId);
      const newCustomerLoyalty = await this.getOrCreateCustomerLoyalty(newCustomerId, teamId);

      // Award referral bonus to referrer
      await this.awardBonus(
        referrer.id,
        program.referralPoints,
        'referral_bonus',
        `Referral bonus for new customer`
      );

      // Award signup bonus to new customer
      await this.awardBonus(
        newCustomerLoyalty.id,
        program.refereePoints,
        'referral_bonus',
        `Welcome bonus from referral`
      );

      // Update referrer stats
      await prisma.customerLoyalty.update({
        where: { id: referrer.id },
        data: { referralCount: { increment: 1 } },
      });

      // Link referral
      await prisma.customerLoyalty.update({
        where: { id: newCustomerLoyalty.id },
        data: { referredBy: referrer.customerId },
      });

      logger.info(`Processed referral: ${referrer.customerId} -> ${newCustomerId}`);
      return { referrerBonus: program.referralPoints, newCustomerBonus: program.refereePoints };
    } catch (error) {
      logger.error('Error processing referral', error);
      throw error;
    }
  }

  /**
   * Award bonus points
   */
  async awardBonus(
    loyaltyId: string,
    points: number,
    type: TransactionType,
    description: string
  ) {
    const loyalty = await prisma.customerLoyalty.findUnique({
      where: { id: loyaltyId },
    });

    if (!loyalty) return null;

    const newBalance = loyalty.currentPoints + points;

    await prisma.loyaltyTransaction.create({
      data: {
        customerLoyaltyId: loyaltyId,
        type,
        points,
        balanceAfter: newBalance,
        description,
      },
    });

    await prisma.customerLoyalty.update({
      where: { id: loyaltyId },
      data: {
        currentPoints: newBalance,
        totalPointsEarned: loyalty.totalPointsEarned + points,
      },
    });

    return { points, newBalance };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPIRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process expired points (run daily via cron)
   */
  async processExpiredPoints() {
    try {
      const now = new Date();

      // Find expired transactions
      const expiredTransactions = await prisma.loyaltyTransaction.findMany({
        where: {
          type: 'earn',
          expiresAt: { lte: now },
          points: { gt: 0 },
        },
        include: {
          customerLoyalty: true,
        },
      });

      let totalExpired = 0;

      for (const transaction of expiredTransactions) {
        const loyalty = transaction.customerLoyalty;

        // Only expire if customer still has the points
        if (loyalty.currentPoints >= transaction.points) {
          const newBalance = loyalty.currentPoints - transaction.points;

          await prisma.loyaltyTransaction.create({
            data: {
              customerLoyaltyId: loyalty.id,
              type: 'expire',
              points: -transaction.points,
              balanceAfter: newBalance,
              description: 'Points expired',
            },
          });

          await prisma.customerLoyalty.update({
            where: { id: loyalty.id },
            data: { currentPoints: newBalance },
          });

          // Mark original transaction as processed
          await prisma.loyaltyTransaction.update({
            where: { id: transaction.id },
            data: { expiresAt: null }, // Clear to prevent re-processing
          });

          totalExpired += transaction.points;
        }
      }

      logger.info(`Processed ${totalExpired} expired points`);
      return totalExpired;
    } catch (error) {
      logger.error('Error processing expired points', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get program analytics
   */
  async getProgramAnalytics(teamId: string) {
    const program = await this.getOrCreateProgram(teamId);

    const [memberStats, transactionStats, redemptionStats] = await Promise.all([
      prisma.customerLoyalty.aggregate({
        where: { teamId },
        _count: true,
        _sum: {
          currentPoints: true,
          totalPointsEarned: true,
          totalPointsRedeemed: true,
          lifetimeValue: true,
        },
      }),
      prisma.loyaltyTransaction.groupBy({
        by: ['type'],
        where: { customerLoyalty: { teamId } },
        _sum: { points: true },
        _count: true,
      }),
      prisma.rewardRedemption.groupBy({
        by: ['status'],
        where: { customerLoyalty: { teamId } },
        _count: true,
      }),
    ]);

    const tierDistribution = await prisma.customerLoyalty.groupBy({
      by: ['tierId'],
      where: { teamId },
      _count: true,
    });

    return {
      totalMembers: memberStats._count,
      totalPointsInCirculation: memberStats._sum.currentPoints || 0,
      totalPointsEarned: memberStats._sum.totalPointsEarned || 0,
      totalPointsRedeemed: memberStats._sum.totalPointsRedeemed || 0,
      totalLifetimeValue: memberStats._sum.lifetimeValue || 0,
      transactionsByType: transactionStats.reduce(
        (acc, t) => ({
          ...acc,
          [t.type]: { count: t._count, points: t._sum.points },
        }),
        {}
      ),
      redemptionsByStatus: redemptionStats.reduce(
        (acc, r) => ({ ...acc, [r.status]: r._count }),
        {}
      ),
      tierDistribution: tierDistribution.map((t) => ({
        tierId: t.tierId,
        count: t._count,
      })),
    };
  }

  /**
   * Get customer transaction history
   */
  async getTransactionHistory(customerId: string, limit = 20, offset = 0) {
    const loyalty = await prisma.customerLoyalty.findUnique({
      where: { customerId },
    });

    if (!loyalty) return { transactions: [], total: 0 };

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { customerLoyaltyId: loyalty.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: { select: { orderNumber: true } },
        },
      }),
      prisma.loyaltyTransaction.count({
        where: { customerLoyaltyId: loyalty.id },
      }),
    ]);

    return { transactions, total };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private generateReferralCode(): string {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `REF${randomPart}`;
  }

  private generateRedemptionCode(): string {
    const randomPart = Math.random().toString(36).substring(2, 12).toUpperCase();
    return `RWD${randomPart}`;
  }
}

export const loyaltyService = new LoyaltyService();
