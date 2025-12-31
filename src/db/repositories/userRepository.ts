import { PrismaClient, User, Session, TeamMember, ApiKey, Team } from '@prisma/client';
import { getPrismaClient } from '../client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export interface UserWithMemberships extends User {
  teamMemberships?: (TeamMember & { team: { id: string; name: string } })[];
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
}

export class UserRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 12);

    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
      },
    });
  }

  async getUserById(id: string): Promise<UserWithMemberships | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        teamMemberships: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async getUserByEmail(email: string): Promise<UserWithMemberships | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        teamMemberships: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        email: data.email?.toLowerCase().trim(),
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
      },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<User> {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateLastLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async deactivateUser(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    accessTokenExpiresAt: Date,
    refreshTokenExpiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  async getSessionByAccessToken(accessToken: string): Promise<(Session & { user: User }) | null> {
    return this.prisma.session.findUnique({
      where: { accessToken },
      include: {
        user: true,
      },
    });
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<(Session & { user: User }) | null> {
    return this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: true,
      },
    });
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        accessTokenExpiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  async generateApiKey(
    userId: string,
    name: string,
    teamId?: string,
    expiresAt?: Date,
  ): Promise<ApiKey> {
    const key = `sk_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
    const secret = config.API_KEY_SECRET;
    const hashedKey = `${key.slice(0, 10)}${require('crypto')
      .createHmac('sha256', secret)
      .update(key)
      .digest('hex')
      .slice(0, 54)}`;

    return this.prisma.apiKey.create({
      data: {
        key: hashedKey,
        name,
        userId,
        teamId,
        expiresAt,
      },
    });
  }

  async validateApiKey(key: string): Promise<(ApiKey & { user: User; team?: Team | null }) | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key },
      include: {
        user: true,
        team: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    if (!apiKey.user.isActive) {
      return null;
    }

    return apiKey;
  }

  async updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  async deleteApiKey(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey.delete({
      where: { id: apiKeyId },
    });
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  generateAccessToken(userId: string, email: string, sessionId: string): string {
    return jwt.sign(
      { userId, email, sessionId },
      config.JWT_SECRET,
      { expiresIn: config.JWT_ACCESS_TOKEN_EXPIRY } as any,
    );
  }

  generateRefreshToken(userId: string, sessionId: string): string {
    return jwt.sign({ userId, sessionId }, config.JWT_SECRET, {
      expiresIn: config.JWT_REFRESH_TOKEN_EXPIRY } as any);
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}

export const getUserRepository = (): UserRepository => {
  return new UserRepository();
};
