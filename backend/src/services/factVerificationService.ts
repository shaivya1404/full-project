import { prisma } from '../db/client';
import { FactVerification } from '@prisma/client';
import { logger } from '../utils/logger';

// Types
export type ClaimType = 'order_status' | 'product_info' | 'policy' | 'price' | 'availability' | 'customer_info' | 'delivery' | 'payment';

export type VerificationResult = 'verified' | 'unverified' | 'contradicted' | 'partial';

export interface ClaimToVerify {
  claimText: string;
  claimType: ClaimType;
  entityId?: string;
  claimedValue?: any;
}

export interface VerificationResponse {
  result: VerificationResult;
  confidence: number;
  verifiedAgainst?: string;
  actualValue?: any;
  discrepancy?: string;
}

export interface ConfidenceScore {
  overall: number;
  breakdown: {
    verifiedClaims: number;
    unverifiedClaims: number;
    contradictedClaims: number;
  };
  shouldAcknowledgeUncertainty: boolean;
}

// Uncertainty acknowledgment thresholds
const UNCERTAINTY_THRESHOLD = 0.7; // Below this, acknowledge uncertainty
const HIGH_CONFIDENCE_THRESHOLD = 0.9;

// Uncertainty phrases
const UNCERTAINTY_PHRASES = {
  low: [
    "Let me verify that information to make sure I'm giving you accurate details.",
    "I want to double-check that before confirming.",
    "Let me check the system to make sure that's correct.",
  ],
  medium: [
    "I believe that's correct, but let me verify to be certain.",
    "That should be right, but let me confirm.",
  ],
  hedging: [
    "Based on what I see, ",
    "According to our records, ",
    "The information I have shows ",
  ],
};

/**
 * Service for verifying facts and claims before AI responds
 */
export class FactVerificationService {
  /**
   * Verify a claim against the database
   */
  async verifyClaim(callId: string, claim: ClaimToVerify): Promise<VerificationResponse> {
    try {
      let response: VerificationResponse;

      switch (claim.claimType) {
        case 'order_status':
          response = await this.verifyOrderStatus(claim.entityId!, claim.claimedValue);
          break;
        case 'product_info':
          response = await this.verifyProductInfo(claim.entityId!, claim.claimedValue);
          break;
        case 'price':
          response = await this.verifyPrice(claim.entityId!, claim.claimedValue);
          break;
        case 'availability':
          response = await this.verifyAvailability(claim.entityId!);
          break;
        case 'customer_info':
          response = await this.verifyCustomerInfo(claim.entityId!, claim.claimedValue);
          break;
        case 'delivery':
          response = await this.verifyDeliveryInfo(claim.entityId!, claim.claimedValue);
          break;
        case 'payment':
          response = await this.verifyPaymentStatus(claim.entityId!, claim.claimedValue);
          break;
        default:
          response = {
            result: 'unverified',
            confidence: 0.5,
            discrepancy: 'Unable to verify this type of claim',
          };
      }

      // Log verification
      await this.logVerification(callId, {
        claimText: claim.claimText,
        claimType: claim.claimType,
        verificationResult: response.result,
        confidence: response.confidence,
        verifiedAgainst: response.verifiedAgainst,
      });

      return response;
    } catch (error) {
      logger.error('Error verifying claim', error);
      return {
        result: 'unverified',
        confidence: 0,
        discrepancy: 'Error during verification',
      };
    }
  }

  /**
   * Verify order status
   */
  async verifyOrderStatus(orderId: string, claimedStatus?: string): Promise<VerificationResponse> {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { orderNumber: orderId },
          ],
        },
      });

      if (!order) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Order not found',
        };
      }

      if (claimedStatus) {
        const normalizedClaimed = claimedStatus.toLowerCase();
        const actualStatus = order.status.toLowerCase();

        if (normalizedClaimed === actualStatus) {
          return {
            result: 'verified',
            confidence: 1.0,
            verifiedAgainst: `Order ${order.orderNumber}`,
            actualValue: order.status,
          };
        } else {
          return {
            result: 'contradicted',
            confidence: 1.0,
            verifiedAgainst: `Order ${order.orderNumber}`,
            actualValue: order.status,
            discrepancy: `Actual status is "${order.status}", not "${claimedStatus}"`,
          };
        }
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Order ${order.orderNumber}`,
        actualValue: order.status,
      };
    } catch (error) {
      logger.error('Error verifying order status', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify product information
   */
  async verifyProductInfo(
    productId: string,
    claimedInfo?: Record<string, any>
  ): Promise<VerificationResponse> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { name: { contains: productId } },
            { sku: productId },
          ],
        },
      });

      if (!product) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Product not found',
        };
      }

      if (claimedInfo) {
        let matchedFields = 0;
        let totalFields = 0;
        const discrepancies: string[] = [];

        for (const [key, claimedValue] of Object.entries(claimedInfo)) {
          totalFields++;
          const actualValue = (product as any)[key];

          if (actualValue !== undefined) {
            if (String(actualValue).toLowerCase() === String(claimedValue).toLowerCase()) {
              matchedFields++;
            } else {
              discrepancies.push(`${key}: claimed "${claimedValue}", actual "${actualValue}"`);
            }
          }
        }

        const accuracy = totalFields > 0 ? matchedFields / totalFields : 0;

        return {
          result: accuracy === 1 ? 'verified' : accuracy >= 0.5 ? 'partial' : 'contradicted',
          confidence: accuracy,
          verifiedAgainst: `Product ${product.name}`,
          actualValue: product,
          discrepancy: discrepancies.length > 0 ? discrepancies.join('; ') : undefined,
        };
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Product ${product.name}`,
        actualValue: product,
      };
    } catch (error) {
      logger.error('Error verifying product info', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify price
   */
  async verifyPrice(productId: string, claimedPrice?: number): Promise<VerificationResponse> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { name: { contains: productId } },
            { sku: productId },
          ],
        },
      });

      if (!product) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Product not found',
        };
      }

      if (claimedPrice !== undefined && product.price !== null) {
        const priceDiff = Math.abs(product.price - claimedPrice);
        const tolerance = product.price * 0.01; // 1% tolerance

        if (priceDiff <= tolerance) {
          return {
            result: 'verified',
            confidence: 1.0,
            verifiedAgainst: `Product ${product.name}`,
            actualValue: product.price,
          };
        } else {
          return {
            result: 'contradicted',
            confidence: 1.0,
            verifiedAgainst: `Product ${product.name}`,
            actualValue: product.price,
            discrepancy: `Actual price is ₹${product.price}, not ₹${claimedPrice}`,
          };
        }
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Product ${product.name}`,
        actualValue: product.price,
      };
    } catch (error) {
      logger.error('Error verifying price', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify product availability
   */
  async verifyAvailability(productId: string): Promise<VerificationResponse> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { name: { contains: productId } },
            { sku: productId },
          ],
        },
      });

      if (!product) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Product not found',
        };
      }

      const isAvailable = product.isAvailable && product.stockQuantity > 0;

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Product ${product.name}`,
        actualValue: {
          isAvailable,
          stockQuantity: product.stockQuantity,
        },
      };
    } catch (error) {
      logger.error('Error verifying availability', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify customer information
   */
  async verifyCustomerInfo(
    customerId: string,
    claimedInfo?: Record<string, any>
  ): Promise<VerificationResponse> {
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { id: customerId },
            { phone: customerId },
            { email: customerId },
          ],
        },
      });

      if (!customer) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Customer not found',
        };
      }

      if (claimedInfo) {
        let matchedFields = 0;
        let totalFields = 0;

        for (const [key, claimedValue] of Object.entries(claimedInfo)) {
          totalFields++;
          const actualValue = (customer as any)[key];

          if (actualValue !== undefined && actualValue !== null) {
            if (String(actualValue).toLowerCase() === String(claimedValue).toLowerCase()) {
              matchedFields++;
            }
          }
        }

        const accuracy = totalFields > 0 ? matchedFields / totalFields : 0;

        return {
          result: accuracy >= 0.8 ? 'verified' : accuracy >= 0.5 ? 'partial' : 'unverified',
          confidence: accuracy,
          verifiedAgainst: `Customer ${customer.name || customer.phone}`,
          actualValue: { name: customer.name, phone: customer.phone },
        };
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Customer ${customer.name || customer.phone}`,
        actualValue: customer,
      };
    } catch (error) {
      logger.error('Error verifying customer info', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify delivery information
   */
  async verifyDeliveryInfo(
    orderId: string,
    claimedInfo?: Record<string, any>
  ): Promise<VerificationResponse> {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { orderNumber: orderId },
          ],
        },
      });

      if (!order) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Order not found',
        };
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Order ${order.orderNumber}`,
        actualValue: {
          address: order.deliveryAddress,
          status: order.status,
        },
      };
    } catch (error) {
      logger.error('Error verifying delivery info', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPaymentStatus(
    paymentOrOrderId: string,
    claimedStatus?: string
  ): Promise<VerificationResponse> {
    try {
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { id: paymentOrOrderId },
            { transactionId: paymentOrOrderId },
            { orderId: paymentOrOrderId },
          ],
        },
      });

      if (!payment) {
        return {
          result: 'unverified',
          confidence: 0.3,
          discrepancy: 'Payment not found',
        };
      }

      if (claimedStatus) {
        if (payment.status.toLowerCase() === claimedStatus.toLowerCase()) {
          return {
            result: 'verified',
            confidence: 1.0,
            verifiedAgainst: `Payment ${payment.transactionId}`,
            actualValue: payment.status,
          };
        } else {
          return {
            result: 'contradicted',
            confidence: 1.0,
            verifiedAgainst: `Payment ${payment.transactionId}`,
            actualValue: payment.status,
            discrepancy: `Actual status is "${payment.status}", not "${claimedStatus}"`,
          };
        }
      }

      return {
        result: 'verified',
        confidence: 1.0,
        verifiedAgainst: `Payment ${payment.transactionId}`,
        actualValue: payment.status,
      };
    } catch (error) {
      logger.error('Error verifying payment status', error);
      return { result: 'unverified', confidence: 0 };
    }
  }

  /**
   * Calculate overall confidence from multiple verifications
   */
  calculateConfidence(verificationResults: VerificationResponse[]): ConfidenceScore {
    if (verificationResults.length === 0) {
      return {
        overall: 0.5,
        breakdown: {
          verifiedClaims: 0,
          unverifiedClaims: 0,
          contradictedClaims: 0,
        },
        shouldAcknowledgeUncertainty: true,
      };
    }

    const breakdown = {
      verifiedClaims: verificationResults.filter(r => r.result === 'verified').length,
      unverifiedClaims: verificationResults.filter(r => r.result === 'unverified').length,
      contradictedClaims: verificationResults.filter(r => r.result === 'contradicted').length,
    };

    const totalConfidence = verificationResults.reduce((sum, r) => sum + r.confidence, 0);
    const overall = totalConfidence / verificationResults.length;

    return {
      overall,
      breakdown,
      shouldAcknowledgeUncertainty: overall < UNCERTAINTY_THRESHOLD || breakdown.contradictedClaims > 0,
    };
  }

  /**
   * Generate uncertainty acknowledgment phrase
   */
  generateUncertaintyAcknowledgment(confidence: number, topic: string): string {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return ''; // No acknowledgment needed
    }

    if (confidence < 0.5) {
      const phrases = UNCERTAINTY_PHRASES.low;
      return phrases[Math.floor(Math.random() * phrases.length)];
    }

    if (confidence < UNCERTAINTY_THRESHOLD) {
      const phrases = UNCERTAINTY_PHRASES.medium;
      return phrases[Math.floor(Math.random() * phrases.length)];
    }

    // Use hedging language
    const hedges = UNCERTAINTY_PHRASES.hedging;
    return hedges[Math.floor(Math.random() * hedges.length)];
  }

  /**
   * Check if uncertainty should be acknowledged
   */
  shouldAcknowledgeUncertainty(confidence: number): boolean {
    return confidence < UNCERTAINTY_THRESHOLD;
  }

  /**
   * Log verification to database
   */
  async logVerification(
    callId: string,
    verification: {
      claimText: string;
      claimType: string;
      verificationResult: string;
      confidence: number;
      verifiedAgainst?: string;
      responseGenerated?: string;
    }
  ): Promise<FactVerification> {
    return await prisma.factVerification.create({
      data: {
        callId,
        claimText: verification.claimText,
        claimType: verification.claimType,
        verificationResult: verification.verificationResult,
        confidence: verification.confidence,
        verifiedAgainst: verification.verifiedAgainst,
        responseGenerated: verification.responseGenerated,
        uncertaintyAcknowledged: verification.confidence < UNCERTAINTY_THRESHOLD,
      },
    });
  }

  /**
   * Get verification history for a call
   */
  async getVerificationHistory(callId: string): Promise<FactVerification[]> {
    return await prisma.factVerification.findMany({
      where: { callId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const factVerificationService = new FactVerificationService();
