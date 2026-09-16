/**
 * What is left once the food is paid for. Two different questions, and the
 * screens keep them apart:
 *
 *  - la marge matière: revenue minus the cost of the ingredients actually
 *    sold, taken from the cost frozen on each sale line. It judges the
 *    kitchen, dish by dish.
 *  - le résultat des achats: revenue minus everything bought over the period,
 *    food or not. It judges the activity, but a month of buying rarely matches
 *    a month of selling, so it is only honest over a long enough window.
 *
 * Neither is a net profit: rent, wages, energy and taxes are not here.
 */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const share = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

export interface SoldLine {
  /** Paris calendar day, "YYYY-MM-DD". */
  readonly day: string;
  readonly menuItemId: string | null;
  readonly name: string;
  readonly quantity: number;
  /** Revenue of the line, HT, after discount. */
  readonly revenueHT: number;
  /** Material cost of one unit, frozen at the sale; null without a recipe card. */
  readonly foodCost: number | null;
}

export interface MarginTotals {
  readonly revenueHT: number;
  readonly materialCost: number;
  readonly margin: number;
  /** Material cost as a share of revenue, 0–100. */
  readonly ratio: number | null;
  /** Share of revenue whose cost is known, 0–100 — how much to trust the rest. */
  readonly coverage: number | null;
  /** Revenue sold without a recipe card, so without a known cost. */
  readonly revenueWithoutCost: number;
}

export const marginTotals = (lines: readonly SoldLine[]): MarginTotals => {
  let revenue = 0;
  let cost = 0;
  let known = 0;
  for (const line of lines) {
    revenue += line.revenueHT;
    if (line.foodCost == null) continue;
    cost += line.quantity * line.foodCost;
    known += line.revenueHT;
  }
  return {
    revenueHT: round2(revenue),
    materialCost: round2(cost),
    margin: round2(known - cost),
    ratio: share(cost, known),
    coverage: share(known, revenue),
    revenueWithoutCost: round2(revenue - known),
  };
};

export interface MarginDay {
  readonly day: string;
  readonly revenueHT: number;
  readonly materialCost: number;
  readonly margin: number;
}

/** Day by day, over the days given — missing days are shown as zero. */
export const marginByDay = (lines: readonly SoldLine[], days: readonly string[]): MarginDay[] => {
  const byDay = new Map<string, { revenue: number; cost: number; known: number }>();
  for (const line of lines) {
    const row = byDay.get(line.day) ?? { revenue: 0, cost: 0, known: 0 };
    row.revenue += line.revenueHT;
    if (line.foodCost != null) {
      row.cost += line.quantity * line.foodCost;
      row.known += line.revenueHT;
    }
    byDay.set(line.day, row);
  }
  return days.map((day) => {
    const row = byDay.get(day) ?? { revenue: 0, cost: 0, known: 0 };
    return {
      day,
      revenueHT: round2(row.revenue),
      materialCost: round2(row.cost),
      margin: round2(row.known - row.cost),
    };
  });
};

export interface DishProfit {
  readonly menuItemId: string | null;
  readonly name: string;
  readonly quantity: number;
  readonly revenueHT: number;
  readonly materialCost: number;
  readonly margin: number;
  readonly ratio: number | null;
  readonly hasCost: boolean;
}

/** Every dish sold, best total margin first; dishes without a card come last. */
export const marginByDish = (lines: readonly SoldLine[]): DishProfit[] => {
  const byDish = new Map<string, { name: string; menuItemId: string | null; quantity: number; revenue: number; cost: number; known: boolean }>();
  for (const line of lines) {
    const key = line.menuItemId ?? `libre:${line.name}`;
    const row = byDish.get(key) ?? {
      name: line.name,
      menuItemId: line.menuItemId,
      quantity: 0,
      revenue: 0,
      cost: 0,
      known: false,
    };
    row.quantity += line.quantity;
    row.revenue += line.revenueHT;
    if (line.foodCost != null) {
      row.cost += line.quantity * line.foodCost;
      row.known = true;
    }
    byDish.set(key, row);
  }
  return [...byDish.values()]
    .map((r) => ({
      menuItemId: r.menuItemId,
      name: r.name,
      quantity: r.quantity,
      revenueHT: round2(r.revenue),
      materialCost: round2(r.cost),
      margin: r.known ? round2(r.revenue - r.cost) : 0,
      ratio: r.known ? share(r.cost, r.revenue) : null,
      hasCost: r.known,
    }))
    .sort((a, b) => Number(b.hasCost) - Number(a.hasCost) || b.margin - a.margin);
};

export interface PurchaseResult {
  readonly revenueHT: number;
  readonly purchasesHT: number;
  readonly foodPurchasesHT: number;
  readonly otherPurchasesHT: number;
  readonly result: number;
  /** Purchases as a share of revenue, 0–100. */
  readonly ratio: number | null;
}

/** Revenue against everything bought over the same period. */
export const purchaseResult = (revenueHT: number, foodPurchasesHT: number, otherPurchasesHT: number): PurchaseResult => {
  const purchases = round2(foodPurchasesHT + otherPurchasesHT);
  return {
    revenueHT: round2(revenueHT),
    purchasesHT: purchases,
    foodPurchasesHT: round2(foodPurchasesHT),
    otherPurchasesHT: round2(otherPurchasesHT),
    result: round2(revenueHT - purchases),
    ratio: share(purchases, revenueHT),
  };
};

/**
 * One plain sentence for the hero figure, so the number is never alone:
 * « Tu as vendu 4 200 € HT, la matière t'a coûté 1 300 €, il te reste 2 900 € (ratio 31 %) ».
 */
export const marginSentence = (totals: MarginTotals, euro: (n: number) => string): string => {
  if (totals.revenueHT <= 0) return "Aucune vente sur la période.";
  if (totals.coverage === 0 || totals.materialCost === 0) {
    return `Tu as vendu ${euro(totals.revenueHT)} HT. Aucun plat vendu n'a de fiche technique : la marge ne peut pas encore être calculée.`;
  }
  return `Tu as vendu ${euro(totals.revenueHT)} HT · la matière t'a coûté ${euro(totals.materialCost)} · il te reste ${euro(totals.margin)}${
    totals.ratio != null ? ` · ratio matière ${totals.ratio.toLocaleString("fr-FR")} %` : ""
  }`;
};
