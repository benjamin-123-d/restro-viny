-- CreateEnum
CREATE TYPE "RecipeReliability" AS ENUM ('ESTIMATED', 'ADJUSTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "FoodInventoryStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "foodCost" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "foodCostSubRecipes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "isPreparation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPurchasePrice" DECIMAL(12,2),
ADD COLUMN     "preparationYield" DECIMAL(12,3),
ADD COLUMN     "purchaseFactor" DECIMAL(14,4) NOT NULL DEFAULT 1,
ADD COLUMN     "purchaseUnit" TEXT,
ADD COLUMN     "storageLocation" TEXT,
ADD COLUMN     "storageOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yieldPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
ALTER COLUMN "costPerUnit" SET DATA TYPE DECIMAL(16,6);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "unitCost" DECIMAL(16,6);

-- CreateTable
CREATE TABLE "RecipeCard" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "portions" INTEGER NOT NULL DEFAULT 1,
    "reliability" "RecipeReliability" NOT NULL DEFAULT 'ESTIMATED',
    "verifiedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparationComponent" (
    "id" TEXT NOT NULL,
    "preparationId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreparationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPurchase" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(12,3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "usageQuantity" DECIMAL(14,3) NOT NULL,
    "note" TEXT,
    "movementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodInventory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FoodInventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodInventoryLine" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "theoreticalQty" DECIMAL(14,3) NOT NULL,
    "countedQty" DECIMAL(14,3),
    "unitCost" DECIMAL(16,6) NOT NULL DEFAULT 0,
    "varianceQty" DECIMAL(14,3),
    "varianceValue" DECIMAL(12,2),

    CONSTRAINT "FoodInventoryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodLoss" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "lossAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockItemId" TEXT,
    "menuItemId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodLoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodProduction" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "preparationId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(16,6) NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodProduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCard_menuItemId_key" ON "RecipeCard"("menuItemId");

-- CreateIndex
CREATE INDEX "PreparationComponent_stockItemId_idx" ON "PreparationComponent"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PreparationComponent_preparationId_stockItemId_key" ON "PreparationComponent"("preparationId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPurchase_movementId_key" ON "IngredientPurchase"("movementId");

-- CreateIndex
CREATE INDEX "IngredientPurchase_restaurantId_purchasedAt_idx" ON "IngredientPurchase"("restaurantId", "purchasedAt");

-- CreateIndex
CREATE INDEX "FoodInventory_restaurantId_status_countedAt_idx" ON "FoodInventory"("restaurantId", "status", "countedAt");

-- CreateIndex
CREATE INDEX "FoodInventoryLine_stockItemId_idx" ON "FoodInventoryLine"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodInventoryLine_inventoryId_stockItemId_key" ON "FoodInventoryLine"("inventoryId", "stockItemId");

-- CreateIndex
CREATE INDEX "FoodLoss_restaurantId_lossAt_idx" ON "FoodLoss"("restaurantId", "lossAt");

-- CreateIndex
CREATE INDEX "FoodProduction_restaurantId_producedAt_idx" ON "FoodProduction"("restaurantId", "producedAt");

-- AddForeignKey
ALTER TABLE "RecipeCard" ADD CONSTRAINT "RecipeCard_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationComponent" ADD CONSTRAINT "PreparationComponent_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationComponent" ADD CONSTRAINT "PreparationComponent_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPurchase" ADD CONSTRAINT "IngredientPurchase_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPurchase" ADD CONSTRAINT "IngredientPurchase_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPurchase" ADD CONSTRAINT "IngredientPurchase_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodInventory" ADD CONSTRAINT "FoodInventory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodInventoryLine" ADD CONSTRAINT "FoodInventoryLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "FoodInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodInventoryLine" ADD CONSTRAINT "FoodInventoryLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLoss" ADD CONSTRAINT "FoodLoss_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLoss" ADD CONSTRAINT "FoodLoss_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLoss" ADD CONSTRAINT "FoodLoss_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduction" ADD CONSTRAINT "FoodProduction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduction" ADD CONSTRAINT "FoodProduction_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
