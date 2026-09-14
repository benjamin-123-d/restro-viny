import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createJournalSchema } from "@/lib/validators/accounting";
import {
  createPurchaseOrderSchema,
  createSupplierSchema,
} from "@/lib/validators/purchasing";
import { createStockEntrySchema } from "@/lib/validators/stock-advanced";
import {
  cancelJournal,
  createJournal,
  getTrialBalance,
  listAccounts,
  postJournal,
} from "@/services/accounting.service";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  submitPurchaseOrder,
} from "@/services/purchase-order.service";
import {
  cancelStockEntry,
  createStockEntry,
  listWarehouses,
  submitStockEntry,
} from "@/services/stock-advanced.service";
import { listStock } from "@/services/stock.service";
import { createSupplier } from "@/services/supplier.service";

/**
 * Drive the same service calls the forms and row buttons trigger, against the
 * real database, then remove every trace. Unit tests mock the repositories;
 * this is the one check that the whole write path — validation, services,
 * repositories, constraints, numbering — holds together for real.
 *
 *   npx tsx scripts/e2e-write-flow.ts
 */

const MARKER = "E2E";

const step = (label: string) => console.log(`\n▸ ${label}`);
const ok = (label: string) => console.log(`  ✓ ${label}`);

const expect = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const onHandOf = async (stockItemId: string): Promise<number> =>
  Number(
    (await prisma.stockItem.findUniqueOrThrow({ where: { id: stockItemId } }))
      .onHand,
  );

/**
 * Remove everything this script created, found by its markers, so it can run
 * any number of times without leaving test documents in the real books. Every
 * stock submit here is also cancelled, so its movements net to zero and
 * deleting them leaves on-hand exactly as it was.
 */
const purge = async (restaurantId: string): Promise<void> => {
  const journals = await prisma.journalEntry.findMany({
    where: { restaurantId, narration: { startsWith: MARKER } },
    select: { id: true },
  });
  const journalIds = journals.map((j) => j.id);
  await prisma.gLEntry.deleteMany({
    where: { journalEntryId: { in: journalIds } },
  });
  await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });

  const entries = await prisma.stockEntry.findMany({
    where: { restaurantId, reason: { startsWith: MARKER } },
    select: { id: true, items: { select: { id: true } } },
  });
  await prisma.stockMovement.deleteMany({
    where: {
      stockEntryItemId: { in: entries.flatMap((e) => e.items.map((i) => i.id)) },
    },
  });
  await prisma.stockEntry.deleteMany({
    where: { id: { in: entries.map((e) => e.id) } },
  });

  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId, name: { startsWith: MARKER } },
    select: { id: true },
  });
  const supplierIds = suppliers.map((s) => s.id);
  await prisma.purchaseOrder.deleteMany({
    where: { supplierId: { in: supplierIds } },
  });
  await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
};

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({
    select: { id: true, ownerId: true },
  });
  if (!restaurant) throw new Error("No restaurant.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };
  const stamp = Date.now().toString().slice(-6);

  // Leftovers from an interrupted run would skew the checks below.
  await purge(ctx.restaurantId);

  try {
    // ------------------------------------------------------------ supplier
    step("Nouveau fournisseur (formulaire minimal)");
    const supplier = await createSupplier(
      ctx,
      createSupplierSchema.parse({
        name: `${MARKER} Fournisseur ${stamp}`,
        phone: "+22997123456",
        paymentTermsDays: "15",
        preventPo: false,
      }),
    );
    ok(`créé ${supplier.code} — ${supplier.name}`);

    // ----------------------------------------------------- purchase order
    step("Nouvelle commande d'achat puis « Valider »");
    const [item] = (await listStock(ctx.restaurantId)).filter((i) => i.isActive);
    const po = await createPurchaseOrder(
      ctx,
      createPurchaseOrderSchema.parse({
        supplierId: supplier.id,
        scheduleDate: "2026-09-30",
        discountAmount: 0,
        roundTotal: false,
        items: [
          { stockItemId: item.id, quantity: "12", rate: "850", taxRate: "18" },
        ],
      }),
    );
    // 12 × 850 = 10 200, plus 18 % tax = 12 036.
    expect(Math.abs(po.grandTotal - 12036) < 0.01, `Total ${po.grandTotal}`);
    ok(`brouillon ${po.number} — total ${po.grandTotal} (attendu 12 036)`);
    await submitPurchaseOrder(ctx, { id: po.id });
    const submitted = await getPurchaseOrder(ctx, po.id);
    expect(
      submitted.status === "TO_RECEIVE_AND_BILL",
      `Statut ${submitted.status}`,
    );
    ok(`après « Valider » : statut ${submitted.status}`);

    // -------------------------------------------------------- stock entry
    step("Transfert de stock puis « Valider » puis « Annuler »");
    const warehouses = (await listWarehouses(ctx)).filter((w) => !w.isGroup);
    const stocked = await prisma.bin.findFirst({
      where: { restaurantId: ctx.restaurantId, actualQty: { gte: 5 } },
      orderBy: { actualQty: "desc" },
    });
    expect(stocked !== null, "Aucun entrepôt avec du stock pour tester.");
    const source = warehouses.find((w) => w.id === stocked?.warehouseId);
    const target = warehouses.find((w) => w.id !== stocked?.warehouseId);
    expect(Boolean(source && target), "Il faut deux entrepôts.");
    const itemId = stocked?.stockItemId ?? "";

    const transfer = (quantity: number) =>
      createStockEntry(
        ctx,
        createStockEntrySchema.parse({
          purpose: "MATERIAL_TRANSFER",
          reason: `${MARKER} transfert`,
          items: [
            {
              stockItemId: itemId,
              fromWarehouseId: source?.id,
              toWarehouseId: target?.id,
              quantity: String(quantity),
              valuationRate: "1",
            },
          ],
        }),
      );

    const before = await onHandOf(itemId);
    const entry = await transfer(2);
    await submitStockEntry(ctx, { id: entry.id });
    const after = await onHandOf(itemId);
    expect(before === after, "Un transfert ne doit pas changer le stock total.");
    ok(
      `validé ${entry.number} de « ${source?.name} » vers « ${target?.name} » — stock total ${before} → ${after}`,
    );
    await cancelStockEntry(ctx, { id: entry.id });
    ok("annulé — le stock est remis où il était");

    step("Transfert de plus que le stock disponible (doit être refusé)");
    const greedy = await transfer(Number(stocked?.actualQty ?? 0) + 1000);
    let refused = false;
    try {
      await submitStockEntry(ctx, { id: greedy.id });
    } catch (error) {
      refused = error instanceof Error && error.message === "INSUFFICIENT_STOCK";
    }
    expect(refused, "Le stock négatif n'a pas été refusé.");
    ok("refusé avec INSUFFICIENT_STOCK — aucun entrepôt ne passe en négatif");

    // ------------------------------------------------------------ journal
    step("Écriture comptable puis « Comptabiliser » puis « Extourner »");
    const accounts = (await listAccounts(ctx)).filter((a) => !a.isGroup);
    const rent = accounts.find((a) => a.code === "5300");
    const cash = accounts.find((a) => a.code === "1100");
    expect(Boolean(rent && cash), "Comptes 5300 / 1100 introuvables.");

    const journal = await createJournal(
      ctx,
      createJournalSchema.parse({
        postingDate: "2026-09-14",
        narration: `${MARKER} loyer ${stamp}`,
        lines: [
          { accountId: rent?.id, debit: "150000", credit: "0" },
          { accountId: cash?.id, debit: "0", credit: "150000" },
        ],
      }),
    );
    await postJournal(ctx, { id: journal.id });
    const posted = await getTrialBalance(ctx);
    expect(posted.isBalanced, "La balance ne s'équilibre plus.");
    ok(
      `comptabilisé ${journal.number} — balance équilibrée, débit total ${posted.totalDebit}`,
    );
    await cancelJournal(ctx, { id: journal.id });
    expect((await getTrialBalance(ctx)).isBalanced, "Balance après extourne.");
    ok("extourné — balance toujours équilibrée");
  } finally {
    // Always clean up, even when a check failed half way through.
    step("Nettoyage complet des données de test");
    await purge(ctx.restaurantId);
    ok("toutes les traces E2E supprimées — la comptabilité reste vierge");
  }

  console.log("\n✅ Parcours d'écriture complet : OK");
};

main()
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
