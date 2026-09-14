-- CreateEnum
CREATE TYPE "TaxSystem" AS ENUM ('FR_VAT', 'IN_GST');

-- CreateEnum
CREATE TYPE "VatCategory" AS ENUM ('FOOD', 'SOFT_DRINK', 'ALCOHOL');

-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'MEAL_VOUCHER';

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "vatCategory" "VatCategory" NOT NULL DEFAULT 'FOOD';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "vatCategory" "VatCategory";

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "drinksLicense" TEXT,
ADD COLUMN     "legalForm" TEXT,
ADD COLUMN     "nafCode" TEXT,
ADD COLUMN     "rcs" TEXT,
ADD COLUMN     "shareCapital" TEXT,
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "taxSystem" "TaxSystem" NOT NULL DEFAULT 'FR_VAT',
ADD COLUMN     "vatNumber" TEXT,
ALTER COLUMN "country" SET DEFAULT 'FR';
