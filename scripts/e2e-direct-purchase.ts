import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { recordDirectPurchase } from "../src/services/direct-purchase.service";

/**
 * Walks a shop ticket the whole way on the real database: a mixed purchase
 * (food + cleaning + a pan) becomes a paid supplier invoice, its breakdown,
 * and stock plus a new purchase price for the detailed ingredient.
 *
 *   npx tsx scripts/e2e-direct-purchase.ts
 *   npx tsx scripts/e2e-direct-purchase.ts --purge
 */

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

const SHOP = "Magasin de test E2E";
const euro = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

const purge = async () => {
  const supplier = await prisma.supplier.findFirst({ where: { name: SHOP } });
  if (!supplier) return console.log("Rien à nettoyer.");
  const invoices = await prisma.purchaseInvoice.findMany({ where: { supplierId: supplier.id }, select: { id: true } });
  const ids = invoices.map((i) => i.id);
  const purchases = await prisma.ingredientPurchase.findMany({
    where: { purchaseInvoiceId: { in: ids } },
    select: { id: true, movementId: true, stockItemId: true, usageQuantity: true },
  });
  for (const purchase of purchases) {
    if (purchase.movementId) {
      await prisma.stockItem.update({
        where: { id: purchase.stockItemId },
        data: { onHand: { decrement: purchase.usageQuantity } },
      });
      await prisma.ingredientPurchase.delete({ where: { id: purchase.id } });
      await prisma.stockMovement.delete({ where: { id: purchase.movementId } });
    }
  }
  await prisma.supplierPaymentAllocation.deleteMany({ where: { purchaseInvoiceId: { in: ids } } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchaseDocument.deleteMany({ where: { invoiceId: { in: ids } } });
  await prisma.purchaseInvoice.deleteMany({ where: { id: { in: ids } } });
  await prisma.supplier.delete({ where: { id: supplier.id } });
  console.log(`Supprimé : ${ids.length} achat(s) de test et le magasin de test.`);
};

const run = async () => {
  const restaurant = await prisma.restaurant.findFirst({ where: { deletedAt: null }, select: { id: true, ownerId: true } });
  if (!restaurant) throw new Error("Aucun restaurant.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };

  const ingredient = await prisma.stockItem.findFirst({
    where: { restaurantId: restaurant.id, isActive: true, isPreparation: false, deletedAt: null },
    select: { id: true, name: true, onHand: true, lastPurchasePrice: true, purchaseFactor: true, unit: true },
  });
  if (!ingredient) throw new Error("Aucun ingrédient.");

  console.log(`Ingrédient suivi : ${ingredient.name} — stock ${Number(ingredient.onHand)} ${ingredient.unit}`);

  const result = await recordDirectPurchase(ctx, {
    supplierName: SHOP,
    purchasedAt: new Date(),
    ticketNumber: `E2E-${Date.now().toString().slice(-6)}`,
    paymentMode: "CARD",
    alreadyPaid: true,
    totalTTC: 54.2,
    expenseLines: [
      { category: "DENREES", label: undefined, amountHT: 40, vatRate: 5.5 },
      { category: "ENTRETIEN", label: "Javel", amountHT: 10, vatRate: 20 },
    ],
    ingredientLines: [{ stockItemId: ingredient.id, quantity: 2, amount: 14 }],
    notes: "Achat de test automatique",
    supplierId: undefined,
    source: undefined,
  });

  const invoice = await prisma.purchaseInvoice.findUniqueOrThrow({
    where: { id: result.id },
    include: { expenseLines: true, ingredientPurchases: true },
  });
  const after = await prisma.stockItem.findUniqueOrThrow({
    where: { id: ingredient.id },
    select: { onHand: true, lastPurchasePrice: true },
  });

  const expectedStock = Number(ingredient.onHand) + 2 * Number(ingredient.purchaseFactor);
  const checks: [string, boolean, string][] = [
    ["Facture créée et validée", invoice.status !== "DRAFT" && invoice.status !== "CANCELLED", invoice.status],
    ["Facture payée", Number(invoice.outstandingAmount) === 0, euro(Number(invoice.outstandingAmount))],
    ["Total TTC", Number(invoice.grandTotal) === 54.2, euro(Number(invoice.grandTotal))],
    ["Total HT", Number(invoice.subtotal) === 50, euro(Number(invoice.subtotal))],
    ["TVA", Number(invoice.taxTotal) === 4.2, euro(Number(invoice.taxTotal))],
    ["Répartition en 2 catégories", invoice.expenseLines.length === 2, `${invoice.expenseLines.length}`],
    ["Ingrédient entré en stock", Math.abs(Number(after.onHand) - expectedStock) < 0.001, `${Number(after.onHand)}`],
    ["Prix d'achat mis à jour", Number(after.lastPurchasePrice) === 7, euro(Number(after.lastPurchasePrice ?? 0))],
    ["Achat lié à la facture", invoice.ingredientPurchases.length === 1, `${invoice.ingredientPurchases.length}`],
  ];

  let failed = 0;
  for (const [label, ok, value] of checks) {
    console.log(`${ok ? "OK  " : "ÉCHEC"} ${label} : ${value}`);
    if (!ok) failed += 1;
  }
  console.log(`\nFacture ${result.number} (${result.id})`);
  console.log(failed === 0 ? "Tout est conforme." : `${failed} vérification(s) en échec.`);
  console.log("Nettoyage : npx tsx scripts/e2e-direct-purchase.ts --purge");
  if (failed > 0) process.exitCode = 1;
};

const main = async () => {
  if (process.argv.includes("--purge")) await purge();
  else await run();
  await prisma.$disconnect();
};

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
