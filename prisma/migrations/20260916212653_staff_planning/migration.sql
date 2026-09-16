-- CreateEnum
CREATE TYPE "ShiftKind" AS ENUM ('TRAVAIL', 'FORMATION', 'REPOS', 'CONGE', 'MALADIE', 'ABSENCE');

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "weeklyHours" INTEGER;

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" "ShiftKind" NOT NULL DEFAULT 'TRAVAIL',
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_restaurantId_day_idx" ON "Shift"("restaurantId", "day");

-- CreateIndex
CREATE INDEX "Shift_staffId_day_idx" ON "Shift"("staffId", "day");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
