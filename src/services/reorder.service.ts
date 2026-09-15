import type { ReorderInput } from "@/lib/validators/reorder";
import { findStockItemsByRestaurant } from "@/repositories/stock.repository";
import { createPurchaseOrder } from "@/services/purchase-order.service";
import { listSuppliers, type PurchasingContext } from "@/services/supplier.service";
import type { StockUnit } from "@/types/inventory";

/** VAT on most food supplies in France (produits alimentaires, 5,5 %). */
const DEFAULT_SUPPLY_VAT = 5.5;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * How much to order for an item at or under its threshold: back up to its par
 * level, or to twice its reorder level when no par level is set — never less
 * than one reorder level's worth.
 */
export const suggestReorderQuantity = (item: {
  readonly onHand: number;
  readonly reorderLevel: number;
  readonly parLevel: number | null;
}): number => {
  const target = item.parLevel ?? item.reorderLevel * 2;
  const needed = target - item.onHand;
  return round3(Math.max(needed, item.reorderLevel > 0 ? item.reorderLevel : 1));
};

export interface ReorderSuggestion {
  readonly stockItemId: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly onHand: number;
  readonly reorderLevel: number;
  readonly suggestedQty: number;
  readonly rate: number;
  readonly supplierId: string | null;
  readonly supplierName: string | null;
}

export const listReorderSuggestions = async (ctx: PurchasingContext): Promise<ReorderSuggestion[]> => {
  const [items, suppliers] = await Promise.all([
    findStockItemsByRestaurant(ctx.restaurantId),
    listSuppliers(ctx, {}),
  ]);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  return items
    .filter((i) => i.reorderLevel != null && Number(i.onHand) <= Number(i.reorderLevel) && !i.isPreparation)
    .map((i) => {
      const onHand = Number(i.onHand);
      const reorderLevel = Number(i.reorderLevel);
      return {
        stockItemId: i.id,
        name: i.name,
        unit: i.unit,
        onHand,
        reorderLevel,
        suggestedQty: suggestReorderQuantity({
          onHand,
          reorderLevel,
          parLevel: i.parLevel == null ? null : Number(i.parLevel),
        }),
        rate: Number(i.costPerUnit ?? 0),
        supplierId: i.defaultSupplierId,
        supplierName: i.defaultSupplierId ? (supplierName.get(i.defaultSupplierId) ?? null) : null,
      };
    });
};

/**
 * Turn the reorder list into draft purchase orders, one per usual supplier.
 * Items with no supplier are left out and named, so nothing silently drops.
 */
export const createReorderOrders = async (
  ctx: PurchasingContext,
  input: ReorderInput,
): Promise<{ orders: { id: string; number: string; supplierName: string }[]; skipped: string[] }> => {
  const [items, suppliers] = await Promise.all([
    findStockItemsByRestaurant(ctx.restaurantId, { includeInactive: true }),
    listSuppliers(ctx, {}),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const bySupplier = new Map<string, { stockItemId: string; quantity: number; rate: number }[]>();
  const skipped: string[] = [];
  for (const line of input.lines) {
    const item = byId.get(line.stockItemId);
    if (!item) continue;
    if (!item.defaultSupplierId || !supplierName.has(item.defaultSupplierId)) {
      skipped.push(item.name);
      continue;
    }
    const rows = bySupplier.get(item.defaultSupplierId) ?? [];
    rows.push({ stockItemId: item.id, quantity: line.quantity, rate: Number(item.costPerUnit ?? 0) });
    bySupplier.set(item.defaultSupplierId, rows);
  }

  const orders: { id: string; number: string; supplierName: string }[] = [];
  for (const [supplierId, rows] of bySupplier) {
    const order = await createPurchaseOrder(ctx, {
      supplierId,
      discountAmount: 0,
      roundTotal: false,
      notes: "Réassort automatique (articles sous le seuil)",
      items: rows.map((r) => ({ ...r, taxRate: DEFAULT_SUPPLY_VAT })),
    } as Parameters<typeof createPurchaseOrder>[1]);
    orders.push({ id: order.id, number: order.number, supplierName: supplierName.get(supplierId) ?? "" });
  }
  return { orders, skipped };
};
