-- CreateTable
CREATE TABLE "CustomerMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "factKey" TEXT NOT NULL,
    "factValue" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "learnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerMemory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "streamSid" TEXT NOT NULL,
    "customerId" TEXT,
    "collectedFields" TEXT NOT NULL DEFAULT '{}',
    "pendingConfirmations" TEXT,
    "questionHistory" TEXT NOT NULL DEFAULT '[]',
    "responseHistory" TEXT NOT NULL DEFAULT '[]',
    "loopDetected" BOOLEAN NOT NULL DEFAULT false,
    "loopType" TEXT,
    "currentEmotion" TEXT NOT NULL DEFAULT 'neutral',
    "emotionScore" REAL NOT NULL DEFAULT 0.5,
    "emotionHistory" TEXT,
    "conversationStage" TEXT NOT NULL DEFAULT 'greeting',
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" TEXT,
    "stepsRemaining" TEXT,
    "apologyGiven" BOOLEAN NOT NULL DEFAULT false,
    "apologyReason" TEXT,
    "promisesMade" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConversationState_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "transferLogId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerId" TEXT,
    "isReturningCustomer" BOOLEAN NOT NULL DEFAULT false,
    "customerTier" TEXT,
    "conversationSummary" TEXT NOT NULL,
    "topicsDiscussed" TEXT NOT NULL,
    "callDuration" INTEGER,
    "primaryIssue" TEXT,
    "issueCategory" TEXT,
    "issueSeverity" TEXT NOT NULL DEFAULT 'medium',
    "overallSentiment" TEXT,
    "sentimentScore" REAL,
    "currentEmotion" TEXT,
    "frustrationLevel" INTEGER NOT NULL DEFAULT 0,
    "attemptedSolutions" TEXT,
    "whatWorked" TEXT,
    "whatDidntWork" TEXT,
    "recommendations" TEXT,
    "warningsForAgent" TEXT,
    "collectedInfo" TEXT,
    "verifiedFacts" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferContext_transferLogId_fkey" FOREIGN KEY ("transferLogId") REFERENCES "TransferLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FactVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "verifiedAgainst" TEXT,
    "verificationResult" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "responseGenerated" TEXT,
    "uncertaintyAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactVerification_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmotionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "triggerPatterns" TEXT NOT NULL,
    "responseTemplate" TEXT NOT NULL,
    "toneGuidance" TEXT,
    "escalationThreshold" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmotionTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApologyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "isSpecific" BOOLEAN NOT NULL DEFAULT true,
    "template" TEXT NOT NULL,
    "followUpAction" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "effectivenessScore" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApologyTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomerMemory_customerId_idx" ON "CustomerMemory"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMemory_teamId_idx" ON "CustomerMemory"("teamId");

-- CreateIndex
CREATE INDEX "CustomerMemory_factType_idx" ON "CustomerMemory"("factType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMemory_customerId_factType_factKey_key" ON "CustomerMemory"("customerId", "factType", "factKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_callId_key" ON "ConversationState"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_streamSid_key" ON "ConversationState"("streamSid");

-- CreateIndex
CREATE UNIQUE INDEX "TransferContext_transferLogId_key" ON "TransferContext"("transferLogId");

-- CreateIndex
CREATE INDEX "TransferContext_callId_idx" ON "TransferContext"("callId");

-- CreateIndex
CREATE INDEX "TransferContext_transferLogId_idx" ON "TransferContext"("transferLogId");

-- CreateIndex
CREATE INDEX "FactVerification_callId_idx" ON "FactVerification"("callId");

-- CreateIndex
CREATE INDEX "FactVerification_claimType_idx" ON "FactVerification"("claimType");

-- CreateIndex
CREATE INDEX "EmotionTemplate_teamId_idx" ON "EmotionTemplate"("teamId");

-- CreateIndex
CREATE INDEX "EmotionTemplate_emotion_idx" ON "EmotionTemplate"("emotion");

-- CreateIndex
CREATE INDEX "ApologyTemplate_teamId_idx" ON "ApologyTemplate"("teamId");

-- CreateIndex
CREATE INDEX "ApologyTemplate_situation_idx" ON "ApologyTemplate"("situation");
