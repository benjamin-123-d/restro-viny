/**
 * The detailed list of what was sold: one row per settled ticket, with every
 * filter a restaurant asks for — dates, service, payment, amount, table,
 * customer, dish, discount — and the total of whatever the filters leave.
 * It reads the same orders the till writes, so it can be trusted as the book
 * of sales.
 */

import { parisMidnight, toTicket } from "@/services/sales-analytics.service";
import { findMenuVatCategories } from "@/repositories/sales-analytics.repository";
import { findSaleTickets, type SaleTicketFilter } from "@/repositories/sales-ledger.repository";
import { foldText } from "@/lib/search-text";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-labels";
import type { ServiceType } from "@/lib/french-vat";
import type { PurchasingContext } from "@/services/supplier.service";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SaleTicketFilters {
  /** Paris calendar days, "YYYY-MM-DD". */
  readonly from?: string;
  readonly to?: string;
  readonly service?: ServiceType;
  readonly payment?: string;
  readonly minTotal?: number;
  readonly maxTotal?: number;
  /** Ticket number, table, customer name or phone. */
  readonly search?: string;
  readonly menuItemId?: string;
  readonly discountedOnly?: boolean;
  readonly sort?: "recent" | "ancien" | "montant" | "montant-asc";
  readonly limit?: number;
}

export interface SaleTicketRow {
  readonly id: string;
  readonly number: string;
  readonly orderNumber: number;
  readonly settledAt: string;
  readonly service: ServiceType;
  readonly tableLabel: string | null;
  readonly customerName: string | null;
  readonly items: number;
  readonly totalHT: number;
  readonly vat: number;
  readonly totalTTC: number;
  readonly discount: number;
  readonly materialCost: number | null;
  readonly margin: number | null;
  readonly payments: readonly { readonly mode: string; readonly label: string; readonly amount: number }[];
  readonly dishes: readonly string[];
}

export interface SaleLedgerDTO {
  readonly rows: readonly SaleTicketRow[];
  readonly totals: {
    readonly tickets: number;
    readonly totalHT: number;
    readonly vat: number;
    readonly totalTTC: number;
    readonly averageTicket: number;
    readonly discount: number;
    readonly materialCost: number;
    readonly margin: number | null;
  };
  /** Values actually present in the period, to fill the filter menus. */
  readonly facets: {
    readonly payments: readonly { readonly mode: string; readonly label: string }[];
    readonly dishes: readonly { readonly id: string; readonly name: string }[];
  };
  readonly truncated: boolean;
}

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 300;

/** A day typed in a filter means the whole Paris day, start or end included. */
export const filterWindow = (filters: SaleTicketFilters): { from?: Date; to?: Date } => ({
  from: filters.from ? parisMidnight(filters.from) : undefined,
  to: filters.to ? new Date(parisMidnight(filters.to).getTime() + DAY_MS) : undefined,
});

export const listSaleTickets = async (
  ctx: PurchasingContext,
  filters: SaleTicketFilters,
): Promise<SaleLedgerDTO> => {
  const window = filterWindow(filters);
  const query: SaleTicketFilter = {
    restaurantId: ctx.restaurantId,
    from: window.from,
    to: window.to,
    service: filters.service,
    minTotal: filters.minTotal,
    maxTotal: filters.maxTotal,
    discountedOnly: filters.discountedOnly,
  };
  const [categories, orders] = await Promise.all([
    findMenuVatCategories(ctx.restaurantId),
    findSaleTickets(query),
  ]);

  const needle = filters.search ? foldText(filters.search) : "";
  const rows: SaleTicketRow[] = [];
  const payments = new Map<string, string>();
  const dishes = new Map<string, string>();

  for (const order of orders) {
    const ticket = toTicket(order, categories);
    for (const payment of ticket.payments) payments.set(payment.mode, PAYMENT_MODE_LABEL[payment.mode] ?? payment.mode);
    for (const line of ticket.lines) if (line.menuItemId) dishes.set(line.menuItemId, line.name);

    if (filters.payment && !ticket.payments.some((p) => p.mode === filters.payment)) continue;
    if (filters.menuItemId && !ticket.lines.some((l) => l.menuItemId === filters.menuItemId)) continue;

    const number =
      ticket.invoiceNumber != null ? `F-${String(ticket.invoiceNumber).padStart(5, "0")}` : `#${ticket.orderNumber}`;
    if (needle) {
      const haystack = foldText(
        [number, String(ticket.orderNumber), ticket.tableLabel, order.customerName, order.customerPhone, ...ticket.lines.map((l) => l.name)]
          .filter(Boolean)
          .join(" "),
      );
      if (!haystack.includes(needle)) continue;
    }

    const totalHT = round2(ticket.lines.reduce((s, l) => s + l.taxable, 0));
    const vat = round2(ticket.lines.reduce((s, l) => s + l.tax, 0));
    const known = ticket.lines.filter((l) => l.foodCost != null);
    const materialCost = known.length > 0 ? round2(known.reduce((s, l) => s + l.quantity * (l.foodCost ?? 0), 0)) : null;
    const coveredHT = known.length > 0 ? round2(known.reduce((s, l) => s + l.taxable, 0)) : 0;

    rows.push({
      id: ticket.id,
      number,
      orderNumber: ticket.orderNumber,
      settledAt: ticket.settledAt.toISOString(),
      service: ticket.service,
      tableLabel: ticket.tableLabel,
      customerName: order.customerName,
      items: ticket.lines.reduce((s, l) => s + l.quantity, 0),
      totalHT,
      vat,
      totalTTC: round2(totalHT + vat),
      discount: ticket.discountTotal,
      materialCost,
      margin: materialCost == null ? null : round2(coveredHT - materialCost),
      payments: ticket.payments.map((p) => ({
        mode: p.mode,
        label: PAYMENT_MODE_LABEL[p.mode] ?? p.mode,
        amount: p.amount,
      })),
      dishes: [...new Set(ticket.lines.map((l) => l.name))],
    });
  }

  const sort = filters.sort ?? "recent";
  rows.sort((a, b) =>
    sort === "ancien"
      ? a.settledAt.localeCompare(b.settledAt)
      : sort === "montant"
        ? b.totalTTC - a.totalTTC
        : sort === "montant-asc"
          ? a.totalTTC - b.totalTTC
          : b.settledAt.localeCompare(a.settledAt),
  );

  const limit = filters.limit ?? DEFAULT_LIMIT;
  const shown = rows.slice(0, limit);
  const withCost = rows.filter((r) => r.materialCost != null);

  return {
    rows: shown,
    totals: {
      tickets: rows.length,
      totalHT: round2(rows.reduce((s, r) => s + r.totalHT, 0)),
      vat: round2(rows.reduce((s, r) => s + r.vat, 0)),
      totalTTC: round2(rows.reduce((s, r) => s + r.totalTTC, 0)),
      averageTicket: rows.length > 0 ? round2(rows.reduce((s, r) => s + r.totalTTC, 0) / rows.length) : 0,
      discount: round2(rows.reduce((s, r) => s + r.discount, 0)),
      materialCost: round2(withCost.reduce((s, r) => s + (r.materialCost ?? 0), 0)),
      margin: withCost.length > 0 ? round2(withCost.reduce((s, r) => s + (r.margin ?? 0), 0)) : null,
    },
    facets: {
      payments: [...payments].map(([mode, label]) => ({ mode, label })).sort((a, b) => a.label.localeCompare(b.label, "fr")),
      dishes: [...dishes].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    },
    truncated: rows.length > shown.length,
  };
};

/** The same rows as a spreadsheet, one line per ticket, French separators. */
export const saleTicketsCsv = (ledger: SaleLedgerDTO): string => {
  const head = [
    "Numéro",
    "Date",
    "Heure",
    "Service",
    "Table",
    "Client",
    "Articles",
    "Total HT",
    "TVA",
    "Total TTC",
    "Remise",
    "Coût matière",
    "Marge",
    "Paiements",
    "Plats",
  ];
  const SERVICE: Record<string, string> = { DINE_IN: "Sur place", TAKEAWAY: "À emporter", DELIVERY: "Livraison" };
  const cell = (value: string | number | null): string => {
    const text = value == null ? "" : typeof value === "number" ? value.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : value;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = ledger.rows.map((row) => {
    const date = new Date(row.settledAt);
    return [
      cell(row.number),
      cell(date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })),
      cell(date.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })),
      cell(SERVICE[row.service] ?? row.service),
      cell(row.tableLabel),
      cell(row.customerName),
      cell(row.items),
      cell(row.totalHT),
      cell(row.vat),
      cell(row.totalTTC),
      cell(row.discount),
      cell(row.materialCost),
      cell(row.margin),
      cell(row.payments.map((p) => p.label).join(", ")),
      cell(row.dishes.join(", ")),
    ].join(";");
  });
  return [head.map(cell).join(";"), ...lines].join("\r\n");
};
