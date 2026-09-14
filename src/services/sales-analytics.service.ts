import {
  RATES_TO_CONFIRM,
  ratesInUse,
  VAT_TERRITORY_LABEL,
  VAT_TERRITORY_NOTE,
  type ServiceType,
  type VatBreakdownRow,
  type VatTerritory,
} from "@/lib/french-vat";
import {
  byService,
  computeKpis,
  dailySeries,
  findings,
  hourlyHeatmap,
  parisParts,
  paymentMix,
  percentChange,
  topItems,
  vatReport,
  type DailyPoint,
  type Finding,
  type Heatmap,
  type ItemRow,
  type PaymentRow,
  type SaleTicket,
  type SalesKpis,
  type ServiceRow,
} from "@/lib/sales-analytics";
import {
  findMenuVatCategories,
  findRestaurantSalesProfile,
  findSettledOrders,
} from "@/repositories/sales-analytics.repository";
import type { OrderWithRelations } from "@/repositories/order.repository";
import { computeBill } from "@/services/billing";
import { orderToBillLines } from "@/services/order.service";
import type { PurchasingContext } from "@/services/supplier.service";

export const PERIODS = [
  { key: "jour", label: "Aujourd'hui" },
  { key: "7j", label: "7 derniers jours" },
  { key: "30j", label: "30 derniers jours" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois-dernier", label: "Mois dernier" },
  { key: "annee", label: "Cette année" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export const isPeriodKey = (value: string | undefined): value is PeriodKey =>
  PERIODS.some((p) => p.key === value);

const DAY_MS = 86_400_000;

/** The UTC instant of midnight on a Paris calendar day ("YYYY-MM-DD"). */
export const parisMidnight = (day: string): Date => {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  // At 00:00 UTC Paris is already at 01:00 or 02:00 the same day: that hour is
  // the offset, so Paris midnight is that many hours earlier.
  return new Date(utcMidnight.getTime() - parisParts(utcMidnight).hour * 3_600_000);
};

const shiftDay = (day: string, days: number): string =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

export interface ResolvedPeriod {
  readonly key: PeriodKey;
  readonly label: string;
  readonly from: Date;
  readonly to: Date;
  readonly previousFrom: Date;
  readonly previousTo: Date;
}

/**
 * Turn a preset into exact instants, in Paris calendar terms: "today" starts
 * at midnight in Paris, not in UTC. The previous period is the same length,
 * immediately before — except for calendar months and years, which compare
 * with the previous month or year.
 */
export const resolvePeriod = (key: PeriodKey, now: Date = new Date()): ResolvedPeriod => {
  const today = parisParts(now).day;
  const label = PERIODS.find((p) => p.key === key)?.label ?? "";
  const [year, month] = today.split("-").map(Number);
  const firstOfMonth = (y: number, m: number) =>
    `${y}-${String(m).padStart(2, "0")}-01`;

  const window = (from: Date, to: Date, previousFrom: Date, previousTo: Date) => ({
    key,
    label,
    from,
    to,
    previousFrom,
    previousTo,
  });

  switch (key) {
    case "jour": {
      const from = parisMidnight(today);
      const to = parisMidnight(shiftDay(today, 1));
      return window(from, to, parisMidnight(shiftDay(today, -1)), from);
    }
    case "7j":
    case "30j": {
      const days = key === "7j" ? 7 : 30;
      const to = parisMidnight(shiftDay(today, 1));
      const from = parisMidnight(shiftDay(today, 1 - days));
      const previousFrom = parisMidnight(shiftDay(today, 1 - 2 * days));
      return window(from, to, previousFrom, from);
    }
    case "mois": {
      const from = parisMidnight(firstOfMonth(year, month));
      const to = parisMidnight(shiftDay(today, 1));
      const prevMonth = month === 1 ? [year - 1, 12] : [year, month - 1];
      const previousFrom = parisMidnight(firstOfMonth(prevMonth[0], prevMonth[1]));
      // Same elapsed length into the previous month, so a half month compares
      // with a half month rather than with a whole one.
      const previousTo = new Date(previousFrom.getTime() + (to.getTime() - from.getTime()));
      return window(from, to, previousFrom, previousTo);
    }
    case "mois-dernier": {
      const prev = month === 1 ? [year - 1, 12] : [year, month - 1];
      const beforePrev = prev[1] === 1 ? [prev[0] - 1, 12] : [prev[0], prev[1] - 1];
      const from = parisMidnight(firstOfMonth(prev[0], prev[1]));
      const to = parisMidnight(firstOfMonth(year, month));
      return window(from, to, parisMidnight(firstOfMonth(beforePrev[0], beforePrev[1])), from);
    }
    case "annee": {
      const from = parisMidnight(`${year}-01-01`);
      const to = parisMidnight(shiftDay(today, 1));
      const previousFrom = parisMidnight(`${year - 1}-01-01`);
      const previousTo = new Date(previousFrom.getTime() + (to.getTime() - from.getTime()));
      return window(from, to, previousFrom, previousTo);
    }
  }
};

/**
 * One settled order as a ticket. The HT/TVA split of each line comes from the
 * same bill computation the order was settled with, discount included, so
 * the dashboard matches the receipt to the cent.
 */
export const toTicket = (
  order: OrderWithRelations,
  categories: ReadonlyMap<string, SaleTicket["lines"][number]["vatCategory"]>,
): SaleTicket => {
  const sold = order.items.filter((i) => i.state !== "VOID");
  const bill = computeBill(orderToBillLines(order), {
    type: order.discountType,
    value: Number(order.discountValue),
  });
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    service: order.orderType,
    settledAt: order.settledAt ?? order.updatedAt,
    tableLabel: order.tableLabel,
    grandTotal: Number(order.grandTotal),
    discountTotal: Number(order.discountTotal),
    lines: sold.map((item, index) => ({
      name: item.name,
      quantity: item.quantity,
      vatCategory:
        item.vatCategory ??
        (item.menuItemId ? categories.get(item.menuItemId) : undefined) ??
        "FOOD",
      taxRate: Number(item.taxRate),
      taxable: bill.lines[index]?.taxable ?? 0,
      tax: bill.lines[index]?.tax ?? 0,
    })),
    payments: order.payments.map((p) => ({
      mode: p.mode,
      amount: Number(p.amount),
    })),
  };
};

export interface TicketListRow {
  readonly id: string;
  readonly number: string;
  readonly settledAt: string;
  readonly service: ServiceType;
  readonly tableLabel: string | null;
  readonly items: number;
  readonly ttc: number;
  readonly paymentModes: readonly string[];
}

export interface SalesDashboardDTO {
  readonly period: {
    readonly key: PeriodKey;
    readonly label: string;
    readonly from: string;
    readonly to: string;
  };
  readonly restaurantName: string;
  readonly territory: {
    readonly code: VatTerritory;
    readonly label: string;
    readonly note: string;
    readonly rates: readonly number[];
    readonly toConfirm: readonly { readonly label: string; readonly note: string }[];
  };
  readonly kpis: SalesKpis;
  readonly deltas: {
    readonly revenueTTC: number | null;
    readonly revenueHT: number | null;
    readonly vat: number | null;
    readonly tickets: number | null;
    readonly averageTicket: number | null;
  };
  readonly daily: readonly DailyPoint[];
  readonly services: readonly ServiceRow[];
  readonly heatmap: Heatmap;
  readonly topItems: readonly ItemRow[];
  readonly payments: readonly PaymentRow[];
  readonly vat: readonly VatBreakdownRow[];
  readonly findings: readonly Finding[];
  readonly tickets: readonly TicketListRow[];
}

const CATEGORY_LABEL = { FOOD: "repas", SOFT_DRINK: "boissons sans alcool", ALCOHOL: "boissons alcoolisées" } as const;
const SERVICE_LABEL = { DINE_IN: "sur place", TAKEAWAY: "à emporter", DELIVERY: "livraison" } as const;

export const getSalesDashboard = async (
  ctx: PurchasingContext,
  key: PeriodKey,
  now: Date = new Date(),
): Promise<SalesDashboardDTO> => {
  const period = resolvePeriod(key, now);
  const [profile, categories, current, previous] = await Promise.all([
    findRestaurantSalesProfile(ctx.restaurantId),
    findMenuVatCategories(ctx.restaurantId),
    findSettledOrders(ctx.restaurantId, period.from, period.to),
    findSettledOrders(ctx.restaurantId, period.previousFrom, period.previousTo),
  ]);

  const tickets = current.map((o) => toTicket(o, categories));
  const before = previous.map((o) => toTicket(o, categories));
  const kpis = computeKpis(tickets);
  const previousKpis = computeKpis(before);

  const territory = profile?.vatTerritory ?? "METROPOLE";
  const offered: ServiceType[] = [
    ...(profile?.serviceDineIn !== false ? (["DINE_IN"] as const) : []),
    ...(profile?.serviceTakeaway !== false ? (["TAKEAWAY"] as const) : []),
    ...(profile?.serviceDelivery ? (["DELIVERY"] as const) : []),
  ];
  // The chart range ends on the last day actually covered, not on tomorrow's
  // midnight that closes the query window.
  const lastDay = new Date(Math.min(period.to.getTime(), now.getTime()) - 1);

  return {
    period: {
      key: period.key,
      label: period.label,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    restaurantName: profile?.name ?? "",
    territory: {
      code: territory,
      label: VAT_TERRITORY_LABEL[territory],
      note: VAT_TERRITORY_NOTE[territory],
      rates: ratesInUse(territory),
      toConfirm: RATES_TO_CONFIRM.filter((c) => c.territory === territory).map((c) => ({
        label: `${CATEGORY_LABEL[c.category]} ${SERVICE_LABEL[c.service]}`,
        note: c.note,
      })),
    },
    kpis,
    deltas: {
      revenueTTC: percentChange(kpis.revenueTTC, previousKpis.revenueTTC),
      revenueHT: percentChange(kpis.revenueHT, previousKpis.revenueHT),
      vat: percentChange(kpis.vat, previousKpis.vat),
      tickets: percentChange(kpis.tickets, previousKpis.tickets),
      averageTicket: percentChange(kpis.averageTicket, previousKpis.averageTicket),
    },
    daily: dailySeries(tickets, period.from, lastDay),
    services: byService(tickets, offered),
    heatmap: hourlyHeatmap(tickets),
    topItems: topItems(tickets, 10),
    payments: paymentMix(tickets),
    vat: vatReport(tickets),
    findings: findings({ tickets, previous: before, from: period.from, to: lastDay }),
    tickets: [...tickets]
      .sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime())
      .map((t) => ({
        id: t.id,
        number: t.invoiceNumber != null ? `F-${String(t.invoiceNumber).padStart(5, "0")}` : `#${t.orderNumber}`,
        settledAt: t.settledAt.toISOString(),
        service: t.service,
        tableLabel: t.tableLabel,
        items: t.lines.reduce((n, l) => n + l.quantity, 0),
        ttc: Math.round(t.lines.reduce((s, l) => s + l.taxable + l.tax, 0) * 100) / 100,
        paymentModes: [...new Set(t.payments.map((p) => p.mode))],
      })),
  };
};
