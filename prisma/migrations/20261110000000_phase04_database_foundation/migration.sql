-- CreateTable
CREATE TABLE "StoredMessage" (
    "ingestionOrder" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "receivedAt" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "detectedClasses" TEXT NOT NULL,
    "resultSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StoredListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageIngestionOrder" INTEGER NOT NULL,
    "offerIndex" INTEGER NOT NULL,
    "purpose" TEXT,
    "propertyType" TEXT,
    "city" TEXT,
    "district" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" REAL,
    "priceAmount" REAL,
    "priceCurrency" TEXT NOT NULL,
    "pricePeriod" TEXT,
    "contactPhone" TEXT,
    "needsReview" BOOLEAN NOT NULL,
    "originallyNeedsReview" BOOLEAN NOT NULL,
    "reviewReasons" TEXT NOT NULL,
    "approvalState" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" DATETIME,
    "provenance" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredListing_messageIngestionOrder_fkey" FOREIGN KEY ("messageIngestionOrder") REFERENCES "StoredMessage" ("ingestionOrder") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredMessage_id_key" ON "StoredMessage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "StoredListing_messageIngestionOrder_offerIndex_key" ON "StoredListing"("messageIngestionOrder", "offerIndex");

-- CreateIndex
CREATE INDEX "StoredListing_needsReview_idx" ON "StoredListing"("needsReview");
