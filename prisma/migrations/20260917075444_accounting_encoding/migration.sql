-- CreateEnum
CREATE TYPE "AccountingPieceKind" AS ENUM ('ACHAT', 'VENTE');

-- CreateEnum
CREATE TYPE "AccountingPieceStatus" AS ENUM ('A_TRAITER', 'ENREGISTREE', 'COMPTABILISEE');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "accountingCode" TEXT;

-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN     "auxiliaryCode" TEXT,
ADD COLUMN     "auxiliaryName" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "accountingCode" TEXT;

-- CreateTable
CREATE TABLE "AccountingPiece" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" "AccountingPieceKind" NOT NULL,
    "status" "AccountingPieceStatus" NOT NULL DEFAULT 'A_TRAITER',
    "documentId" TEXT,
    "purchaseInvoiceId" TEXT,
    "salesInvoiceId" TEXT,
    "supplierId" TEXT,
    "customerId" TEXT,
    "thirdPartyName" TEXT,
    "auxiliaryCode" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "entryDate" TIMESTAMP(3),
    "amountTTC" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountHT" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "amountVAT" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "label" TEXT,
    "isCca" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" "PaymentMode",
    "paidOn" TIMESTAMP(3),
    "readFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "journalEntryId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPieceEvent" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPieceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingRule" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" "AccountingPieceKind" NOT NULL,
    "key" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "auxiliaryCode" TEXT,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPiece_journalEntryId_key" ON "AccountingPiece"("journalEntryId");

-- CreateIndex
CREATE INDEX "AccountingPiece_restaurantId_status_idx" ON "AccountingPiece"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "AccountingPiece_restaurantId_kind_idx" ON "AccountingPiece"("restaurantId", "kind");

-- CreateIndex
CREATE INDEX "AccountingPiece_purchaseInvoiceId_idx" ON "AccountingPiece"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "AccountingPiece_salesInvoiceId_idx" ON "AccountingPiece"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "AccountingPieceEvent_pieceId_createdAt_idx" ON "AccountingPieceEvent"("pieceId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountingRule_restaurantId_idx" ON "AccountingRule"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingRule_restaurantId_kind_key_key" ON "AccountingRule"("restaurantId", "kind", "key");

-- AddForeignKey
ALTER TABLE "AccountingPiece" ADD CONSTRAINT "AccountingPiece_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPiece" ADD CONSTRAINT "AccountingPiece_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PurchaseDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPiece" ADD CONSTRAINT "AccountingPiece_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPieceEvent" ADD CONSTRAINT "AccountingPieceEvent_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "AccountingPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRule" ADD CONSTRAINT "AccountingRule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
