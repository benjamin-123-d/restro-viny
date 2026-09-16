/**
 * Ce qui alimente la lampe : the figures behind the floating recommendations.
 *
 * Nothing is computed here that a screen does not already show — the service
 * only gathers what Ventes, Bénéfices, Achats, Stock and Commandes each know,
 * and hands it to the pure rules. That way a recommendation can never disagree
 * with the page it sends the owner to.
 */

import {
  buildRecommendations,
  type Recommendation,
  type RecommendationInput,
} from "@/lib/recommendations";
import type { OrderDTO } from "@/types/order";
import { computeBill, type BillLineInput } from "@/services/billing";
import { listOrders } from "@/services/order.service";
import { getProfitDashboard } from "@/services/profit.service";
import { getPurchaseDashboard } from "@/services/purchase-analytics.service";
import { getSalesDashboard } from "@/services/sales-analytics.service";
import { listStock } from "@/services/stock.service";
import type { PeriodKey } from "@/lib/sales-periods";

export interface RecommendationContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const WEEK_MS = 7 * 86_400_000;
const MINUTE_MS = 60_000;

/**
 * Margin is read over a week and compared with the week before: short enough
 * to still be actionable, long enough that one quiet Monday does not look like
 * a collapse. Sales are read over 30 days, because the weakest weekday only
 * means something once every weekday has happened several times.
 */
const MARGIN_PERIOD: PeriodKey = "7j";
const MARGIN_PERIOD_LABEL = "7 derniers jours";
const TREND_PERIOD: PeriodKey = "30j";

/** Lines of an open ticket, in the shape the bill computation expects. */
const openBillLines = (order: OrderDTO): BillLineInput[] =>
  order.lines
    .filter((line) => line.state !== "VOID")
    .map((line) => ({
      unitPrice: line.unitPrice,
      modifiersDelta: line.modifiers.reduce((sum, m) => sum + m.priceDelta, 0),
      quantity: line.quantity,
      taxRate: line.taxRate,
      taxInclusive: line.taxInclusive,
      isComp: line.isComp,
    }));

export const getRecommendations = async (
  ctx: RecommendationContext,
  now: Date = new Date(),
): Promise<Recommendation[]> => {
  // Reading the margin period "as it was a week ago" is what gives the drift;
  // resolvePeriod does the calendar work, so no date arithmetic leaks here.
  const weekBefore = new Date(now.getTime() - WEEK_MS);

  const [sales, margin, marginBefore, purchases, stock, openOrders] =
    await Promise.all([
      getSalesDashboard(ctx, TREND_PERIOD, now),
      getProfitDashboard(ctx, MARGIN_PERIOD, now),
      getProfitDashboard(ctx, MARGIN_PERIOD, weekBefore),
      getPurchaseDashboard(ctx, MARGIN_PERIOD, now),
      listStock(ctx.restaurantId),
      listOrders(ctx.restaurantId, ["OPEN"]),
    ]);

  // The daily series ends on the day in progress, so the last two points are
  // today and yesterday — the comparison the owner makes in their head.
  const daily = sales.daily;
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];

  // The heatmap already holds revenue per weekday and hour; summing the hours
  // gives the weekly rhythm without a second pass over the tickets.
  const weekdayRevenue = sales.heatmap.cells.map((hours) =>
    hours.reduce((sum, value) => sum + value, 0),
  );

  const low = stock.filter((item) => item.isActive && item.isLow);

  const openTicketTotal = openOrders.reduce(
    (sum, order) => sum + computeBill(openBillLines(order)).grandTotal,
    0,
  );
  const oldestOpened = openOrders.reduce<number | null>((oldest, order) => {
    const opened = new Date(order.createdAt).getTime();
    return oldest == null || opened < oldest ? opened : oldest;
  }, null);

  const input: RecommendationInput = {
    revenueToday: today?.totalTTC ?? 0,
    revenueYesterday: yesterday?.totalTTC ?? 0,
    ticketsToday: today?.tickets ?? 0,
    averageTicketToday:
      today && today.tickets > 0
        ? Math.round((today.totalTTC / today.tickets) * 100) / 100
        : 0,
    marginRatio: margin.margin.ratio,
    previousMarginRatio: marginBefore.margin.ratio,
    marginCoverage: margin.margin.coverage,
    dishesWithoutCard: margin.dishesWithoutCard,
    lowStockCount: low.length,
    lowStockNames: low.map((item) => item.name),
    openTicketCount: openOrders.length,
    openTicketTotal: Math.round(openTicketTotal * 100) / 100,
    oldestOpenTicketMinutes:
      oldestOpened == null
        ? null
        : Math.max(0, Math.round((now.getTime() - oldestOpened) / MINUTE_MS)),
    supplierDue: {
      total: purchases.owed.total,
      overdue: purchases.owed.overdue,
      count: purchases.owed.count,
    },
    unsplitPurchaseCount: purchases.totals.unsplitCount,
    weekdayRevenue,
    marginPeriodLabel: MARGIN_PERIOD_LABEL,
  };

  return buildRecommendations(input);
};
