/**
 * What a purchase was spent on. A shop ticket often mixes the day's
 * vegetables with bleach and a new ladle: only food and drinks belong in the
 * food cost, the rest is what the restaurant costs to run.
 */

import { foldText } from "./search-text";

export type PurchaseCategory = "DENREES" | "BOISSONS" | "ENTRETIEN" | "MATERIEL" | "EMBALLAGES" | "AUTRE";

export const PURCHASE_CATEGORIES: readonly PurchaseCategory[] = [
  "DENREES",
  "BOISSONS",
  "ENTRETIEN",
  "MATERIEL",
  "EMBALLAGES",
  "AUTRE",
];

export const CATEGORY_LABEL: Readonly<Record<PurchaseCategory, string>> = {
  DENREES: "Denrées alimentaires",
  BOISSONS: "Boissons",
  ENTRETIEN: "Produits d'entretien",
  MATERIEL: "Matériel et ustensiles",
  EMBALLAGES: "Emballages et jetables",
  AUTRE: "Autre",
};

export const CATEGORY_HINT: Readonly<Record<PurchaseCategory, string>> = {
  DENREES: "Légumes, viandes, épicerie, crèmerie… Comptent dans le food cost.",
  BOISSONS: "Eaux, sodas, vins, bières, café. Comptent dans le food cost.",
  ENTRETIEN: "Javel, liquide vaisselle, éponges, sacs poubelle, papier essuie-tout.",
  MATERIEL: "Casseroles, couteaux, bacs, petit électroménager. Au-delà de 500 € HT l'objet, c'est un investissement : signalez-le au comptable.",
  EMBALLAGES: "Barquettes, boîtes à emporter, film, papier aluminium, serviettes.",
  AUTRE: "Tout le reste : fournitures de bureau, décoration, carburant…",
};

/** The French VAT rate most often printed for each kind of purchase. */
export const CATEGORY_DEFAULT_VAT: Readonly<Record<PurchaseCategory, number>> = {
  DENREES: 5.5,
  BOISSONS: 20,
  ENTRETIEN: 20,
  MATERIEL: 20,
  EMBALLAGES: 20,
  AUTRE: 20,
};

/** Categories whose spending is food cost. */
export const isFoodCategory = (category: PurchaseCategory): boolean =>
  category === "DENREES" || category === "BOISSONS";

// Words are folded (no accents, lower case) and matched as word prefixes.
const KEYWORDS: readonly (readonly [PurchaseCategory, readonly string[]])[] = [
  [
    "ENTRETIEN",
    [
      "javel", "vaisselle", "eponge", "degraiss", "desinfect", "detergent", "lessive", "savon", "nettoy",
      "sac poubelle", "poubelle", "essuie", "sopalin", "gant menage", "serpillere", "balai", "lave vaisselle",
      "rincage", "anticalcaire", "vitre", "wc", "lingette", "chiffon", "microfibre", "ajax", "cif", "mr propre",
    ],
  ],
  [
    "MATERIEL",
    [
      "casserole", "poele", "couteau", "fouet", "louche", "spatule", "planche", "bac gastro", "gastro", "passoire",
      "saladier", "plat four", "moule", "thermometre", "balance", "mixeur", "blender", "robot", "friteuse",
      "ustensile", "assiette", "verre", "tasse", "couvert", "fourchette", "cuillere", "plateau", "ampoule",
      "rallonge", "multiprise", "tablier", "torchon", "coupe pate", "corne", "rouleau patisserie", "pince",
    ],
  ],
  [
    "EMBALLAGES",
    [
      "barquette", "boite", "emporter", "film", "alu", "aluminium", "sachet", "sac kraft", "papier cuisson",
      "gobelet", "paille", "serviette", "couvercle", "pot sauce", "etiquette", "cabas", "papier brun", "poche",
      "carton", "rouleau caisse", "papier alu",
    ],
  ],
  [
    "BOISSONS",
    [
      "eau", "evian", "vittel", "badoit", "perrier", "cristaline", "soda", "coca", "orangina", "schweppes",
      "limonade", "jus", "sirop", "biere", "vin", "rose", "champagne", "whisky", "rhum", "vodka", "pastis",
      "cafe", "the", "tisane", "lait vegetal",
    ],
  ],
];

/** Cooking ingredients whose names contain a drink word (« vinaigre de vin »). */
const FOOD_FIRST: readonly string[] = ["vinaigr", "sauce", "bouillon", "farine", "sucre"];

/**
 * A keyword matches a whole word, its plural, or — for words of five letters
 * or more — the start of a word; phrases match at a word boundary.
 */
const hasKeyword = (folded: string, keyword: string): boolean => {
  if (keyword.includes(" ")) return ` ${folded} `.includes(` ${keyword} `) || ` ${folded}`.includes(` ${keyword}`);
  return folded
    .split(" ")
    .some((word) => word === keyword || word === `${keyword}s` || word === `${keyword}x` || (keyword.length >= 5 && word.startsWith(keyword)));
};

/**
 * A best guess from a ticket line's wording; food when nothing else fits,
 * since that is most of what a restaurant buys. Always shown as a suggestion.
 */
export const suggestCategory = (label: string): PurchaseCategory => {
  const folded = foldText(label);
  if (!folded) return "AUTRE";
  const words = folded.split(" ");
  for (const [category, keywords] of KEYWORDS) {
    if (category === "BOISSONS" && FOOD_FIRST.some((prefix) => words.some((w) => w.startsWith(prefix)))) continue;
    if (keywords.some((keyword) => hasKeyword(folded, keyword))) return category;
  }
  return "DENREES";
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ExpenseLineInput {
  readonly category: PurchaseCategory;
  readonly amountHT: number;
  readonly vatRate: number;
  /** When the ticket prints it; otherwise computed from the rate. */
  readonly vatAmount?: number | null;
}

export interface ExpenseBreakdown {
  readonly lines: readonly (ExpenseLineInput & { readonly vatAmount: number; readonly amountTTC: number })[];
  readonly totalHT: number;
  readonly totalVAT: number;
  readonly totalTTC: number;
  readonly byCategory: Readonly<Partial<Record<PurchaseCategory, number>>>;
  readonly foodHT: number;
}

export const breakdownTotals = (lines: readonly ExpenseLineInput[]): ExpenseBreakdown => {
  const computed = lines.map((line) => {
    const vatAmount = round2(line.vatAmount ?? (line.amountHT * line.vatRate) / 100);
    return { ...line, vatAmount, amountTTC: round2(line.amountHT + vatAmount) };
  });
  const byCategory: Partial<Record<PurchaseCategory, number>> = {};
  for (const line of computed) byCategory[line.category] = round2((byCategory[line.category] ?? 0) + line.amountHT);
  return {
    lines: computed,
    totalHT: round2(computed.reduce((s, l) => s + l.amountHT, 0)),
    totalVAT: round2(computed.reduce((s, l) => s + l.vatAmount, 0)),
    totalTTC: round2(computed.reduce((s, l) => s + l.amountTTC, 0)),
    byCategory,
    foodHT: round2(computed.filter((l) => isFoodCategory(l.category)).reduce((s, l) => s + l.amountHT, 0)),
  };
};

/** Tickets round each VAT line, so a few cents apart still counts as equal. */
export const BREAKDOWN_TOLERANCE = 0.05;

/**
 * The gap between what the categories add up to and what the ticket says was
 * paid: positive when something is missing from the breakdown.
 */
export const breakdownGap = (lines: readonly ExpenseLineInput[], ticketTTC: number): number =>
  round2(ticketTTC - breakdownTotals(lines).totalTTC);

export const breakdownMatches = (lines: readonly ExpenseLineInput[], ticketTTC: number): boolean =>
  Math.abs(breakdownGap(lines, ticketTTC)) <= BREAKDOWN_TOLERANCE;
