-- CreateTable
CREATE TABLE "FollowUpSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxExecutions" INTEGER NOT NULL DEFAULT 1,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpSequence_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpSequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "delayType" TEXT NOT NULL DEFAULT 'after_previous',
    "specificTime" TEXT,
    "templateContent" TEXT,
    "subject" TEXT,
    "callbackPriority" INTEGER,
    "conditions" TEXT,
    "skipIfContacted" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "FollowUpSequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "callLogId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelReason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpExecution_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "FollowUpSequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpExecution_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "CallLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpStepExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" DATETIME,
    "executedAt" DATETIME,
    "result" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpStepExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FollowUpExecution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpStepExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FollowUpStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Rewards Program',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pointsPerRupee" REAL NOT NULL DEFAULT 1,
    "minimumOrderAmount" REAL NOT NULL DEFAULT 0,
    "pointsExpireDays" INTEGER,
    "referralPoints" INTEGER NOT NULL DEFAULT 100,
    "refereePoints" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyProgram_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER,
    "multiplier" REAL NOT NULL DEFAULT 1,
    "benefits" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "tierOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyTier_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerLoyalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tierId" TEXT,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "totalPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimeValue" REAL NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt" DATETIME,
    "memberSince" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerLoyalty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerLoyalty_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerLoyalty_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LoyaltyTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerLoyaltyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "orderId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyTransaction_customerLoyaltyId_fkey" FOREIGN KEY ("customerLoyaltyId") REFERENCES "CustomerLoyalty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "minOrderAmount" REAL,
    "maxDiscount" REAL,
    "productId" TEXT,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "maxRedemptions" INTEGER,
    "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reward_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerLoyaltyId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "code" TEXT NOT NULL,
    "usedAt" DATETIME,
    "orderId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RewardRedemption_customerLoyaltyId_fkey" FOREIGN KEY ("customerLoyaltyId") REFERENCES "CustomerLoyalty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FollowUpSequence_teamId_idx" ON "FollowUpSequence"("teamId");

-- CreateIndex
CREATE INDEX "FollowUpSequence_campaignId_idx" ON "FollowUpSequence"("campaignId");

-- CreateIndex
CREATE INDEX "FollowUpSequence_triggerEvent_idx" ON "FollowUpSequence"("triggerEvent");

-- CreateIndex
CREATE INDEX "FollowUpStep_sequenceId_idx" ON "FollowUpStep"("sequenceId");

-- CreateIndex
CREATE INDEX "FollowUpStep_stepOrder_idx" ON "FollowUpStep"("stepOrder");

-- CreateIndex
CREATE INDEX "FollowUpExecution_sequenceId_idx" ON "FollowUpExecution"("sequenceId");

-- CreateIndex
CREATE INDEX "FollowUpExecution_contactId_idx" ON "FollowUpExecution"("contactId");

-- CreateIndex
CREATE INDEX "FollowUpExecution_status_idx" ON "FollowUpExecution"("status");

-- CreateIndex
CREATE INDEX "FollowUpStepExecution_executionId_idx" ON "FollowUpStepExecution"("executionId");

-- CreateIndex
CREATE INDEX "FollowUpStepExecution_stepId_idx" ON "FollowUpStepExecution"("stepId");

-- CreateIndex
CREATE INDEX "FollowUpStepExecution_status_idx" ON "FollowUpStepExecution"("status");

-- CreateIndex
CREATE INDEX "FollowUpStepExecution_scheduledFor_idx" ON "FollowUpStepExecution"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_teamId_key" ON "LoyaltyProgram"("teamId");

-- CreateIndex
CREATE INDEX "LoyaltyTier_programId_idx" ON "LoyaltyTier"("programId");

-- CreateIndex
CREATE INDEX "LoyaltyTier_tierOrder_idx" ON "LoyaltyTier"("tierOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLoyalty_customerId_key" ON "CustomerLoyalty"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLoyalty_referralCode_key" ON "CustomerLoyalty"("referralCode");

-- CreateIndex
CREATE INDEX "CustomerLoyalty_customerId_idx" ON "CustomerLoyalty"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLoyalty_teamId_idx" ON "CustomerLoyalty"("teamId");

-- CreateIndex
CREATE INDEX "CustomerLoyalty_tierId_idx" ON "CustomerLoyalty"("tierId");

-- CreateIndex
CREATE INDEX "CustomerLoyalty_referralCode_idx" ON "CustomerLoyalty"("referralCode");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customerLoyaltyId_idx" ON "LoyaltyTransaction"("customerLoyaltyId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_expiresAt_idx" ON "LoyaltyTransaction"("expiresAt");

-- CreateIndex
CREATE INDEX "Reward_programId_idx" ON "Reward"("programId");

-- CreateIndex
CREATE INDEX "Reward_type_idx" ON "Reward"("type");

-- CreateIndex
CREATE INDEX "Reward_isActive_idx" ON "Reward"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_code_key" ON "RewardRedemption"("code");

-- CreateIndex
CREATE INDEX "RewardRedemption_customerLoyaltyId_idx" ON "RewardRedemption"("customerLoyaltyId");

-- CreateIndex
CREATE INDEX "RewardRedemption_rewardId_idx" ON "RewardRedemption"("rewardId");

-- CreateIndex
CREATE INDEX "RewardRedemption_code_idx" ON "RewardRedemption"("code");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_idx" ON "RewardRedemption"("status");

-- CreateIndex
CREATE INDEX "RewardRedemption_expiresAt_idx" ON "RewardRedemption"("expiresAt");
