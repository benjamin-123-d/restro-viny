-- CreateEnum
CREATE TYPE "PurchasingMode" AS ENUM ('DIRECT', 'FULL');

-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('DENREES', 'BOISSONS', 'ENTRETIEN', 'MATERIEL', 'EMBALLAGES', 'AUTRE');

-- AlterTable
ALTER TABLE "IngredientPurchase" ADD COLUMN     "purchaseInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "isDirectPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMode" "PaymentMode";

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "purchasingMode" "PurchasingMode" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "PurchaseExpenseLine" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "category" "PurchaseCategory" NOT NULL,
    "label" TEXT,
    "amountHT" DECIMAL(14,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseExpenseLine_restaurantId_category_idx" ON "PurchaseExpenseLine"("restaurantId", "category");

-- CreateIndex
CREATE INDEX "PurchaseExpenseLine_purchaseInvoiceId_idx" ON "PurchaseExpenseLine"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "IngredientPurchase_purchaseInvoiceId_idx" ON "IngredientPurchase"("purchaseInvoiceId");

-- AddForeignKey
ALTER TABLE "IngredientPurchase" ADD CONSTRAINT "IngredientPurchase_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpenseLine" ADD CONSTRAINT "PurchaseExpenseLine_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpenseLine" ADD CONSTRAINT "PurchaseExpenseLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
