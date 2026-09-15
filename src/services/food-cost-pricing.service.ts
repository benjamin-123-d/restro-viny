import { netFromGross, preparationUnitCost, recipeCost } from "@/lib/food-cost";
import {
  findCardsForMenuItems,
  findIngredients,
  type IngredientRow,
} from "@/repositories/food-cost.repository";

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export type CostBook = (stockItemId: string) => number | null;

/**
 * Net usage cost of every ingredient. A preparation costs its recipe over what
 * the recipe yields; it has no cost while any of its ingredients is unpriced.
 */
export const buildCostBook = (rows: readonly IngredientRow[]): CostBook => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const memo = new Map<string, number | null>();

  const cost = (id: string, depth: number): number | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    const row = byId.get(id);
    if (!row || depth > 5) return null;
    let value: number | null;
    if (row.isPreparation) {
      const lines = row.preparationLines.map((l) => ({
        quantity: num(l.quantity),
        netCost: l.stockItemId === id ? null : cost(l.stockItemId, depth + 1),
      }));
      value =
        lines.length === 0 || lines.some((l) => l.netCost == null)
          ? null
          : preparationUnitCost(lines, numOrNull(row.preparationYield), num(row.yieldPercent));
    } else {
      value = netFromGross(numOrNull(row.costPerUnit), num(row.yieldPercent));
    }
    memo.set(id, value);
    return value;
  };

  return (id) => cost(id, 0);
};

export const loadCostBook = async (restaurantId: string): Promise<CostBook> =>
  buildCostBook(await findIngredients(restaurantId));

/**
 * Material cost of one portion of each dish, to freeze on the sale. Null for a
 * dish without a card, or whose card has an unpriced ingredient: an incomplete
 * cost would understate the theoretical consumption.
 */
export const getPortionCosts = async (
  restaurantId: string,
  menuItemIds: readonly string[],
): Promise<Map<string, number | null>> => {
  const result = new Map<string, number | null>();
  if (menuItemIds.length === 0) return result;
  const dishes = (await findCardsForMenuItems([...new Set(menuItemIds)])).filter(
    (d) => d.restaurantId === restaurantId,
  );
  if (!dishes.some((d) => d.recipe.length > 0)) return result;

  const costOf = await loadCostBook(restaurantId);
  for (const dish of dishes) {
    if (dish.recipe.length === 0) {
      result.set(dish.id, null);
      continue;
    }
    const cost = recipeCost(
      dish.recipe.map((l) => ({ quantity: num(l.quantity), netCost: costOf(l.stockItemId) })),
      dish.recipeCard?.portions ?? 1,
    );
    result.set(dish.id, cost.complete ? cost.perPortion : null);
  }
  return result;
};
