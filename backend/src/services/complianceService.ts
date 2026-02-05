import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Default quiet hours (9 AM - 9 PM)
const DEFAULT_QUIET_HOURS = {
  start: 9, // 9 AM
  end: 21   // 9 PM
};

export interface DNDCheckResult {
  isDND: boolean;
  source?: string;
  registeredAt?: Date;
  expiresAt?: Date | null;
}

export interface ConsentStatus {
  hasConsent: boolean;
  consentType?: string;
  consentDate?: Date;
  consentMethod?: string;
  expiresAt?: Date | null;
}

export interface CanContactResult {
  allowed: boolean;
  reason?: string;
  checks: {
    dnd: boolean;
    quietHours: boolean;
    consent: boolean;
  };
}

export interface ComplianceLogEntry {
  teamId?: string;
  callId?: string;
  phoneNumber: string;
  checkType: 'dnd_check' | 'quiet_hours' | 'consent_verify';
  checkResult: 'passed' | 'failed' | 'warning';
  details?: string;
}

export class ComplianceService {
  /**
   * Check if phone number is in DND registry
   */
  async checkDND(phoneNumber: string): Promise<DNDCheckResult> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    const dndEntry = await prisma.dNDRegistry.findUnique({
      where: { phoneNumber: normalizedPhone }
    });

    if (!dndEntry) {
      return { isDND: false };
    }

    // Check if DND has expired
    if (dndEntry.expiresAt && new Date(dndEntry.expiresAt) < new Date()) {
      // DND expired, remove from registry
      await prisma.dNDRegistry.delete({
        where: { id: dndEntry.id }
      });
      return { isDND: false };
    }

    return {
      isDND: true,
      source: dndEntry.source,
      registeredAt: dndEntry.registeredAt,
      expiresAt: dndEntry.expiresAt
    };
  }

  /**
   * Add phone number to DND registry
   */
  async addToDND(
    phoneNumber: string,
    source: 'national' | 'internal' | 'customer_request',
    expiresAt?: Date
  ): Promise<void> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    await prisma.dNDRegistry.upsert({
      where: { phoneNumber: normalizedPhone },
      create: {
        phoneNumber: normalizedPhone,
        source,
        registeredAt: new Date(),
        expiresAt
      },
      update: {
        source,
        registeredAt: new Date(),
        expiresAt
      }
    });

    logger.info(`Phone ${normalizedPhone} added to DND registry (source: ${source})`);
  }

  /**
   * Remove phone number from DND registry
   */
  async removeFromDND(phoneNumber: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      await prisma.dNDRegistry.delete({
        where: { phoneNumber: normalizedPhone }
      });
      logger.info(`Phone ${normalizedPhone} removed from DND registry`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if current time is within calling hours
   */
  isWithinCallingHours(timezone: string = 'Asia/Kolkata'): boolean {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      });
      const currentHour = parseInt(formatter.format(now), 10);

      return currentHour >= DEFAULT_QUIET_HOURS.start && currentHour < DEFAULT_QUIET_HOURS.end;
    } catch {
      // Default to allowing calls if timezone is invalid
      const currentHour = new Date().getHours();
      return currentHour >= DEFAULT_QUIET_HOURS.start && currentHour < DEFAULT_QUIET_HOURS.end;
    }
  }

  /**
   * Get quiet hours configuration
   */
  getQuietHours(): { start: number; end: number } {
    return { ...DEFAULT_QUIET_HOURS };
  }

  /**
   * Verify consent for a contact
   */
  async verifyConsent(
    contactId: string,
    consentType: 'call' | 'sms' | 'email' | 'whatsapp'
  ): Promise<ConsentStatus> {
    const consent = await prisma.contactConsent.findFirst({
      where: {
        contactId,
        consentType,
        consentGiven: true
      },
      orderBy: { consentDate: 'desc' }
    });

    if (!consent) {
      return { hasConsent: false };
    }

    // Check if consent has expired
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return { hasConsent: false };
    }

    return {
      hasConsent: true,
      consentType: consent.consentType,
      consentDate: consent.consentDate,
      consentMethod: consent.consentMethod,
      expiresAt: consent.expiresAt
    };
  }

  /**
   * Record consent for a contact
   */
  async recordConsent(
    contactId: string,
    consentType: 'call' | 'sms' | 'email' | 'whatsapp',
    consentGiven: boolean,
    method: 'verbal' | 'written' | 'web_form',
    recordingUrl?: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.contactConsent.create({
      data: {
        contactId,
        consentType,
        consentGiven,
        consentDate: new Date(),
        consentMethod: method,
        recordingUrl,
        expiresAt
      }
    });

    logger.info(`Consent recorded for contact ${contactId}: ${consentType} = ${consentGiven}`);
  }

  /**
   * Check if a contact can be contacted now
   */
  async canContactNow(
    contactId: string,
    phoneNumber: string,
    timezone?: string
  ): Promise<CanContactResult> {
    const checks = {
      dnd: true,
      quietHours: true,
      consent: true
    };

    // Check DND
    const dndResult = await this.checkDND(phoneNumber);
    if (dndResult.isDND) {
      checks.dnd = false;
      await this.logComplianceCheck({
        phoneNumber,
        checkType: 'dnd_check',
        checkResult: 'failed',
        details: `DND registered via ${dndResult.source}`
      });
      return {
        allowed: false,
        reason: `Phone number is on DND registry (${dndResult.source})`,
        checks
      };
    }

    // Check quiet hours
    if (!this.isWithinCallingHours(timezone)) {
      checks.quietHours = false;
      await this.logComplianceCheck({
        phoneNumber,
        checkType: 'quiet_hours',
        checkResult: 'failed',
        details: 'Outside calling hours'
      });
      return {
        allowed: false,
        reason: 'Outside permitted calling hours',
        checks
      };
    }

    // Check consent
    const consentResult = await this.verifyConsent(contactId, 'call');
    if (!consentResult.hasConsent) {
      checks.consent = false;
      await this.logComplianceCheck({
        phoneNumber,
        checkType: 'consent_verify',
        checkResult: 'warning',
        details: 'No explicit consent on record'
      });
      // Note: We don't block on consent, just warn
    }

    await this.logComplianceCheck({
      phoneNumber,
      checkType: 'dnd_check',
      checkResult: 'passed'
    });

    return {
      allowed: true,
      checks
    };
  }

  /**
   * Log a compliance check
   */
  async logComplianceCheck(entry: ComplianceLogEntry): Promise<void> {
    await prisma.complianceLog.create({
      data: {
        teamId: entry.teamId,
        callId: entry.callId,
        phoneNumber: entry.phoneNumber,
        checkType: entry.checkType,
        checkResult: entry.checkResult,
        details: entry.details
      }
    });
  }

  /**
   * Get compliance logs
   */
  async getComplianceLogs(
    teamId?: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      checkType?: string;
      checkResult?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (teamId) where.teamId = teamId;
    if (filters?.checkType) where.checkType = filters.checkType;
    if (filters?.checkResult) where.checkResult = filters.checkResult;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.complianceLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.complianceLog.count({ where })
    ]);

    return { logs, total };
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStats(teamId?: string, days: number = 30): Promise<{
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    dndBlocked: number;
    quietHoursBlocked: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      createdAt: { gte: startDate }
    };
    if (teamId) where.teamId = teamId;

    const logs = await prisma.complianceLog.findMany({
      where,
      select: {
        checkType: true,
        checkResult: true
      }
    });

    return {
      totalChecks: logs.length,
      passed: logs.filter((l: any) => l.checkResult === 'passed').length,
      failed: logs.filter((l: any) => l.checkResult === 'failed').length,
      warnings: logs.filter((l: any) => l.checkResult === 'warning').length,
      dndBlocked: logs.filter((l: any) => l.checkType === 'dnd_check' && l.checkResult === 'failed').length,
      quietHoursBlocked: logs.filter((l: any) => l.checkType === 'quiet_hours' && l.checkResult === 'failed').length
    };
  }

  /**
   * Normalize phone number for consistent lookup
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with country code
    if (!normalized.startsWith('+')) {
      // Assume India (+91) if no country code
      if (normalized.length === 10) {
        normalized = '+91' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Bulk import DND numbers
   */
  async bulkImportDND(
    phoneNumbers: string[],
    source: 'national' | 'internal' | 'customer_request'
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const phone of phoneNumbers) {
      try {
        const normalizedPhone = this.normalizePhoneNumber(phone);
        await prisma.dNDRegistry.upsert({
          where: { phoneNumber: normalizedPhone },
          create: {
            phoneNumber: normalizedPhone,
            source,
            registeredAt: new Date()
          },
          update: {
            source,
            registeredAt: new Date()
          }
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    logger.info(`Bulk DND import: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped };
  }
}

export const complianceService = new ComplianceService();
