-- CreateEnum
CREATE TYPE "SupplierHoldType" AS ENUM ('ALL', 'INVOICES', 'PAYMENTS');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierQuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_ORDERED', 'ORDERED', 'STOPPED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ON_HOLD', 'TO_RECEIVE_AND_BILL', 'TO_RECEIVE', 'TO_BILL', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('DRAFT', 'TO_BILL', 'PARTLY_BILLED', 'COMPLETED', 'RETURN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'UNPAID', 'PARTLY_PAID', 'PAID', 'OVERDUE', 'RETURN', 'DEBIT_NOTE_ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScorecardStanding" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'POOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMode" ADD VALUE 'BANK_TRANSFER';
ALTER TYPE "PaymentMode" ADD VALUE 'CHEQUE';
ALTER TYPE "PaymentMode" ADD VALUE 'MOBILE_MONEY';

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "defaultSupplierId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "purchaseReceiptItemId" TEXT;

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierGroup" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPaymentTermsDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierGroupId" TEXT,
    "taxId" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "paymentTermsDays" INTEGER,
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "holdType" "SupplierHoldType",
    "releaseDate" TIMESTAMP(3),
    "preventRfq" BOOLEAN NOT NULL DEFAULT false,
    "preventPo" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestForQuotation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "message" TEXT,
    "termsText" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestForQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqItem" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "requiredBy" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RfqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplier" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RfqSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rfqId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" "SupplierQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "termsText" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "rfqItemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "leadTimeDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierQuotationId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduleDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "billedPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "advancePaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "termsText" TEXT,
    "holdComment" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "supplierQuotationItemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "scheduleDate" TIMESTAMP(3),
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "billedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierDeliveryNote" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "billedPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "returnAgainstId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rejectedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "rate" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "billedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "purchaseReceiptId" TEXT,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updateStock" BOOLEAN NOT NULL DEFAULT false,
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "returnAgainstId" TEXT,
    "notes" TEXT,
    "termsText" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceItem" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "purchaseReceiptItemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePaymentSchedule" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "invoicePortion" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchasePaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(14,2) NOT NULL,
    "unallocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "referenceNo" TEXT,
    "referenceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentAllocation" (
    "id" TEXT NOT NULL,
    "supplierPaymentId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierScorecardPeriod" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "onTimeDeliveryPercent" DECIMAL(5,2) NOT NULL,
    "qualityAcceptedPercent" DECIMAL(5,2) NOT NULL,
    "priceVariancePercent" DECIMAL(6,2) NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalReceipts" INTEGER NOT NULL DEFAULT 0,
    "totalPurchaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "score" DECIMAL(5,2) NOT NULL,
    "standing" "ScorecardStanding" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierScorecardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_restaurantId_docType_key" ON "DocumentSequence"("restaurantId", "docType");

-- CreateIndex
CREATE INDEX "SupplierGroup_restaurantId_idx" ON "SupplierGroup"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierGroup_restaurantId_name_key" ON "SupplierGroup"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "Supplier_restaurantId_idx" ON "Supplier"("restaurantId");

-- CreateIndex
CREATE INDEX "Supplier_supplierGroupId_idx" ON "Supplier"("supplierGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_restaurantId_code_key" ON "Supplier"("restaurantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_restaurantId_name_key" ON "Supplier"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "RequestForQuotation_restaurantId_status_idx" ON "RequestForQuotation"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequestForQuotation_restaurantId_number_key" ON "RequestForQuotation"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "RfqItem_rfqId_idx" ON "RfqItem"("rfqId");

-- CreateIndex
CREATE INDEX "RfqItem_stockItemId_idx" ON "RfqItem"("stockItemId");

-- CreateIndex
CREATE INDEX "RfqSupplier_supplierId_idx" ON "RfqSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqSupplier_rfqId_supplierId_key" ON "RfqSupplier"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_restaurantId_status_idx" ON "SupplierQuotation"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "SupplierQuotation_supplierId_idx" ON "SupplierQuotation"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_rfqId_idx" ON "SupplierQuotation"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_restaurantId_number_key" ON "SupplierQuotation"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "SupplierQuotationItem_quotationId_idx" ON "SupplierQuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "SupplierQuotationItem_stockItemId_idx" ON "SupplierQuotationItem"("stockItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_restaurantId_status_idx" ON "PurchaseOrder"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_restaurantId_number_key" ON "PurchaseOrder"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_stockItemId_idx" ON "PurchaseOrderItem"("stockItemId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_restaurantId_status_idx" ON "PurchaseReceipt"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_supplierId_idx" ON "PurchaseReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_purchaseOrderId_idx" ON "PurchaseReceipt"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_restaurantId_number_key" ON "PurchaseReceipt"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_purchaseReceiptId_idx" ON "PurchaseReceiptItem"("purchaseReceiptId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_stockItemId_idx" ON "PurchaseReceiptItem"("stockItemId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_restaurantId_status_idx" ON "PurchaseInvoice"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_supplierId_idx" ON "PurchaseInvoice"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_dueDate_idx" ON "PurchaseInvoice"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_restaurantId_number_key" ON "PurchaseInvoice"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceItem_purchaseInvoiceId_idx" ON "PurchaseInvoiceItem"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceItem_stockItemId_idx" ON "PurchaseInvoiceItem"("stockItemId");

-- CreateIndex
CREATE INDEX "PurchasePaymentSchedule_purchaseInvoiceId_idx" ON "PurchasePaymentSchedule"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPayment_restaurantId_paymentDate_idx" ON "SupplierPayment"("restaurantId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_restaurantId_number_key" ON "SupplierPayment"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "SupplierPaymentAllocation_purchaseInvoiceId_idx" ON "SupplierPaymentAllocation"("purchaseInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentAllocation_supplierPaymentId_purchaseInvoice_key" ON "SupplierPaymentAllocation"("supplierPaymentId", "purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierScorecardPeriod_restaurantId_idx" ON "SupplierScorecardPeriod"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierScorecardPeriod_supplierId_periodStart_periodEnd_key" ON "SupplierScorecardPeriod"("supplierId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseReceiptItemId_fkey" FOREIGN KEY ("purchaseReceiptItemId") REFERENCES "PurchaseReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierGroup" ADD CONSTRAINT "SupplierGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_supplierGroupId_fkey" FOREIGN KEY ("supplierGroupId") REFERENCES "SupplierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestForQuotation" ADD CONSTRAINT "RequestForQuotation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RequestForQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RequestForQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RequestForQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "RfqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_supplierQuotationItemId_fkey" FOREIGN KEY ("supplierQuotationItemId") REFERENCES "SupplierQuotationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_returnAgainstId_fkey" FOREIGN KEY ("returnAgainstId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_returnAgainstId_fkey" FOREIGN KEY ("returnAgainstId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_purchaseReceiptItemId_fkey" FOREIGN KEY ("purchaseReceiptItemId") REFERENCES "PurchaseReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePaymentSchedule" ADD CONSTRAINT "PurchasePaymentSchedule_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierScorecardPeriod" ADD CONSTRAINT "SupplierScorecardPeriod_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierScorecardPeriod" ADD CONSTRAINT "SupplierScorecardPeriod_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
