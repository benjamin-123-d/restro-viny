/**
 * The purchases side of Statistiques: what was bought over a period, from
 * whom, on what, and how it moved since the period before. It reads the same
 * documents the Achats module writes — supplier invoices and direct tickets —
 * so the figures always match the lists.
 */

import { parisParts } from "@/lib/sales-analytics";
import { CATEGORY_LABEL, isFoodCategory, type PurchaseCategory } from "@/lib/purchase-categories";
import {
  findIngredientPurchasesInPeriod,
  findInvoicesInPeriod,
  findOutstandingInvoices,
} from "@/repositories/purchase-analytics.repository";
import { resolvePeriod, type PeriodKey } from "@/services/sales-analytics.service";
import type { PurchasingContext } from "@/services/supplier.service";

const num = (v: unknown): number => Number(v ?? 0);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const share = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

const percentChange = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10;

export interface PurchaseDayPoint {
  readonly day: string;
  readonly amountHT: number;
}

export interface SupplierSpendRow {
  readonly supplierId: string;
  readonly name: string;
  readonly amountHT: number;
  readonly documents: number;
  readonly share: number | null;
}

export interface CategorySpendRow {
  readonly category: PurchaseCategory | "NON_VENTILE";
  readonly label: string;
  readonly amountHT: number;
  readonly share: number | null;
}

export interface PriceMoveRow {
  readonly stockItemId: string;
  readonly name: string;
  readonly purchaseUnit: string | null;
  readonly firstPrice: number;
  readonly lastPrice: number;
  readonly changePercent: number;
}

export interface PurchaseDocumentRow {
  readonly id: string;
  readonly number: string;
  readonly supplierName: string;
  readonly postingDate: string;
  readonly amountHT: number;
  readonly amountTTC: number;
  readonly outstanding: number;
  readonly isDirect: boolean;
  readonly documentCount: number;
  readonly categories: readonly string[];
}

export interface PurchaseDashboardDTO {
  readonly period: { readonly key: PeriodKey; readonly label: string; readonly from: string; readonly to: string };
  readonly totals: {
    readonly amountHT: number;
    readonly amountTTC: number;
    readonly vat: number;
    readonly documents: number;
    readonly suppliers: number;
    readonly averageDocument: number;
    readonly directCount: number;
    readonly directHT: number;
    readonly foodHT: number;
    readonly otherHT: number;
    readonly unsplitCount: number;
  };
  readonly deltas: { readonly amountHT: number | null; readonly documents: number | null };
  readonly daily: readonly PurchaseDayPoint[];
  readonly suppliers: readonly SupplierSpendRow[];
  readonly categories: readonly CategorySpendRow[];
  readonly priceMoves: readonly PriceMoveRow[];
  readonly documents: readonly PurchaseDocumentRow[];
  readonly owed: { readonly total: number; readonly overdue: number; readonly count: number };
}

const DAY_MS = 86_400_000;

const daysBetween = (from: Date, to: Date): string[] => {
  const days: string[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const day = parisParts(new Date(t)).day;
    if (days[days.length - 1] !== day) days.push(day);
  }
  return days;
};

type Invoice = Awaited<ReturnType<typeof findInvoicesInPeriod>>[number];

/** HT of a document, counting a return as money coming back. */
const signedHT = (invoice: Invoice): number => num(invoice.subtotal) * (invoice.isReturn ? -1 : 1);

export const getPurchaseDashboard = async (
  ctx: PurchasingContext,
  key: PeriodKey,
  now: Date = new Date(),
): Promise<PurchaseDashboardDTO> => {
  const period = resolvePeriod(key, now);
  const [current, previous, purchases, outstanding] = await Promise.all([
    findInvoicesInPeriod(ctx.restaurantId, period.from, period.to),
    findInvoicesInPeriod(ctx.restaurantId, period.previousFrom, period.previousTo),
    findIngredientPurchasesInPeriod(ctx.restaurantId, period.from, period.to),
    findOutstandingInvoices(ctx.restaurantId),
  ]);

  const amountHT = round2(current.reduce((s, i) => s + signedHT(i), 0));
  const vat = round2(current.reduce((s, i) => s + num(i.taxTotal) * (i.isReturn ? -1 : 1), 0));
  const amountTTC = round2(current.reduce((s, i) => s + num(i.grandTotal) * (i.isReturn ? -1 : 1), 0));

  // Spending by category: the breakdown when there is one, the whole document
  // as goods when it was detailed line by line, « non ventilé » otherwise.
  const byCategory = new Map<PurchaseCategory | "NON_VENTILE", number>();
  let unsplitCount = 0;
  for (const invoice of current) {
    const sign = invoice.isReturn ? -1 : 1;
    if (invoice.expenseLines.length > 0) {
      for (const line of invoice.expenseLines) {
        byCategory.set(line.category, (byCategory.get(line.category) ?? 0) + num(line.amountHT) * sign);
      }
    } else if (invoice.summaryOnly) {
      unsplitCount += 1;
      byCategory.set("NON_VENTILE", (byCategory.get("NON_VENTILE") ?? 0) + signedHT(invoice));
    } else {
      byCategory.set("DENREES", (byCategory.get("DENREES") ?? 0) + signedHT(invoice));
    }
  }
  const foodHT = round2(
    [...byCategory].filter(([c]) => c !== "NON_VENTILE" && isFoodCategory(c)).reduce((s, [, v]) => s + v, 0),
  );
  const splitHT = round2([...byCategory].filter(([c]) => c !== "NON_VENTILE").reduce((s, [, v]) => s + v, 0));

  const bySupplier = new Map<string, { name: string; amount: number; documents: number }>();
  for (const invoice of current) {
    const row = bySupplier.get(invoice.supplierId) ?? { name: invoice.supplier.name, amount: 0, documents: 0 };
    row.amount += signedHT(invoice);
    row.documents += 1;
    bySupplier.set(invoice.supplierId, row);
  }

  const perDay = new Map<string, number>();
  for (const invoice of current) {
    const day = parisParts(invoice.postingDate).day;
    perDay.set(day, (perDay.get(day) ?? 0) + signedHT(invoice));
  }
  const lastInstant = new Date(Math.min(period.to.getTime(), now.getTime()));

  // Price watch: what one purchase unit cost the first and the last time it
  // was bought in the period, for ingredients bought at least twice.
  const byItem = new Map<string, { name: string; unit: string | null; prices: number[] }>();
  for (const purchase of purchases) {
    const quantity = num(purchase.quantity);
    if (quantity <= 0) continue;
    const row = byItem.get(purchase.stockItemId) ?? {
      name: purchase.stockItem.name,
      unit: purchase.stockItem.purchaseUnit,
      prices: [],
    };
    row.prices.push(num(purchase.amount) / quantity);
    byItem.set(purchase.stockItemId, row);
  }
  const priceMoves: PriceMoveRow[] = [...byItem]
    .filter(([, r]) => r.prices.length >= 2 && r.prices[0] > 0)
    .map(([stockItemId, r]) => {
      const firstPrice = round2(r.prices[0]);
      const lastPrice = round2(r.prices[r.prices.length - 1]);
      return {
        stockItemId,
        name: r.name,
        purchaseUnit: r.unit,
        firstPrice,
        lastPrice,
        changePercent: Math.round(((lastPrice - firstPrice) / firstPrice) * 1000) / 10,
      };
    })
    .filter((r) => Math.abs(r.changePercent) >= 1)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 8);

  const previousHT = round2(previous.reduce((s, i) => s + signedHT(i), 0));
  const overdue = outstanding.filter((i) => i.dueDate < now);

  return {
    period: {
      key: period.key,
      label: period.label,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    totals: {
      amountHT,
      amountTTC,
      vat,
      documents: current.length,
      suppliers: bySupplier.size,
      averageDocument: current.length > 0 ? round2(amountHT / current.length) : 0,
      directCount: current.filter((i) => i.isDirectPurchase).length,
      directHT: round2(current.filter((i) => i.isDirectPurchase).reduce((s, i) => s + signedHT(i), 0)),
      foodHT,
      otherHT: round2(splitHT - foodHT),
      unsplitCount,
    },
    deltas: {
      amountHT: percentChange(amountHT, previousHT),
      documents: percentChange(current.length, previous.length),
    },
    daily: daysBetween(period.from, lastInstant).map((day) => ({ day, amountHT: round2(perDay.get(day) ?? 0) })),
    suppliers: [...bySupplier]
      .map(([supplierId, r]) => ({
        supplierId,
        name: r.name,
        amountHT: round2(r.amount),
        documents: r.documents,
        share: share(r.amount, amountHT),
      }))
      .sort((a, b) => b.amountHT - a.amountHT)
      .slice(0, 10),
    categories: [...byCategory]
      .map(([category, amount]) => ({
        category,
        label: category === "NON_VENTILE" ? "Non réparti" : CATEGORY_LABEL[category],
        amountHT: round2(amount),
        share: share(amount, amountHT),
      }))
      .sort((a, b) => b.amountHT - a.amountHT),
    priceMoves,
    documents: current.slice(0, 50).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      supplierName: invoice.supplier.name,
      postingDate: invoice.postingDate.toISOString(),
      amountHT: round2(signedHT(invoice)),
      amountTTC: round2(num(invoice.grandTotal) * (invoice.isReturn ? -1 : 1)),
      outstanding: num(invoice.outstandingAmount),
      isDirect: invoice.isDirectPurchase,
      documentCount: invoice._count.documents,
      categories: [...new Set(invoice.expenseLines.map((l) => CATEGORY_LABEL[l.category]))],
    })),
    owed: {
      total: round2(outstanding.reduce((s, i) => s + num(i.outstandingAmount), 0)),
      overdue: round2(overdue.reduce((s, i) => s + num(i.outstandingAmount), 0)),
      count: outstanding.length,
    },
  };
};
