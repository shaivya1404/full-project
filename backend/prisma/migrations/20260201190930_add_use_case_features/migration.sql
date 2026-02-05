-- CreateTable
CREATE TABLE "CallObjection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callLogId" TEXT NOT NULL,
    "objectionType" TEXT NOT NULL,
    "objectionText" TEXT,
    "responseUsed" TEXT,
    "wasResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallObjection_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "CallLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjectionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "objectionType" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "suggestedResponse" TEXT NOT NULL,
    "successRate" REAL NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ObjectionTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DNDRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContactConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL,
    "consentDate" DATETIME NOT NULL,
    "consentMethod" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "recordingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactConsent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "callId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "checkResult" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CallbackSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT,
    "scheduledTime" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "reason" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "completedAt" DATETIME,
    "resultCallId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallbackSchedule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallbackSchedule_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallbackSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoreInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "operatingHours" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minOrderAmount" REAL NOT NULL DEFAULT 0,
    "avgPrepTime" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreInfo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "postalCodes" TEXT NOT NULL,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "minOrderAmount" REAL NOT NULL DEFAULT 0,
    "estimatedTime" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryZone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "StoreInfo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "duration" INTEGER,
    "result" TEXT NOT NULL DEFAULT 'pending',
    "recordingUrl" TEXT,
    "transcript" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentimentScore" REAL,
    "escalationReason" TEXT,
    "wasEscalated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CallLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CallLog" ("campaignId", "contactId", "createdAt", "duration", "id", "recordingUrl", "result", "transcript", "updatedAt") SELECT "campaignId", "contactId", "createdAt", "duration", "id", "recordingUrl", "result", "transcript", "updatedAt" FROM "CallLog";
DROP TABLE "CallLog";
ALTER TABLE "new_CallLog" RENAME TO "CallLog";
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "isDoNotCall" BOOLEAN NOT NULL DEFAULT false,
    "validationError" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "leadTier" TEXT NOT NULL DEFAULT 'unknown',
    "leadSource" TEXT,
    "interestLevel" INTEGER NOT NULL DEFAULT 0,
    "buyingSignals" TEXT,
    "lastScoredAt" DATETIME,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "successfulCalls" INTEGER NOT NULL DEFAULT 0,
    "lastContactedAt" DATETIME,
    "preferredCallTime" TEXT,
    "timezone" TEXT,
    CONSTRAINT "Contact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("campaignId", "createdAt", "email", "id", "isDoNotCall", "isValid", "metadata", "name", "phone", "updatedAt", "validationError") SELECT "campaignId", "createdAt", "email", "id", "isDoNotCall", "isValid", "metadata", "name", "phone", "updatedAt", "validationError" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "price" REAL,
    "details" TEXT,
    "faqs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sku" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("category", "createdAt", "description", "details", "faqs", "id", "name", "price", "teamId", "updatedAt") SELECT "category", "createdAt", "description", "details", "faqs", "id", "name", "price", "teamId", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_teamId_idx" ON "Product"("teamId");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_sku_idx" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CallObjection_callLogId_idx" ON "CallObjection"("callLogId");

-- CreateIndex
CREATE INDEX "CallObjection_objectionType_idx" ON "CallObjection"("objectionType");

-- CreateIndex
CREATE INDEX "ObjectionTemplate_teamId_idx" ON "ObjectionTemplate"("teamId");

-- CreateIndex
CREATE INDEX "ObjectionTemplate_objectionType_idx" ON "ObjectionTemplate"("objectionType");

-- CreateIndex
CREATE UNIQUE INDEX "DNDRegistry_phoneNumber_key" ON "DNDRegistry"("phoneNumber");

-- CreateIndex
CREATE INDEX "DNDRegistry_phoneNumber_idx" ON "DNDRegistry"("phoneNumber");

-- CreateIndex
CREATE INDEX "DNDRegistry_source_idx" ON "DNDRegistry"("source");

-- CreateIndex
CREATE INDEX "ContactConsent_contactId_idx" ON "ContactConsent"("contactId");

-- CreateIndex
CREATE INDEX "ContactConsent_consentType_idx" ON "ContactConsent"("consentType");

-- CreateIndex
CREATE INDEX "ComplianceLog_teamId_idx" ON "ComplianceLog"("teamId");

-- CreateIndex
CREATE INDEX "ComplianceLog_phoneNumber_idx" ON "ComplianceLog"("phoneNumber");

-- CreateIndex
CREATE INDEX "ComplianceLog_checkType_idx" ON "ComplianceLog"("checkType");

-- CreateIndex
CREATE INDEX "ComplianceLog_createdAt_idx" ON "ComplianceLog"("createdAt");

-- CreateIndex
CREATE INDEX "CallbackSchedule_teamId_idx" ON "CallbackSchedule"("teamId");

-- CreateIndex
CREATE INDEX "CallbackSchedule_contactId_idx" ON "CallbackSchedule"("contactId");

-- CreateIndex
CREATE INDEX "CallbackSchedule_campaignId_idx" ON "CallbackSchedule"("campaignId");

-- CreateIndex
CREATE INDEX "CallbackSchedule_scheduledTime_idx" ON "CallbackSchedule"("scheduledTime");

-- CreateIndex
CREATE INDEX "CallbackSchedule_status_idx" ON "CallbackSchedule"("status");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInfo_teamId_key" ON "StoreInfo"("teamId");

-- CreateIndex
CREATE INDEX "DeliveryZone_storeId_idx" ON "DeliveryZone"("storeId");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_idx" ON "DeliveryZone"("isActive");
