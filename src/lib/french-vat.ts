/**
 * French restaurant VAT. No IO — the rules every ticket, invoice and sales
 * recap depends on live here and are exhaustively tested.
 *
 * In France the rate on a line depends on two things at once: what is sold
 * (a meal, a soft drink, an alcoholic drink) and how it is served (on the
 * premises, taken away, delivered). The table below is the common case for a
 * restaurant (CGI art. 278-0 bis and 279):
 *
 *                         Sur place   À emporter   Livraison
 *   Repas / nourriture       10 %        10 %         10 %
 *   Boissons sans alcool     10 %        5,5 %        5,5 %
 *   Boissons alcoolisées     20 %        20 %         20 %
 *
 * Takeaway food is 10 % because a restaurant sells it for immediate
 * consumption; soft drinks taken away in a closed container drop to 5,5 %.
 * Edge cases exist (packaged goods kept for later are 5,5 %), so the table is
 * one constant — a restaurant whose accountant reads it differently changes it
 * in one place.
 */

export type VatCategory = "FOOD" | "SOFT_DRINK" | "ALCOHOL";
export type ServiceType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export const FRENCH_VAT_RATES: Readonly<
  Record<VatCategory, Readonly<Record<ServiceType, number>>>
> = {
  FOOD: { DINE_IN: 10, TAKEAWAY: 10, DELIVERY: 10 },
  SOFT_DRINK: { DINE_IN: 10, TAKEAWAY: 5.5, DELIVERY: 5.5 },
  ALCOHOL: { DINE_IN: 20, TAKEAWAY: 20, DELIVERY: 20 },
};

export const resolveFrenchVatRate = (
  category: VatCategory,
  service: ServiceType,
): number => FRENCH_VAT_RATES[category][service];

/** An item's own category wins; otherwise it inherits its menu section's. */
export const effectiveVatCategory = (
  itemCategory: VatCategory | null | undefined,
  sectionCategory: VatCategory,
): VatCategory => itemCategory ?? sectionCategory;

/** Drinks are reported apart from meals, whatever their alcohol content. */
export const isDrink = (category: VatCategory): boolean =>
  category === "SOFT_DRINK" || category === "ALCOHOL";

export const VAT_CATEGORY_LABEL: Readonly<Record<VatCategory, string>> = {
  FOOD: "Repas",
  SOFT_DRINK: "Boissons sans alcool",
  ALCOHOL: "Boissons alcoolisées",
};

export const SERVICE_TYPE_LABEL: Readonly<Record<ServiceType, string>> = {
  DINE_IN: "Sur place",
  TAKEAWAY: "À emporter",
  DELIVERY: "Livraison",
};

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export interface VatLine {
  /** Percent, e.g. 10 or 5.5. */
  readonly taxRate: number;
  /** Amount excluding tax (HT). */
  readonly taxable: number;
  readonly tax: number;
}

export interface VatBreakdownRow {
  readonly rate: number;
  readonly baseHT: number;
  readonly vat: number;
  readonly totalTTC: number;
}

/**
 * VAT split by rate — the "ventilation de la TVA par taux" a French receipt
 * and invoice must show. Rows are ordered by rate so every document lists them
 * the same way, and rates with nothing on them are left out.
 */
export const vatBreakdown = (
  lines: readonly VatLine[],
): VatBreakdownRow[] => {
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const line of lines) {
    const bucket = byRate.get(line.taxRate) ?? { base: 0, vat: 0 };
    bucket.base += line.taxable;
    bucket.vat += line.tax;
    byRate.set(line.taxRate, bucket);
  }
  return [...byRate.entries()]
    .filter(([, b]) => b.base !== 0 || b.vat !== 0)
    .sort(([a], [b]) => a - b)
    .map(([rate, b]) => ({
      rate,
      baseHT: round2(b.base),
      vat: round2(b.vat),
      totalTTC: round2(b.base + b.vat),
    }));
};

/** "5,5 %" — French notation, decimal comma, a space before the sign. */
export const formatVatRate = (rate: number): string =>
  `${rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
