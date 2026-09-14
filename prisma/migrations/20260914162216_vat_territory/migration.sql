-- CreateEnum
CREATE TYPE "VatTerritory" AS ENUM ('METROPOLE', 'CORSE', 'GUADELOUPE', 'MARTINIQUE', 'REUNION', 'GUYANE', 'MAYOTTE');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "vatTerritory" "VatTerritory" NOT NULL DEFAULT 'METROPOLE';
