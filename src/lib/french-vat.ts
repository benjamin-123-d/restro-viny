/**
 * French restaurant VAT. No IO — the rules every ticket, invoice and sales
 * recap depends on live here and are exhaustively tested.
 *
 * The rate on a line depends on three things: where the restaurant is (VAT is
 * not the same across French territories), what is sold (a meal, a soft
 * drink, an alcoholic drink) and how it is served (on the premises, taken
 * away, delivered).
 *
 * Sources, checked against the text in force in September 2026:
 *
 *  · France continentale — CGI art. 278-0 bis (5,5 %) and 279 (10 %).
 *    Takeaway food sold for immediate consumption is 10 %; soft drinks taken
 *    away in a closed container are 5,5 %; alcohol is always at the normal
 *    rate, 20 %.
 *
 *  · Corse — CGI art. 297 I-1-5°, BOFiP BOI-TVA-GEO-10-10 § 100: in Corsica
 *    alcoholic drinks consumed ON THE PREMISES are taxed at 10 %, not 20 %.
 *    Other on-premises sales stay at 10 % as on the continent. Takeaway alcohol
 *    is not in that list and stays at 20 %. Whether takeaway food and soft
 *    drinks fall under Corsica's 2,10 % rate for foodstuffs (§ 60) is not
 *    settled by the text read, so those cells are flagged to confirm.
 *
 *  · Guadeloupe, Martinique, La Réunion — CGI art. 296: 2,10 % for the
 *    operations of articles 278-0 bis to 279-0 bis A (which covers restaurant
 *    meals and soft drinks), 8,50 % in every other case (so alcohol).
 *
 *  · Guyane, Mayotte — CGI art. 294: "la taxe sur la valeur ajoutée n'est
 *    provisoirement pas applicable".
 *
 * Articles 294 and 296 are repealed on 1 January 2027 by ordonnance
 * n° 2025-1247 (recodification of the CGI): the article numbers change then,
 * and these rates must be checked again against the new code.
 */

export type VatCategory = "FOOD" | "SOFT_DRINK" | "ALCOHOL";
export type ServiceType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type VatTerritory =
  | "METROPOLE"
  | "CORSE"
  | "GUADELOUPE"
  | "MARTINIQUE"
  | "REUNION"
  | "GUYANE"
  | "MAYOTTE";

type RateTable = Readonly<
  Record<VatCategory, Readonly<Record<ServiceType, number>>>
>;

const METROPOLE: RateTable = {
  FOOD: { DINE_IN: 10, TAKEAWAY: 10, DELIVERY: 10 },
  SOFT_DRINK: { DINE_IN: 10, TAKEAWAY: 5.5, DELIVERY: 5.5 },
  ALCOHOL: { DINE_IN: 20, TAKEAWAY: 20, DELIVERY: 20 },
};

/** Guadeloupe, Martinique and La Réunion share art. 296. */
const DOM_ART_296: RateTable = {
  FOOD: { DINE_IN: 2.1, TAKEAWAY: 2.1, DELIVERY: 2.1 },
  SOFT_DRINK: { DINE_IN: 2.1, TAKEAWAY: 2.1, DELIVERY: 2.1 },
  ALCOHOL: { DINE_IN: 8.5, TAKEAWAY: 8.5, DELIVERY: 8.5 },
};

/** Guyane and Mayotte: VAT not applicable (art. 294). */
const NO_VAT: RateTable = {
  FOOD: { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 },
  SOFT_DRINK: { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 },
  ALCOHOL: { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 },
};

export const VAT_RATES_BY_TERRITORY: Readonly<Record<VatTerritory, RateTable>> =
  {
    METROPOLE,
    CORSE: {
      FOOD: { DINE_IN: 10, TAKEAWAY: 10, DELIVERY: 10 },
      SOFT_DRINK: { DINE_IN: 10, TAKEAWAY: 10, DELIVERY: 10 },
      ALCOHOL: { DINE_IN: 10, TAKEAWAY: 20, DELIVERY: 20 },
    },
    GUADELOUPE: DOM_ART_296,
    MARTINIQUE: DOM_ART_296,
    REUNION: DOM_ART_296,
    GUYANE: NO_VAT,
    MAYOTTE: NO_VAT,
  };

/** Continental France — the default, and what earlier code referred to. */
export const FRENCH_VAT_RATES: RateTable = METROPOLE;

/**
 * Cells whose rate the texts consulted do not settle on their own. The app
 * applies the rate shown and says so on screen; an accountant confirms it.
 */
export const RATES_TO_CONFIRM: readonly {
  readonly territory: VatTerritory;
  readonly category: VatCategory;
  readonly service: ServiceType;
  readonly note: string;
}[] = [
  {
    territory: "CORSE",
    category: "FOOD",
    service: "TAKEAWAY",
    note: "Le taux de 2,10 % des produits alimentaires (art. 297 I-1-2° CGI) pourrait s'appliquer à la vente à emporter.",
  },
  {
    territory: "CORSE",
    category: "FOOD",
    service: "DELIVERY",
    note: "Le taux de 2,10 % des produits alimentaires (art. 297 I-1-2° CGI) pourrait s'appliquer à la livraison.",
  },
  {
    territory: "CORSE",
    category: "SOFT_DRINK",
    service: "TAKEAWAY",
    note: "Le taux de 2,10 % des boissons non alcooliques (art. 297 I-1-2° CGI) pourrait s'appliquer à la vente à emporter.",
  },
  {
    territory: "CORSE",
    category: "SOFT_DRINK",
    service: "DELIVERY",
    note: "Le taux de 2,10 % des boissons non alcooliques (art. 297 I-1-2° CGI) pourrait s'appliquer à la livraison.",
  },
];

export const VAT_TERRITORY_LABEL: Readonly<Record<VatTerritory, string>> = {
  METROPOLE: "France continentale",
  CORSE: "Corse",
  GUADELOUPE: "Guadeloupe",
  MARTINIQUE: "Martinique",
  REUNION: "La Réunion",
  GUYANE: "Guyane",
  MAYOTTE: "Mayotte",
};

/** One line under the territory picker saying which regime applies. */
export const VAT_TERRITORY_NOTE: Readonly<Record<VatTerritory, string>> = {
  METROPOLE: "Taux de 5,5 %, 10 % et 20 % (art. 278-0 bis et 279 CGI).",
  CORSE: "Alcool sur place à 10 % (art. 297 CGI). Certains taux à emporter sont à confirmer.",
  GUADELOUPE: "Taux réduit 2,10 %, taux normal 8,50 % (art. 296 CGI).",
  MARTINIQUE: "Taux réduit 2,10 %, taux normal 8,50 % (art. 296 CGI).",
  REUNION: "Taux réduit 2,10 %, taux normal 8,50 % (art. 296 CGI).",
  GUYANE: "TVA provisoirement non applicable (art. 294 CGI).",
  MAYOTTE: "TVA provisoirement non applicable (art. 294 CGI).",
};

export const vatRatesFor = (territory: VatTerritory = "METROPOLE"): RateTable =>
  VAT_RATES_BY_TERRITORY[territory];

export const resolveFrenchVatRate = (
  category: VatCategory,
  service: ServiceType,
  territory: VatTerritory = "METROPOLE",
): number => VAT_RATES_BY_TERRITORY[territory][category][service];

/** Distinct rates in use for a territory, lowest first — the VAT report rows. */
export const ratesInUse = (territory: VatTerritory): number[] =>
  [
    ...new Set(
      Object.values(VAT_RATES_BY_TERRITORY[territory]).flatMap((byService) =>
        Object.values(byService),
      ),
    ),
  ].sort((a, b) => a - b);

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
