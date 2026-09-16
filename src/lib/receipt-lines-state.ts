/**
 * The state behind the « lignes du ticket » table: what the reading found,
 * what the owner changed, and what that adds up to. Kept pure so the sums the
 * screen shows are the sums the tests check.
 */

import { splitTTC } from "./expense-breakdown-state";
import { suggestCategory, type ExpenseLineInput, type PurchaseCategory } from "./purchase-categories";
import type { ReceiptLine } from "./receipt-parser";

export interface ReceiptLineDraft {
  readonly key: string;
  readonly label: string;
  /** As typed: the amount printed on that line of the ticket. */
  readonly amount: string;
  readonly quantity: string;
  readonly category: PurchaseCategory;
  readonly family: string | null;
  readonly code: string | null;
  readonly vatRate: number;
  /** The stock item this line feeds, when the owner linked one. */
  readonly stockItemId: string | null;
  /** Lines the owner does not want to keep — packaging deposits, notes… */
  readonly ignored: boolean;
  /** Filled in from what the restaurant learned on an earlier ticket. */
  readonly learned: boolean;
}

export type LineFilter = "TOUT" | "A_TRAITER" | PurchaseCategory;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const parseAmount = (value: string): number => {
  const n = Number(value.replace(/\s/g, "").replace("€", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const amountText = (n: number): string => String(n).replace(".", ",");

let seq = 0;

/** A blank line, for something the reading missed. */
export const emptyLine = (category: PurchaseCategory = "DENREES", vatRate = 5.5): ReceiptLineDraft => ({
  key: `l-${seq++}`,
  label: "",
  amount: "",
  quantity: "",
  category,
  family: null,
  code: null,
  vatRate,
  stockItemId: null,
  ignored: false,
  learned: false,
});

/** The read lines, turned into rows the owner can correct. */
export const linesFromReading = (
  lines: readonly ReceiptLine[],
  defaultVatRate = 5.5,
): ReceiptLineDraft[] =>
  lines.map((line) => ({
    key: `l-${seq++}`,
    label: line.label,
    amount: amountText(line.amount),
    quantity: line.quantity == null ? "" : String(line.quantity).replace(".", ","),
    category: line.category ?? suggestCategory(line.label),
    family: line.family,
    code: line.code,
    vatRate: line.vatRate ?? defaultVatRate,
    stockItemId: line.stockItemId ?? null,
    ignored: false,
    learned: line.learned === true,
  }));

export const keptLines = (lines: readonly ReceiptLineDraft[]): ReceiptLineDraft[] =>
  lines.filter((line) => !line.ignored && parseAmount(line.amount) !== 0);

/** The rows to show, once the search box and the filter have had their say. */
export const visibleLines = (
  lines: readonly ReceiptLineDraft[],
  filter: LineFilter,
  search: string,
): ReceiptLineDraft[] => {
  const needle = search.trim().toLowerCase();
  return lines.filter((line) => {
    if (filter === "A_TRAITER" && (line.ignored || line.stockItemId != null)) return false;
    if (filter !== "TOUT" && filter !== "A_TRAITER" && line.category !== filter) return false;
    if (!needle) return true;
    return `${line.label} ${line.code ?? ""}`.toLowerCase().includes(needle);
  });
};

export interface LinesSummary {
  readonly kept: number;
  readonly ignored: number;
  readonly linked: number;
  /** What the kept lines add up to, in the unit the ticket prints. */
  readonly total: number;
  readonly byCategory: readonly { readonly category: PurchaseCategory; readonly amount: number }[];
  readonly foodAmount: number;
}

export const summarise = (lines: readonly ReceiptLineDraft[]): LinesSummary => {
  const kept = keptLines(lines);
  const byCategory = new Map<PurchaseCategory, number>();
  for (const line of kept) {
    byCategory.set(line.category, round2((byCategory.get(line.category) ?? 0) + parseAmount(line.amount)));
  }
  return {
    kept: kept.length,
    ignored: lines.filter((line) => line.ignored).length,
    linked: kept.filter((line) => line.stockItemId != null).length,
    total: round2(kept.reduce((sum, line) => sum + parseAmount(line.amount), 0)),
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    foodAmount: round2(
      kept
        .filter((line) => line.category === "DENREES" || line.category === "BOISSONS")
        .reduce((sum, line) => sum + parseAmount(line.amount), 0),
    ),
  };
};

/**
 * The breakdown the purchase is saved with, grouped by category and VAT rate.
 * Ticket amounts are TTC, wholesaler amounts are HT: both end up as HT + VAT.
 */
export const expenseLinesFrom = (
  lines: readonly ReceiptLineDraft[],
  amountsAre: "HT" | "TTC",
): ExpenseLineInput[] => {
  const groups = new Map<string, { category: PurchaseCategory; vatRate: number; amount: number }>();
  for (const line of keptLines(lines)) {
    const key = `${line.category}-${line.vatRate}`;
    const group = groups.get(key) ?? { category: line.category, vatRate: line.vatRate, amount: 0 };
    group.amount += parseAmount(line.amount);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) =>
    amountsAre === "TTC"
      ? { category: group.category, vatRate: group.vatRate, ...splitTTC(round2(group.amount), group.vatRate) }
      : {
          category: group.category,
          vatRate: group.vatRate,
          amountHT: round2(group.amount),
          vatAmount: round2((group.amount * group.vatRate) / 100),
        },
  );
};

/**
 * What is worth learning from this ticket: the wording, its article code, and
 * the answer the owner settled on. Sent with the purchase so the next ticket
 * from the same shop arrives already classed.
 */
export const learnLinesFrom = (
  lines: readonly ReceiptLineDraft[],
): { label: string; code?: string; category: PurchaseCategory; stockItemId?: string }[] =>
  keptLines(lines)
    .filter((line) => line.label.trim().length > 1)
    .map((line) => ({
      label: line.label.trim().slice(0, 160),
      ...(line.code ? { code: line.code } : {}),
      category: line.category,
      ...(line.stockItemId ? { stockItemId: line.stockItemId } : {}),
    }));

/** The ingredient lines: the ones the owner linked to something in stock. */
export const stockLinesFrom = (
  lines: readonly ReceiptLineDraft[],
  amountsAre: "HT" | "TTC",
): { stockItemId: string; quantity: number; amount: number }[] =>
  keptLines(lines)
    .filter((line) => line.stockItemId)
    .map((line) => {
      const amount = parseAmount(line.amount);
      const quantity = parseAmount(line.quantity) || 1;
      const vatRate = line.vatRate;
      return {
        stockItemId: line.stockItemId as string,
        quantity,
        // Stock always records what was paid before VAT.
        amount: amountsAre === "TTC" ? splitTTC(amount, vatRate).amountHT : round2(amount),
      };
    });
