/**
 * Built-in catalogue of standard recipe cards, proposed from a dish's name.
 * A card taken from here is only a starting point: it is always created as
 * "Estimée" until the owner corrects it or weighs a portion.
 *
 * Quantities are gross (as taken from the store room) for the whole batch of
 * `portions`, in grams, millilitres or pieces.
 */

import type { StockUnit } from "@/types/inventory";

export type CatalogueUnit = "GRAM" | "ML" | "PIECE";

export interface CatalogueLine {
  /** Ingredient name, French, singular. */
  readonly ingredient: string;
  readonly quantity: number;
  readonly unit: CatalogueUnit;
}

export interface CatalogueRecipe {
  readonly key: string;
  readonly name: string;
  /** Other ways a menu may name the dish. */
  readonly aliases: readonly string[];
  readonly portions: number;
  readonly lines: readonly CatalogueLine[];
}

const g = (ingredient: string, quantity: number): CatalogueLine => ({ ingredient, quantity, unit: "GRAM" });
const ml = (ingredient: string, quantity: number): CatalogueLine => ({ ingredient, quantity, unit: "ML" });
const pc = (ingredient: string, quantity: number): CatalogueLine => ({ ingredient, quantity, unit: "PIECE" });

export const CATALOGUE: readonly CatalogueRecipe[] = [
  // ---- cuisine d'Afrique de l'Ouest (plats déjà à la carte)
  { key: "riz-au-gras", name: "Riz au gras", aliases: ["riz gras", "riz au gras poulet", "jollof"], portions: 10,
    lines: [g("riz", 1500), g("tomate", 1200), g("oignon", 500), ml("huile", 250), g("poulet", 2000), g("concentre de tomate", 140), g("piment", 30)] },
  { key: "poulet-dg", name: "Poulet DG", aliases: ["poulet directeur general"], portions: 4,
    lines: [g("poulet", 1200), pc("plantain", 4), g("carotte", 200), g("haricot vert", 200), g("tomate", 300), g("oignon", 150), ml("huile", 150)] },
  { key: "amiwo", name: "Amiwo au poulet", aliases: ["amiwo", "pate rouge"], portions: 6,
    lines: [g("farine de mais", 750), g("tomate", 600), g("oignon", 250), ml("huile", 150), g("poulet", 1200)] },
  { key: "atassi", name: "Atassi haricot-riz", aliases: ["atassi", "watche", "riz haricot"], portions: 8,
    lines: [g("riz", 800), g("haricot", 600), ml("huile", 100), g("oignon", 200)] },
  { key: "igname-pilee-arachide", name: "Igname pilée sauce arachide", aliases: ["igname pilee", "foutou", "sauce arachide"], portions: 6,
    lines: [g("igname", 2400), g("arachide", 400), g("tomate", 400), g("oignon", 200), g("poulet", 900)] },
  { key: "poisson-braise", name: "Poisson braisé", aliases: ["poisson grille", "poisson braise"], portions: 1,
    lines: [g("poisson", 450), g("oignon", 50), g("tomate", 80), ml("huile", 15), g("piment", 5)] },
  { key: "attieke", name: "Attiéké", aliases: ["attieke poisson"], portions: 1, lines: [g("attieke", 250), g("oignon", 20), ml("huile", 10)] },
  { key: "aloco", name: "Alloco", aliases: ["aloco", "plantain frit", "plantains frits"], portions: 1, lines: [pc("plantain", 1.5), ml("huile", 40)] },
  { key: "soupe-arachide", name: "Soupe d'arachide", aliases: ["soupe arachide"], portions: 6, lines: [g("arachide", 300), g("tomate", 300), g("oignon", 150), g("poulet", 500)] },
  { key: "beignets-crevettes", name: "Beignets de crevettes", aliases: ["beignet crevette"], portions: 4, lines: [g("crevette", 400), g("farine", 150), pc("oeuf", 1), ml("huile", 200)] },
  { key: "salade-avocat", name: "Salade d'avocat", aliases: ["avocat"], portions: 1, lines: [pc("avocat", 1), g("tomate", 60), g("oignon", 15)] },
  { key: "frites-patate-douce", name: "Frites de patate douce", aliases: ["patate douce frite"], portions: 1, lines: [g("patate douce", 250), ml("huile", 40)] },
  { key: "jus-bissap", name: "Jus de bissap", aliases: ["bissap"], portions: 10, lines: [g("fleur d'hibiscus", 100), g("sucre", 400), ml("eau", 3000)] },
  { key: "jus-gingembre", name: "Jus de gingembre", aliases: ["gingembre"], portions: 10, lines: [g("gingembre", 300), g("sucre", 400), pc("citron", 2), ml("eau", 3000)] },
  { key: "degue", name: "Dégué", aliases: ["degue"], portions: 6, lines: [g("mil", 400), g("yaourt", 1000), g("sucre", 150)] },
  { key: "salade-fruits", name: "Salade de fruits", aliases: ["fruits frais"], portions: 4, lines: [pc("ananas", 0.5), pc("mangue", 1), pc("banane", 2), pc("orange", 2)] },
  { key: "ananas", name: "Ananas frais", aliases: ["ananas"], portions: 6, lines: [pc("ananas", 1)] },
  // ---- classiques de la restauration française
  { key: "steak-frites", name: "Steak frites", aliases: ["entrecote frites", "bavette frites", "steak"], portions: 1,
    lines: [g("boeuf", 220), g("pomme de terre", 300), ml("huile", 30), g("beurre", 10), g("salade", 30)] },
  { key: "boeuf-bourguignon", name: "Bœuf bourguignon", aliases: ["bourguignon"], portions: 8,
    lines: [g("boeuf", 1800), ml("vin rouge", 750), g("lardon", 200), g("carotte", 400), g("oignon", 300), g("champignon", 300), g("beurre", 60)] },
  { key: "blanquette", name: "Blanquette de veau", aliases: ["blanquette"], portions: 8,
    lines: [g("veau", 1800), g("carotte", 400), g("oignon", 200), g("champignon", 300), ml("creme", 300), pc("oeuf", 2), g("riz", 600)] },
  { key: "poulet-roti", name: "Poulet rôti", aliases: ["poulet roti", "poulet fermier"], portions: 4,
    lines: [g("poulet", 1600), g("pomme de terre", 1000), g("beurre", 60)] },
  { key: "magret", name: "Magret de canard", aliases: ["magret"], portions: 1, lines: [g("magret de canard", 350), g("pomme de terre", 250), g("miel", 15)] },
  { key: "confit-canard", name: "Confit de canard", aliases: ["cuisse de canard confite"], portions: 1, lines: [g("cuisse de canard", 300), g("pomme de terre", 250), g("graisse de canard", 20)] },
  { key: "croque-monsieur", name: "Croque-monsieur", aliases: ["croque monsieur", "croque madame"], portions: 1,
    lines: [g("pain de mie", 90), g("jambon", 50), g("fromage rape", 40), g("beurre", 10), ml("bechamel", 40)] },
  { key: "quiche-lorraine", name: "Quiche lorraine", aliases: ["quiche"], portions: 8,
    lines: [g("pate brisee", 250), g("lardon", 200), pc("oeuf", 4), ml("creme", 400), ml("lait", 200)] },
  { key: "salade-cesar", name: "Salade César", aliases: ["cesar"], portions: 1,
    lines: [g("salade", 120), g("poulet", 120), g("pain", 30), g("parmesan", 20), ml("sauce cesar", 40)] },
  { key: "salade-nicoise", name: "Salade niçoise", aliases: ["nicoise"], portions: 1,
    lines: [g("salade", 80), g("tomate", 100), g("thon", 80), pc("oeuf", 1), g("haricot vert", 60), g("olive", 20), g("anchois", 10)] },
  { key: "moules-frites", name: "Moules frites", aliases: ["moules marinieres", "moules"], portions: 1,
    lines: [g("moule", 700), ml("vin blanc", 60), g("echalote", 20), g("pomme de terre", 300), ml("huile", 30)] },
  { key: "burger", name: "Burger maison", aliases: ["burger", "hamburger", "cheeseburger"], portions: 1,
    lines: [pc("pain burger", 1), g("boeuf hache", 150), g("cheddar", 30), g("tomate", 30), g("salade", 15), g("pomme de terre", 250), ml("huile", 30)] },
  { key: "tartare", name: "Tartare de bœuf", aliases: ["tartare"], portions: 1,
    lines: [g("boeuf", 180), pc("oeuf", 1), g("echalote", 15), g("capre", 10), g("pomme de terre", 250), ml("huile", 30)] },
  { key: "soupe-oignon", name: "Soupe à l'oignon", aliases: ["gratinee", "soupe oignon"], portions: 6,
    lines: [g("oignon", 1000), g("beurre", 60), ml("bouillon", 1500), g("pain", 180), g("fromage rape", 180)] },
  { key: "omelette", name: "Omelette", aliases: ["omelette nature", "omelette fromage"], portions: 1, lines: [pc("oeuf", 3), g("beurre", 10), g("salade", 40)] },
  { key: "ratatouille", name: "Ratatouille", aliases: [], portions: 8,
    lines: [g("courgette", 800), g("aubergine", 700), g("poivron", 500), g("tomate", 800), g("oignon", 300), ml("huile d'olive", 100)] },
  { key: "cassoulet", name: "Cassoulet", aliases: [], portions: 8,
    lines: [g("haricot blanc", 1000), g("saucisse de toulouse", 800), g("cuisse de canard", 1200), g("poitrine de porc", 400), g("tomate", 300)] },
  { key: "creme-brulee", name: "Crème brûlée", aliases: ["creme brulee"], portions: 6, lines: [ml("creme", 500), pc("oeuf", 6), g("sucre", 120), g("vanille", 2)] },
  { key: "mousse-chocolat", name: "Mousse au chocolat", aliases: ["mousse chocolat"], portions: 6, lines: [g("chocolat noir", 200), pc("oeuf", 6), g("sucre", 40)] },
  { key: "tarte-tatin", name: "Tarte Tatin", aliases: ["tatin"], portions: 8, lines: [g("pomme", 1200), g("pate feuilletee", 250), g("sucre", 150), g("beurre", 80)] },
  { key: "creme-caramel", name: "Crème caramel", aliases: ["flan"], portions: 6, lines: [ml("lait", 500), pc("oeuf", 4), g("sucre", 150)] },
  { key: "cafe", name: "Café expresso", aliases: ["cafe", "expresso", "espresso"], portions: 1, lines: [g("cafe", 7), g("sucre", 5)] },
  { key: "cafe-creme", name: "Café crème", aliases: ["cappuccino", "cafe au lait"], portions: 1, lines: [g("cafe", 7), ml("lait", 120), g("sucre", 5)] },
  { key: "biere-pression", name: "Bière pression", aliases: ["demi", "pinte"], portions: 1, lines: [ml("biere", 250)] },
  { key: "biere-bouteille", name: "Bière bouteille", aliases: ["biere locale", "biere"], portions: 1, lines: [pc("biere", 1)] },
  { key: "eau-minerale", name: "Eau minérale", aliases: ["eau minerale", "eau plate", "eau gazeuse"], portions: 1, lines: [pc("eau minerale", 1)] },
  { key: "verre-vin", name: "Verre de vin", aliases: ["vin rouge", "vin blanc", "verre de vin"], portions: 1, lines: [ml("vin", 125)] },
];

/** Ingredient synonyms, French ⇄ English, so an English stock list still matches. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  tomate: ["tomato", "tomatoes"],
  oignon: ["onion", "onions"],
  poulet: ["chicken"],
  poisson: ["fish", "poisson frais"],
  riz: ["rice"],
  huile: ["oil", "cooking oil", "huile vegetale", "huile d'arachide"],
  boeuf: ["beef"],
  biere: ["beer", "biere locale"],
  "eau minerale": ["water", "mineral water"],
  sucre: ["sugar"],
  lait: ["milk"],
  oeuf: ["egg", "eggs"],
  beurre: ["butter"],
  farine: ["flour"],
  plantain: ["plantains", "banane plantain"],
  arachide: ["peanut", "cacahuete"],
};

export const normaliseName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Singular form for comparisons: "tomates" → "tomate". */
const stem = (word: string): string => (word.length > 3 ? word.replace(/[sx]$/, "") : word);

const tokens = (value: string): string[] =>
  normaliseName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !["au", "aux", "de", "du", "des", "la", "le", "les", "a", "et", "maison", "sauce"].includes(t))
    .map(stem);

const overlap = (a: readonly string[], b: readonly string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(b);
  const hits = a.filter((t) => set.has(t)).length;
  return hits / Math.max(a.length, b.length);
};

/** The catalogue card best matching a dish name, or null below a safe score. */
export const findCatalogueRecipe = (dishName: string): CatalogueRecipe | null => {
  const dish = tokens(dishName);
  const dishText = normaliseName(dishName);
  let best: { recipe: CatalogueRecipe; score: number } | null = null;
  for (const recipe of CATALOGUE) {
    for (const candidate of [recipe.name, ...recipe.aliases]) {
      const normal = normaliseName(candidate);
      // A catalogue name contained whole in the dish name is a strong match.
      const contained = normal.length > 3 && (dishText.includes(normal) || normal.includes(dishText));
      const score = contained ? 1 : overlap(dish, tokens(candidate));
      if (!best || score > best.score) best = { recipe, score };
    }
  }
  return best && best.score >= 0.5 ? best.recipe : null;
};

export interface StockCandidate {
  readonly id: string;
  readonly name: string;
  readonly unit: StockUnit;
}

/** The stock item standing for a catalogue ingredient, by name or synonym. */
export const matchIngredient = <T extends StockCandidate>(ingredient: string, stock: readonly T[]): T | null => {
  const base = normaliseName(ingredient);
  // The French name outranks its synonyms, so "Tomates" wins over "Tomatoes".
  const names = [base, ...(SYNONYMS[base] ?? [])].map((n, i) => ({ text: tokens(n).join(" "), weight: i === 0 ? 1 : 0.95 }));
  let best: { item: T; score: number } | null = null;
  for (const item of stock) {
    const itemName = tokens(item.name).join(" ");
    for (const name of names) {
      const raw =
        itemName === name.text
          ? 1
          : itemName.startsWith(`${name.text} `) || name.text.startsWith(`${itemName} `)
            ? 0.8
            : overlap(tokens(name.text), tokens(itemName));
      const score = raw * name.weight;
      if (!best || score > best.score) best = { item, score };
    }
  }
  return best && best.score >= 0.5 ? best.item : null;
};

const TO_BASE: Readonly<Partial<Record<StockUnit, { base: CatalogueUnit; factor: number }>>> = {
  GRAM: { base: "GRAM", factor: 1 },
  KG: { base: "GRAM", factor: 1000 },
  ML: { base: "ML", factor: 1 },
  LITRE: { base: "ML", factor: 1000 },
  PIECE: { base: "PIECE", factor: 1 },
  BOTTLE: { base: "PIECE", factor: 1 },
  PACK: { base: "PIECE", factor: 1 },
  DOZEN: { base: "PIECE", factor: 12 },
};

/** Catalogue quantity expressed in the stock item's unit, or null if incompatible. */
export const convertQuantity = (quantity: number, from: CatalogueUnit, to: StockUnit): number | null => {
  const target = TO_BASE[to];
  if (!target || target.base !== from) return null;
  return Math.round((quantity / target.factor) * 1000) / 1000;
};

export interface ProposedLine {
  readonly ingredient: string;
  readonly catalogueQuantity: number;
  readonly catalogueUnit: CatalogueUnit;
  /** Matching stock item, or null when the restaurant does not stock it yet. */
  readonly stockItemId: string | null;
  readonly stockItemName: string | null;
  /** In the stock item's unit; null when unmatched or units differ. */
  readonly quantity: number | null;
}

export const proposeRecipe = (
  dishName: string,
  stock: readonly StockCandidate[],
): { recipe: CatalogueRecipe; lines: ProposedLine[] } | null => {
  const recipe = findCatalogueRecipe(dishName);
  if (!recipe) return null;
  return {
    recipe,
    lines: recipe.lines.map((line) => {
      const item = matchIngredient(line.ingredient, stock);
      return {
        ingredient: line.ingredient,
        catalogueQuantity: line.quantity,
        catalogueUnit: line.unit,
        stockItemId: item?.id ?? null,
        stockItemName: item?.name ?? null,
        quantity: item ? convertQuantity(line.quantity, line.unit, item.unit) : null,
      };
    }),
  };
};
