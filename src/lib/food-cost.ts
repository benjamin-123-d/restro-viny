/**
 * Food cost: what a dish costs in ingredients, and where the difference
 * between what sales explain and what was actually consumed goes.
 *
 * Pure — no IO — so every figure of the module is tested. Unit costs keep six
 * decimals (a gram of tomato is a fraction of a cent); amounts are rounded to
 * the cent only when they are totals.
 *
 * The recipe cost follows the specification literally:
 *   cost of a card = Σ (gross quantity × net usage cost)
 *   net usage cost = (purchase price ÷ pack size) ÷ yield
 * To keep the variance meaningful on that basis, stock and entries are valued
 * with the same net usage cost.
 */

export type RecipeReliability = "ESTIMATED" | "ADJUSTED" | "VERIFIED";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

// -------------------------------------------------------------- ingredient ---

/** Price of one usage unit before yield: 3,50 € for 8 000 g → 0,0004375 €/g. */
export const grossUnitCost = (purchasePrice: number, purchaseFactor: number): number | null =>
  purchaseFactor > 0 ? purchasePrice / purchaseFactor : null;

/** (price ÷ pack size) ÷ yield. The yield always applies, 100 % included. */
export const netUsageCost = (input: {
  readonly purchasePrice: number | null;
  readonly purchaseFactor: number;
  readonly yieldPercent: number;
}): number | null => {
  if (input.purchasePrice == null || input.yieldPercent <= 0) return null;
  const gross = grossUnitCost(input.purchasePrice, input.purchaseFactor);
  return gross == null ? null : gross / (input.yieldPercent / 100);
};

/** Net cost from a gross unit cost already known (price per usage unit). */
export const netFromGross = (gross: number | null, yieldPercent: number): number | null =>
  gross == null || yieldPercent <= 0 ? null : gross / (yieldPercent / 100);

// ------------------------------------------------------------ recipe card ---

export interface CostedLine {
  /** Gross quantity, in the ingredient's usage unit. */
  readonly quantity: number;
  /** Net usage cost, or null when the ingredient has no price yet. */
  readonly netCost: number | null;
}

export interface RecipeCost {
  readonly total: number;
  readonly perPortion: number;
  readonly complete: boolean;
  readonly unpricedLines: number;
}

export const recipeCost = (lines: readonly CostedLine[], portions: number): RecipeCost => {
  const total = lines.reduce((sum, l) => sum + (l.netCost == null ? 0 : l.quantity * l.netCost), 0);
  const unpricedLines = lines.filter((l) => l.netCost == null).length;
  return {
    total: round6(total),
    perPortion: round6(total / Math.max(1, portions)),
    complete: unpricedLines === 0,
    unpricedLines,
  };
};

/** A preparation's cost per unit: its batch cost over what the batch yields. */
export const preparationUnitCost = (
  lines: readonly CostedLine[],
  preparationYield: number | null,
  yieldPercent: number,
): number | null => {
  if (!preparationYield || preparationYield <= 0) return null;
  const batch = recipeCost(lines, 1).total;
  return netFromGross(batch / preparationYield, yieldPercent);
};

export interface DishEconomics {
  readonly cost: number;
  readonly priceHT: number;
  readonly margin: number;
  /** Material cost as a share of the HT price, or null without a price. */
  readonly ratio: number | null;
}

export const dishEconomics = (portionCost: number, priceHT: number): DishEconomics => ({
  cost: round2(portionCost),
  priceHT: round2(priceHT),
  margin: round2(priceHT - portionCost),
  ratio: priceHT > 0 ? Math.round((portionCost / priceHT) * 1000) / 10 : null,
});

const euro = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n).replace(/ /g, " ");

const percent = (n: number, digits = 0): string =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;

/** « Te coûte 2,40 € · Tu vends 9,09 € HT · Tu gagnes 6,69 € · Ratio 26 % » */
export const dishSentence = (d: DishEconomics): string =>
  [
    `Te coûte ${euro(d.cost)}`,
    `Tu vends ${euro(d.priceHT)} HT`,
    `Tu gagnes ${euro(d.margin)}`,
    ...(d.ratio != null ? [`Ratio ${percent(Math.round(d.ratio))}`] : []),
  ].join(" · ").replace(/ /g, " ");

// ------------------------------------------------------------------ period ---

export interface SoldDish {
  readonly menuItemId: string | null;
  readonly name: string;
  readonly quantity: number;
  readonly revenueHT: number;
  /** Cost of one unit frozen on the sale; null when sold without a card. */
  readonly foodCost: number | null;
}

export const theoreticalConsumption = (sales: readonly SoldDish[]) => {
  const value = sales.reduce((s, d) => s + (d.foodCost == null ? 0 : d.quantity * d.foodCost), 0);
  const revenue = sales.reduce((s, d) => s + d.revenueHT, 0);
  const uncovered = sales.filter((d) => d.foodCost == null).reduce((s, d) => s + d.revenueHT, 0);
  return {
    value: round2(value),
    revenueHT: round2(revenue),
    uncoveredRevenueHT: round2(uncovered),
    uncoveredShare: revenue > 0 ? Math.round((uncovered / revenue) * 1000) / 10 : 0,
  };
};

export interface ValuedQuantity {
  readonly stockItemId: string;
  readonly quantity: number;
  readonly unitCost: number;
}

const valueOf = (rows: readonly ValuedQuantity[]): number =>
  rows.reduce((s, r) => s + r.quantity * r.unitCost, 0);

/** Opening stock + entries − closing stock, all valued. */
export const realConsumption = (input: {
  readonly start: readonly ValuedQuantity[];
  readonly entries: readonly ValuedQuantity[];
  readonly end: readonly ValuedQuantity[];
}) => {
  const startValue = valueOf(input.start);
  const entriesValue = valueOf(input.entries);
  const endValue = valueOf(input.end);
  return {
    startValue: round2(startValue),
    entriesValue: round2(entriesValue),
    endValue: round2(endValue),
    value: round2(startValue + entriesValue - endValue),
  };
};

export interface FoodCostReport {
  readonly revenueHT: number;
  readonly theoretical: number;
  readonly real: number;
  readonly startValue: number;
  readonly entriesValue: number;
  readonly endValue: number;
  /** Real − theoretical: positive means more was consumed than sales explain. */
  readonly variance: number;
  /** Variance as points of HT revenue. */
  readonly variancePoints: number;
  readonly theoreticalRatio: number | null;
  readonly realRatio: number | null;
  readonly lossesValue: number;
  /** Variance left once declared losses are accounted for. */
  readonly unexplained: number;
  readonly uncoveredRevenueHT: number;
  readonly uncoveredShare: number;
}

const share = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

export const foodCostReport = (input: {
  readonly start: readonly ValuedQuantity[];
  readonly entries: readonly ValuedQuantity[];
  readonly end: readonly ValuedQuantity[];
  readonly sales: readonly SoldDish[];
  readonly losses: readonly { readonly value: number }[];
}): FoodCostReport => {
  const theoretical = theoreticalConsumption(input.sales);
  const real = realConsumption(input);
  const variance = round2(real.value - theoretical.value);
  const lossesValue = round2(input.losses.reduce((s, l) => s + l.value, 0));
  return {
    revenueHT: theoretical.revenueHT,
    theoretical: theoretical.value,
    real: real.value,
    startValue: real.startValue,
    entriesValue: real.entriesValue,
    endValue: real.endValue,
    variance,
    variancePoints: share(variance, theoretical.revenueHT) ?? 0,
    theoreticalRatio: share(theoretical.value, theoretical.revenueHT),
    realRatio: share(real.value, theoretical.revenueHT),
    lossesValue,
    unexplained: round2(variance - lossesValue),
    uncoveredRevenueHT: theoretical.uncoveredRevenueHT,
    uncoveredShare: theoretical.uncoveredShare,
  };
};

export interface DishMargin {
  readonly menuItemId: string;
  readonly name: string;
  readonly quantity: number;
  readonly revenueHT: number;
  readonly cost: number;
  readonly margin: number;
  readonly ratio: number | null;
}

/** Dishes that brought in the most gross margin; dishes without a card are left out. */
export const topDishesByMargin = (sales: readonly SoldDish[], limit = 5): DishMargin[] => {
  const byDish = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>();
  for (const sale of sales) {
    if (!sale.menuItemId || sale.foodCost == null) continue;
    const row = byDish.get(sale.menuItemId) ?? { name: sale.name, quantity: 0, revenue: 0, cost: 0 };
    row.quantity += sale.quantity;
    row.revenue += sale.revenueHT;
    row.cost += sale.quantity * sale.foodCost;
    byDish.set(sale.menuItemId, row);
  }
  return [...byDish.entries()]
    .map(([menuItemId, r]) => ({
      menuItemId,
      name: r.name,
      quantity: r.quantity,
      revenueHT: round2(r.revenue),
      cost: round2(r.cost),
      margin: round2(r.revenue - r.cost),
      ratio: share(r.cost, r.revenue),
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, limit);
};

// ---------------------------------------------------------------- wording ---

export const varianceHeadline = (variance: number, points: number): string => {
  const pts = Math.abs(points).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const amount = euro(Math.abs(variance)).replace(/ /g, " ");
  if (Math.abs(variance) < 0.005) {
    return "Tes ventes expliquent toute la matière consommée sur la période.";
  }
  return variance > 0
    ? `Tu as consommé ${amount} de matière de plus que ce que tes ventes expliquent. Soit ${pts} points de marge.`
    : `Tu as consommé ${amount} de matière de moins que ce que tes ventes expliquent. Soit ${pts} points de marge.`;
};

export interface VarianceCause {
  readonly key: "CARDS" | "PORTIONS" | "LOSSES" | "COUNT";
  readonly title: string;
  readonly test: string;
}

/**
 * Where the difference may come from, always in this order and worded as a
 * check to run, never as a fault to pin on anyone.
 */
export const varianceCauses = (input: {
  readonly bestSeller: string | null;
  readonly estimatedCards: number;
  readonly lossesValue: number;
  readonly costliestFamily: string | null;
}): VarianceCause[] => [
  {
    key: "CARDS",
    title: "Fiches sous-évaluées",
    test: `Pesez 3 portions ${input.bestSeller ? `de « ${input.bestSeller} », le plat le plus vendu,` : "du plat le plus vendu"} et comparez à sa fiche.${
      input.estimatedCards > 0
        ? ` ${input.estimatedCards} fiche${input.estimatedCards > 1 ? "s sont encore estimées" : " est encore estimée"}.`
        : ""
    }`,
  },
  {
    key: "PORTIONS",
    title: "Portions servies plus généreuses que la fiche",
    test: "Pendant un service, pesez quelques assiettes et comparez au poids prévu par la fiche.",
  },
  {
    key: "LOSSES",
    title: "Pertes non saisies",
    test: `Vérifiez le relevé de pertes (produits jetés, casse, repas du personnel). Pertes déclarées sur la période : ${euro(input.lossesValue).replace(/ /g, " ")}.`,
  },
  {
    key: "COUNT",
    title: "Erreur d'inventaire",
    test: input.costliestFamily
      ? `Recomptez la famille la plus chère en stock : « ${input.costliestFamily} ».`
      : "Recomptez la famille d'ingrédients la plus chère en stock.",
  },
];
