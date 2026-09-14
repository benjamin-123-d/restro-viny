import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

/**
 * One-off move of an existing restaurant from francs CFA to euros.
 *
 * The CFA franc is pegged to the euro at a legally fixed parity, so this is a
 * conversion, not an estimate: every amount keeps its value in its new
 * currency. Quantities and percentages are never touched — only columns that
 * hold money.
 *
 * Safe by construction:
 *   · every affected row is backed up to JSON before anything changes;
 *   · the whole conversion runs in one transaction, all or nothing;
 *   · it refuses to run on a restaurant already set to France, so it can never
 *     divide the same amounts twice.
 *
 *   npx tsx scripts/convert-xof-to-eur.ts            # dry run, shows the plan
 *   npx tsx scripts/convert-xof-to-eur.ts --apply    # backs up, then converts
 */

/** 1 EUR = 655,957 XOF — fixed parity since 1999. */
const XOF_PER_EUR = 655.957;

/** Money columns, grouped by table. Derived from the Decimal shapes in the
 *  schema: (10,2) (12,2) (14,2) are amounts, (14,4) are unit values. */
const MONEY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  MenuItem: ["price"],
  MenuItemVariant: ["price"],
  Modifier: ["priceDelta"],
  Order: ["subtotal", "taxTotal", "discountTotal", "compTotal", "roundOff", "grandTotal"],
  OrderItem: ["unitPrice"],
  OrderItemModifier: ["priceDelta"],
  Payment: ["amount", "tendered"],
  StockItem: ["costPerUnit"],
  SupplierQuotation: ["subtotal", "discountAmount", "taxTotal", "grandTotal"],
  SupplierQuotationItem: ["rate", "amount"],
  PurchaseOrder: ["subtotal", "discountAmount", "taxTotal", "roundOff", "grandTotal", "advancePaid"],
  PurchaseOrderItem: ["rate", "amount"],
  PurchaseReceipt: ["subtotal", "taxTotal", "grandTotal"],
  PurchaseReceiptItem: ["rate", "amount"],
  PurchaseInvoice: ["subtotal", "discountAmount", "taxTotal", "roundOff", "grandTotal", "paidAmount", "outstandingAmount"],
  PurchaseInvoiceItem: ["rate", "amount"],
  PurchasePaymentSchedule: ["amount", "paidAmount"],
  SupplierPayment: ["amount", "unallocatedAmount"],
  SupplierPaymentAllocation: ["amount"],
  SupplierScorecardPeriod: ["totalPurchaseAmount"],
  Customer: ["creditLimit"],
  SalesQuotation: ["subtotal", "discountAmount", "taxTotal", "roundOff", "grandTotal"],
  SalesQuotationItem: ["rate", "amount"],
  SalesOrder: ["subtotal", "discountAmount", "taxTotal", "roundOff", "grandTotal", "advanceReceived"],
  SalesOrderItem: ["rate", "amount"],
  DeliveryNote: ["subtotal", "taxTotal", "grandTotal"],
  DeliveryNoteItem: ["rate", "amount"],
  SalesInvoice: ["subtotal", "discountAmount", "taxTotal", "roundOff", "grandTotal", "paidAmount", "outstandingAmount"],
  SalesInvoiceItem: ["rate", "amount"],
  SalesPaymentSchedule: ["amount", "paidAmount"],
  CustomerPayment: ["amount", "unallocatedAmount"],
  CustomerPaymentAllocation: ["amount"],
  Bin: ["stockValue", "valuationRate"],
  StockEntry: ["totalValue"],
  StockEntryItem: ["amount", "valuationRate"],
  StockReconciliation: ["differenceValue"],
  StockReconciliationItem: ["valuationRate"],
  JournalEntry: ["totalDebit", "totalCredit"],
  JournalEntryLine: ["debit", "credit"],
  GLEntry: ["debit", "credit"],
};

/** Columns whose scale is 4 rather than 2. */
const FOUR_DECIMALS = new Set(["Bin.valuationRate", "StockEntryItem.valuationRate", "StockReconciliationItem.valuationRate"]);

/** Drinks in the current menu that are alcoholic, taxed at 20 %. */
const ALCOHOLIC_ITEMS = ["Biere locale", "Sodabi"];

const main = async () => {
  const apply = process.argv.includes("--apply");

  const restaurant = await prisma.restaurant.findFirst({
    select: { id: true, name: true, country: true },
  });
  if (!restaurant) throw new Error("Aucun restaurant.");

  if (restaurant.country === "FR") {
    console.log(`« ${restaurant.name} » est déjà en France : rien à convertir.`);
    return;
  }

  // ---- plan ---------------------------------------------------------------
  const counts: Record<string, number> = {};
  for (const table of Object.keys(MONEY_COLUMNS)) {
    const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM "${table}"`,
    );
    counts[table] = Number(row.n);
  }
  const touched = Object.entries(counts).filter(([, n]) => n > 0);
  console.log(`Restaurant : ${restaurant.name} (pays actuel ${restaurant.country})`);
  console.log(`Parité : 1 € = ${XOF_PER_EUR} XOF`);
  console.log(`Tables avec des montants à convertir :`);
  for (const [table, n] of touched) {
    console.log(`  ${table.padEnd(26)} ${String(n).padStart(5)} lignes · ${MONEY_COLUMNS[table].join(", ")}`);
  }

  const sample = await prisma.menuItem.findFirst({
    where: { name: "Poulet DG" },
    select: { price: true },
  });
  if (sample) {
    const eur = Math.round((Number(sample.price) / XOF_PER_EUR) * 100) / 100;
    console.log(`Exemple : Poulet DG ${Number(sample.price)} XOF → ${eur} €`);
  }

  if (!apply) {
    console.log("\nSimulation uniquement. Relancez avec --apply pour sauvegarder puis convertir.");
    return;
  }

  // ---- backup -------------------------------------------------------------
  const backup: Record<string, unknown[]> = {};
  for (const [table] of touched) {
    const cols = ["id", ...MONEY_COLUMNS[table]].map((c) => `"${c}"`).join(", ");
    const extra = table === "Order" ? `, "discountType", "discountValue"` : "";
    backup[table] = await prisma.$queryRawUnsafe(`SELECT ${cols}${extra} FROM "${table}"`);
  }
  backup.Restaurant = await prisma.$queryRawUnsafe(
    `SELECT id, country, timezone, "pricesTaxInclusive", "taxSystem" FROM "Restaurant"`,
  );
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `avant-conversion-euro-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2));
  console.log(`\nSauvegarde écrite : ${file}`);

  // ---- convert ------------------------------------------------------------
  await prisma.$transaction(
    async (tx) => {
      for (const [table] of touched) {
        const sets = MONEY_COLUMNS[table]
          .map((c) => {
            const scale = FOUR_DECIMALS.has(`${table}.${c}`) ? 4 : 2;
            return `"${c}" = ROUND("${c}" / ${XOF_PER_EUR}, ${scale})`;
          })
          .join(", ");
        await tx.$executeRawUnsafe(`UPDATE "${table}" SET ${sets}`);
      }

      // A flat discount is money; a percentage discount stays a percentage.
      await tx.$executeRawUnsafe(
        `UPDATE "Order" SET "discountValue" = ROUND("discountValue" / ${XOF_PER_EUR}, 2) WHERE "discountType" = 'FLAT'`,
      );

      await tx.restaurant.update({
        where: { id: restaurant.id },
        data: {
          country: "FR",
          timezone: "Europe/Paris",
          taxSystem: "FR_VAT",
          pricesTaxInclusive: true,
        },
      });

      // VAT categories for the existing menu.
      await tx.menuCategory.updateMany({
        where: { restaurantId: restaurant.id, name: "Boissons" },
        data: { vatCategory: "SOFT_DRINK" },
      });
      await tx.menuItem.updateMany({
        where: { restaurantId: restaurant.id, name: { in: ALCOHOLIC_ITEMS } },
        data: { vatCategory: "ALCOHOL" },
      });
    },
    { timeout: 120_000 },
  );

  const after = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id },
    select: { name: true, price: true, vatCategory: true, category: { select: { name: true, vatCategory: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  console.log("\nConversion appliquée. Menu en euros :");
  for (const item of after) {
    const category = item.vatCategory ?? item.category.vatCategory;
    console.log(`  ${item.category.name.padEnd(18)} ${item.name.padEnd(32)} ${Number(item.price).toFixed(2).padStart(6)} €  [${category}]`);
  }
};

main()
  .catch((error) => {
    console.error("❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
