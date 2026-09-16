import type { ExpenseLineInput, PurchaseCategory } from "./purchase-categories";

/**
 * What the breakdown form holds, and how it becomes expense lines. Shop
 * tickets print prices TTC, supplier invoices HT: the owner types what they
 * read, the VAT is worked out from the rate.
 */

export interface BreakdownRow {
  readonly key: string;
  readonly category: PurchaseCategory;
  readonly label: string;
  /** As typed, TTC or HT depending on `amountsAre`. */
  readonly amount: string;
  readonly vatRate: number;
}

export interface BreakdownState {
  /** null until the owner answers « autre chose que de la nourriture ? ». */
  readonly mixed: boolean | null;
  readonly amountsAre: "TTC" | "HT";
  /** When not mixed: everything in one category at one rate. */
  readonly singleCategory: PurchaseCategory;
  readonly singleRate: number;
  readonly rows: readonly BreakdownRow[];
}

export const VAT_RATES: readonly number[] = [5.5, 10, 20, 2.1, 0];

export const emptyBreakdown = (): BreakdownState => ({
  mixed: null,
  amountsAre: "TTC",
  singleCategory: "DENREES",
  singleRate: 5.5,
  rows: [],
});

export const parseAmount = (value: string): number => {
  const n = Number(value.replace(/\s/g, "").replace("€", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Splits a TTC amount so HT + VAT gives it back exactly. */
export const splitTTC = (ttc: number, rate: number): { amountHT: number; vatAmount: number } => {
  const amountHT = round2(ttc / (1 + rate / 100));
  return { amountHT, vatAmount: round2(ttc - amountHT) };
};

/** The lines to send, or an empty list while nothing usable is typed. */
export const toExpenseLines = (
  state: BreakdownState,
  ticketTTC: number | undefined,
): (ExpenseLineInput & { label?: string })[] => {
  if (state.mixed === false || state.mixed === null) {
    if (!ticketTTC || ticketTTC <= 0) return [];
    return [{ category: state.singleCategory, vatRate: state.singleRate, ...splitTTC(ticketTTC, state.singleRate) }];
  }
  return state.rows
    .map((row) => ({ row, amount: parseAmount(row.amount) }))
    .filter(({ amount }) => amount > 0)
    .map(({ row, amount }) => {
      const parts =
        state.amountsAre === "TTC"
          ? splitTTC(amount, row.vatRate)
          : { amountHT: round2(amount), vatAmount: round2((amount * row.vatRate) / 100) };
      return { category: row.category, vatRate: row.vatRate, label: row.label.trim() || undefined, ...parts };
    });
};

/** The amount to type in a new row so the breakdown reaches the ticket total. */
export const remainderToType = (gapTTC: number, amountsAre: "TTC" | "HT", rate: number): number =>
  amountsAre === "TTC" ? round2(gapTTC) : round2(gapTTC / (1 + rate / 100));
