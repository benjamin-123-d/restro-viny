-- CreateEnum
CREATE TYPE "StockCheckStatus" AS ENUM ('EN_ATTENTE', 'APPLIQUE', 'REFUSE');

-- AlterTable
ALTER TABLE "FoodLoss" ADD COLUMN     "createdByStaffId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "screens" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "createdByStaffId" TEXT;

-- CreateTable
CREATE TABLE "StockCheck" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockCheckStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCheckLine" (
    "id" TEXT NOT NULL,
    "stockCheckId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "theoreticalQty" DECIMAL(12,3) NOT NULL,
    "countedQty" DECIMAL(12,3),
    "unitCost" DECIMAL(16,6),

    CONSTRAINT "StockCheckLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBreakage" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT,
    "brokeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitValue" DECIMAL(12,2),
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentBreakage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCheck_restaurantId_status_idx" ON "StockCheck"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "StockCheck_restaurantId_checkedAt_idx" ON "StockCheck"("restaurantId", "checkedAt");

-- CreateIndex
CREATE INDEX "StockCheckLine_stockCheckId_idx" ON "StockCheckLine"("stockCheckId");

-- CreateIndex
CREATE INDEX "StockCheckLine_stockItemId_idx" ON "StockCheckLine"("stockItemId");

-- CreateIndex
CREATE INDEX "EquipmentBreakage_restaurantId_brokeAt_idx" ON "EquipmentBreakage"("restaurantId", "brokeAt");

-- AddForeignKey
ALTER TABLE "StockCheck" ADD CONSTRAINT "StockCheck_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheck" ADD CONSTRAINT "StockCheck_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheckLine" ADD CONSTRAINT "StockCheckLine_stockCheckId_fkey" FOREIGN KEY ("stockCheckId") REFERENCES "StockCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheckLine" ADD CONSTRAINT "StockCheckLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBreakage" ADD CONSTRAINT "EquipmentBreakage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBreakage" ADD CONSTRAINT "EquipmentBreakage_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
