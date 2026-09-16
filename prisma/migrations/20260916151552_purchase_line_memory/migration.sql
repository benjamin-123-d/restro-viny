-- CreateTable
CREATE TABLE "PurchaseLineMemory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT,
    "category" "PurchaseCategory" NOT NULL,
    "stockItemId" TEXT,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseLineMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseLineMemory_restaurantId_code_idx" ON "PurchaseLineMemory"("restaurantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLineMemory_restaurantId_key_key" ON "PurchaseLineMemory"("restaurantId", "key");

-- AddForeignKey
ALTER TABLE "PurchaseLineMemory" ADD CONSTRAINT "PurchaseLineMemory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineMemory" ADD CONSTRAINT "PurchaseLineMemory_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
