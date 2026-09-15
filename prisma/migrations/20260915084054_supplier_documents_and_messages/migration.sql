-- CreateEnum
CREATE TYPE "PurchaseDocumentKind" AS ENUM ('QUOTATION', 'INVOICE');

-- CreateEnum
CREATE TYPE "PurchaseDocumentSource" AS ENUM ('FILE', 'PHOTO', 'EMAIL');

-- CreateEnum
CREATE TYPE "SupplierMessageStatus" AS ENUM ('SENT', 'FAILED', 'MAILTO');

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "summaryOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupplierQuotation" ADD COLUMN     "summaryOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierReference" TEXT;

-- CreateTable
CREATE TABLE "PurchaseDocument" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" "PurchaseDocumentKind" NOT NULL,
    "source" "PurchaseDocumentSource" NOT NULL DEFAULT 'FILE',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "quotationId" TEXT,
    "invoiceId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMessage" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rfqId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SupplierMessageStatus" NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseDocument_restaurantId_kind_idx" ON "PurchaseDocument"("restaurantId", "kind");

-- CreateIndex
CREATE INDEX "PurchaseDocument_quotationId_idx" ON "PurchaseDocument"("quotationId");

-- CreateIndex
CREATE INDEX "PurchaseDocument_invoiceId_idx" ON "PurchaseDocument"("invoiceId");

-- CreateIndex
CREATE INDEX "SupplierMessage_restaurantId_createdAt_idx" ON "SupplierMessage"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierMessage_supplierId_idx" ON "SupplierMessage"("supplierId");

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMessage" ADD CONSTRAINT "SupplierMessage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMessage" ADD CONSTRAINT "SupplierMessage_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMessage" ADD CONSTRAINT "SupplierMessage_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RequestForQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
