/**
 * Sales analytics for the owner's dashboard. No IO — tickets in, figures and
 * plain-French findings out, so every number on the dashboard is tested.
 *
 * A "ticket" is one settled POS order: the receipt the customer was handed.
 * Nothing here recomputes tax; each line already carries the HT/TVA split it
 * was settled at, so the dashboard and the receipts can never disagree.
 */

import {
  isDrink,
  vatBreakdown,
  type ServiceType,
  type VatBreakdownRow,
  type VatCategory,
} from "@/lib/french-vat";
import { TIME_ZONE } from "@/lib/format";

export interface TicketLine {
  readonly name: string;
  readonly quantity: number;
  /** Null for a free-text line typed at the till. */
  readonly menuItemId?: string | null;
  /** Material cost of one unit, frozen when the sale was recorded. */
  readonly foodCost?: number | null;
  readonly vatCategory: VatCategory;
  readonly taxRate: number;
  /** HT after discount. */
  readonly taxable: number;
  readonly tax: number;
}

export interface TicketPayment {
  readonly mode: string;
  readonly amount: number;
}

export interface SaleTicket {
  readonly id: string;
  readonly orderNumber: number;
  readonly invoiceNumber: number | null;
  readonly service: ServiceType;
  readonly settledAt: Date;
  readonly tableLabel: string | null;
  readonly grandTotal: number;
  readonly discountTotal: number;
  readonly lines: readonly TicketLine[];
  readonly payments: readonly TicketPayment[];
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const sum = <T>(items: readonly T[], pick: (item: T) => number): number =>
  round2(items.reduce((total, item) => total + pick(item), 0));

const lineTTC = (line: TicketLine): number => line.taxable + line.tax;

// ------------------------------------------------------------------- KPIs ---

export interface SalesKpis {
  readonly revenueTTC: number;
  readonly revenueHT: number;
  readonly vat: number;
  readonly tickets: number;
  readonly averageTicket: number;
  readonly itemsSold: number;
  readonly discounts: number;
  readonly foodTTC: number;
  readonly drinkTTC: number;
  /** Share of revenue from drinks, 0–100. */
  readonly drinkShare: number;
}

export const computeKpis = (tickets: readonly SaleTicket[]): SalesKpis => {
  const lines = tickets.flatMap((t) => t.lines);
  const revenueHT = sum(lines, (l) => l.taxable);
  const vat = sum(lines, (l) => l.tax);
  const revenueTTC = round2(revenueHT + vat);
  const drinkTTC = sum(
    lines.filter((l) => isDrink(l.vatCategory)),
    lineTTC,
  );
  return {
    revenueTTC,
    revenueHT,
    vat,
    tickets: tickets.length,
    averageTicket: tickets.length ? round2(revenueTTC / tickets.length) : 0,
    itemsSold: lines.reduce((n, l) => n + l.quantity, 0),
    discounts: sum(tickets, (t) => t.discountTotal),
    foodTTC: round2(revenueTTC - drinkTTC),
    drinkTTC,
    drinkShare: revenueTTC ? round2((drinkTTC / revenueTTC) * 100) : 0,
  };
};

/**
 * Change against the previous period, in percent. Null when there is nothing
 * to compare with — "up from zero" is not a percentage, and showing +∞ or +100
 * would be a made-up number.
 */
export const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : round2(((current - previous) / previous) * 100);

// ------------------------------------------------------------- time parts ---

const PARIS_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Calendar day, hour and Monday-first weekday of an instant, in Paris. */
export const parisParts = (
  date: Date,
): { day: string; hour: number; weekday: number } => {
  const parts = Object.fromEntries(
    PARIS_PARTS.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
};

// ----------------------------------------------------------- daily series ---

export interface DailyPoint {
  /** "YYYY-MM-DD", Paris calendar day. */
  readonly day: string;
  readonly foodTTC: number;
  readonly drinkTTC: number;
  readonly totalTTC: number;
  readonly tickets: number;
}

/** Every Paris calendar day from `from` to `to` inclusive, oldest first. */
export const daysBetween = (from: Date, to: Date): string[] => {
  const days: string[] = [];
  const seen = new Set<string>();
  // Step in 6-hour increments so a DST change can never skip or repeat a day.
  for (let t = from.getTime(); t <= to.getTime(); t += 6 * 3_600_000) {
    const { day } = parisParts(new Date(t));
    if (!seen.has(day)) {
      seen.add(day);
      days.push(day);
    }
  }
  const last = parisParts(to).day;
  if (!seen.has(last)) days.push(last);
  return days;
};

export const dailySeries = (
  tickets: readonly SaleTicket[],
  from: Date,
  to: Date,
): DailyPoint[] => {
  const buckets = new Map(
    daysBetween(from, to).map((day) => [
      day,
      { food: 0, drink: 0, tickets: 0 },
    ]),
  );
  for (const ticket of tickets) {
    const bucket = buckets.get(parisParts(ticket.settledAt).day);
    if (!bucket) continue;
    bucket.tickets += 1;
    for (const line of ticket.lines) {
      if (isDrink(line.vatCategory)) bucket.drink += lineTTC(line);
      else bucket.food += lineTTC(line);
    }
  }
  return [...buckets.entries()].map(([day, b]) => ({
    day,
    foodTTC: round2(b.food),
    drinkTTC: round2(b.drink),
    totalTTC: round2(b.food + b.drink),
    tickets: b.tickets,
  }));
};

// ------------------------------------------------------ by service type ---

export interface ServiceRow {
  readonly service: ServiceType;
  readonly tickets: number;
  readonly foodHT: number;
  readonly foodTTC: number;
  readonly drinkHT: number;
  readonly drinkTTC: number;
  readonly ht: number;
  readonly vat: number;
  readonly ttc: number;
  readonly averageTicket: number;
  /** Share of total revenue, 0–100. */
  readonly share: number;
}

const SERVICE_ORDER: readonly ServiceType[] = ["DINE_IN", "TAKEAWAY", "DELIVERY"];

/**
 * The recap by way of serving — sur place, à emporter, livraison — with meals
 * and drinks kept apart, as the owner asked. Every service the restaurant
 * offers gets a row, even one with no sales in the period.
 */
export const byService = (
  tickets: readonly SaleTicket[],
  offered: readonly ServiceType[] = SERVICE_ORDER,
): ServiceRow[] => {
  const total = sum(
    tickets.flatMap((t) => t.lines),
    lineTTC,
  );
  return SERVICE_ORDER.filter((s) => offered.includes(s)).map((service) => {
    const own = tickets.filter((t) => t.service === service);
    const lines = own.flatMap((t) => t.lines);
    const food = lines.filter((l) => !isDrink(l.vatCategory));
    const drink = lines.filter((l) => isDrink(l.vatCategory));
    const ttc = sum(lines, lineTTC);
    return {
      service,
      tickets: own.length,
      foodHT: sum(food, (l) => l.taxable),
      foodTTC: sum(food, lineTTC),
      drinkHT: sum(drink, (l) => l.taxable),
      drinkTTC: sum(drink, lineTTC),
      ht: sum(lines, (l) => l.taxable),
      vat: sum(lines, (l) => l.tax),
      ttc,
      averageTicket: own.length ? round2(ttc / own.length) : 0,
      share: total ? round2((ttc / total) * 100) : 0,
    };
  });
};

// ---------------------------------------------------------------- heatmap ---

export interface Heatmap {
  /** [weekday 0=Mon][hour 0–23] → revenue TTC. */
  readonly cells: readonly (readonly number[])[];
  readonly max: number;
  /** First and last hour with any sale, to crop empty night hours. */
  readonly firstHour: number;
  readonly lastHour: number;
}

export const hourlyHeatmap = (tickets: readonly SaleTicket[]): Heatmap => {
  const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let first = 23;
  let last = 0;
  for (const ticket of tickets) {
    const { weekday, hour } = parisParts(ticket.settledAt);
    cells[weekday][hour] += sum(ticket.lines, lineTTC);
    first = Math.min(first, hour);
    last = Math.max(last, hour);
  }
  const rounded = cells.map((row) => row.map(round2));
  return {
    cells: rounded,
    max: Math.max(0, ...rounded.flat()),
    firstHour: tickets.length ? first : 11,
    lastHour: tickets.length ? last : 22,
  };
};

// -------------------------------------------------------------- top items ---

export interface ItemRow {
  readonly name: string;
  readonly vatCategory: VatCategory;
  readonly quantity: number;
  readonly ttc: number;
}

export const topItems = (
  tickets: readonly SaleTicket[],
  limit = 10,
): ItemRow[] => {
  const byName = new Map<string, { category: VatCategory; qty: number; ttc: number }>();
  for (const line of tickets.flatMap((t) => t.lines)) {
    const row = byName.get(line.name) ?? { category: line.vatCategory, qty: 0, ttc: 0 };
    row.qty += line.quantity;
    row.ttc += lineTTC(line);
    byName.set(line.name, row);
  }
  return [...byName.entries()]
    .map(([name, r]) => ({
      name,
      vatCategory: r.category,
      quantity: r.qty,
      ttc: round2(r.ttc),
    }))
    .sort((a, b) => b.ttc - a.ttc || a.name.localeCompare(b.name))
    .slice(0, limit);
};

// --------------------------------------------------------------- payments ---

export interface PaymentRow {
  readonly mode: string;
  readonly amount: number;
  readonly count: number;
  readonly share: number;
}

export const paymentMix = (tickets: readonly SaleTicket[]): PaymentRow[] => {
  const byMode = new Map<string, { amount: number; count: number }>();
  for (const payment of tickets.flatMap((t) => t.payments)) {
    const row = byMode.get(payment.mode) ?? { amount: 0, count: 0 };
    row.amount += payment.amount;
    row.count += 1;
    byMode.set(payment.mode, row);
  }
  const total = [...byMode.values()].reduce((s, r) => s + r.amount, 0);
  return [...byMode.entries()]
    .map(([mode, r]) => ({
      mode,
      amount: round2(r.amount),
      count: r.count,
      share: total ? round2((r.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export const vatReport = (tickets: readonly SaleTicket[]): VatBreakdownRow[] =>
  vatBreakdown(tickets.flatMap((t) => t.lines));

// --------------------------------------------------------------- findings ---

export interface Finding {
  /** "up" / "down" drive the icon; "info" is neutral. Never color alone. */
  readonly tone: "up" | "down" | "info";
  readonly text: string;
}

const WEEKDAY_NAME = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const SERVICE_NAME: Readonly<Record<ServiceType, string>> = {
  DINE_IN: "sur place",
  TAKEAWAY: "à emporter",
  DELIVERY: "en livraison",
};

const eur = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(n)
    .replace(/ /g, " ");

const pct = (n: number): string =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

const frenchDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  });

/**
 * Plain-French observations drawn only from the period's own figures. Nothing
 * is compared against invented industry benchmarks — every sentence can be
 * checked against a chart on the same page.
 */
export const findings = (input: {
  readonly tickets: readonly SaleTicket[];
  readonly previous: readonly SaleTicket[];
  readonly from: Date;
  readonly to: Date;
}): Finding[] => {
  const { tickets, previous } = input;
  if (tickets.length === 0) {
    return [
      {
        tone: "info",
        text: "Aucune vente encaissée sur cette période.",
      },
    ];
  }

  const out: Finding[] = [];
  const now = computeKpis(tickets);
  const before = computeKpis(previous);

  const change = percentChange(now.revenueTTC, before.revenueTTC);
  if (change !== null) {
    out.push({
      tone: change >= 0 ? "up" : "down",
      text: `Chiffre d'affaires de ${eur(now.revenueTTC)} TTC, ${
        change >= 0 ? "en hausse" : "en baisse"
      } de ${pct(Math.abs(change))} par rapport à la période précédente (${eur(before.revenueTTC)}).`,
    });
  } else {
    out.push({
      tone: "info",
      text: `Chiffre d'affaires de ${eur(now.revenueTTC)} TTC sur ${now.tickets} tickets. Pas de ventes sur la période précédente pour comparer.`,
    });
  }

  const ticketChange = percentChange(now.averageTicket, before.averageTicket);
  if (ticketChange !== null && Math.abs(ticketChange) >= 1) {
    out.push({
      tone: ticketChange >= 0 ? "up" : "down",
      text: `Ticket moyen de ${eur(now.averageTicket)}, ${
        ticketChange >= 0 ? "en hausse" : "en baisse"
      } de ${pct(Math.abs(ticketChange))}.`,
    });
  }

  const days = dailySeries(tickets, input.from, input.to).filter(
    (d) => d.totalTTC > 0,
  );
  if (days.length > 1) {
    const best = days.reduce((a, b) => (b.totalTTC > a.totalTTC ? b : a));
    out.push({
      tone: "info",
      text: `Meilleure journée : ${frenchDay(best.day)}, avec ${eur(best.totalTTC)} sur ${best.tickets} tickets.`,
    });
  }

  const heat = hourlyHeatmap(tickets);
  const weekdayTotals = heat.cells.map((row) => row.reduce((s, v) => s + v, 0));
  const hourTotals = Array.from({ length: 24 }, (_, h) =>
    heat.cells.reduce((s, row) => s + row[h], 0),
  );
  const bestWeekday = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const bestHour = hourTotals.indexOf(Math.max(...hourTotals));
  out.push({
    tone: "info",
    text: `Le ${WEEKDAY_NAME[bestWeekday]} est le jour le plus fort, et le créneau ${bestHour} h – ${bestHour + 1} h concentre le plus de ventes.`,
  });

  out.push({
    tone: "info",
    text: `Les boissons représentent ${pct(now.drinkShare)} du chiffre d'affaires (${eur(now.drinkTTC)}), les repas ${pct(round2(100 - now.drinkShare))} (${eur(now.foodTTC)}).`,
  });

  const services = byService(tickets).filter((s) => s.tickets > 0);
  if (services.length > 1) {
    const leader = services.reduce((a, b) => (b.ttc > a.ttc ? b : a));
    const bestAverage = services.reduce((a, b) =>
      b.averageTicket > a.averageTicket ? b : a,
    );
    out.push({
      tone: "info",
      text: `La vente ${SERVICE_NAME[leader.service]} pèse ${pct(leader.share)} du chiffre d'affaires ; le ticket moyen le plus élevé est ${SERVICE_NAME[bestAverage.service]} (${eur(bestAverage.averageTicket)}).`,
    });
  }

  const [star] = topItems(tickets, 1);
  if (star) {
    out.push({
      tone: "info",
      text: `Article le plus rentable : ${star.name}, ${star.quantity} vendus pour ${eur(star.ttc)}.`,
    });
  }

  const vouchers = paymentMix(tickets).find((p) => p.mode === "MEAL_VOUCHER");
  if (vouchers) {
    out.push({
      tone: "info",
      text: `Les titres-restaurant règlent ${pct(vouchers.share)} des encaissements (${eur(vouchers.amount)}).`,
    });
  }

  out.push({
    tone: "info",
    text: `TVA collectée à déclarer sur la période : ${eur(now.vat)}.`,
  });

  return out;
};
