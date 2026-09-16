/**
 * The Bénéfices screen: what a period left, read two ways — the margin on the
 * food actually sold (the kitchen), and revenue against everything bought (the
 * activity). Both come from figures already recorded elsewhere: the cost
 * frozen on each sale line, and the purchase documents.
 */

import {
  marginByDay,
  marginByDish,
  marginTotals,
  purchaseResult,
  type DishProfit,
  type MarginDay,
  type MarginTotals,
  type PurchaseResult,
  type SoldLine,
} from "@/lib/profit";
import { computeKpis, parisParts, type SalesKpis } from "@/lib/sales-analytics";
import { findSettledOrders, findMenuVatCategories } from "@/repositories/sales-analytics.repository";
import { getPurchaseDashboard } from "@/services/purchase-analytics.service";
import { resolvePeriod, toTicket, type PeriodKey } from "@/services/sales-analytics.service";
import type { PurchasingContext } from "@/services/supplier.service";

const DAY_MS = 86_400_000;

const daysBetween = (from: Date, to: Date): string[] => {
  const days: string[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const day = parisParts(new Date(t)).day;
    if (days[days.length - 1] !== day) days.push(day);
  }
  return days;
};

export interface ProfitDashboardDTO {
  readonly period: { readonly key: PeriodKey; readonly label: string; readonly from: string; readonly to: string };
  readonly kpis: SalesKpis;
  readonly margin: MarginTotals;
  readonly daily: readonly MarginDay[];
  readonly dishes: readonly DishProfit[];
  readonly purchases: PurchaseResult;
  readonly purchaseCategories: readonly { readonly label: string; readonly amountHT: number; readonly share: number | null }[];
  /** Dishes sold with no recipe card, the reason the margin is only partial. */
  readonly dishesWithoutCard: number;
  readonly unsplitPurchaseCount: number;
}

export const getProfitDashboard = async (
  ctx: PurchasingContext,
  key: PeriodKey,
  now: Date = new Date(),
): Promise<ProfitDashboardDTO> => {
  const period = resolvePeriod(key, now);
  const [categories, orders, purchases] = await Promise.all([
    findMenuVatCategories(ctx.restaurantId),
    findSettledOrders(ctx.restaurantId, period.from, period.to),
    getPurchaseDashboard(ctx, key, now),
  ]);

  const tickets = orders.map((order) => toTicket(order, categories));
  const lines: SoldLine[] = tickets.flatMap((ticket) => {
    const day = parisParts(ticket.settledAt).day;
    return ticket.lines.map((line) => ({
      day,
      menuItemId: line.menuItemId ?? null,
      name: line.name,
      quantity: line.quantity,
      revenueHT: line.taxable,
      foodCost: line.foodCost ?? null,
    }));
  });

  const kpis = computeKpis(tickets);
  const margin = marginTotals(lines);
  const dishes = marginByDish(lines);
  const lastInstant = new Date(Math.min(period.to.getTime(), now.getTime()));

  return {
    period: {
      key: period.key,
      label: period.label,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    kpis,
    margin,
    daily: marginByDay(lines, daysBetween(period.from, lastInstant)),
    dishes,
    purchases: purchaseResult(kpis.revenueHT, purchases.totals.foodHT, purchases.totals.otherHT),
    purchaseCategories: purchases.categories.map((c) => ({ label: c.label, amountHT: c.amountHT, share: c.share })),
    dishesWithoutCard: dishes.filter((d) => !d.hasCost).length,
    unsplitPurchaseCount: purchases.totals.unsplitCount,
  };
};
