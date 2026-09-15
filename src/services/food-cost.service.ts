import {
  dishEconomics,
  dishSentence,
  foodCostReport,
  grossUnitCost,
  netFromGross,
  recipeCost,
  topDishesByMargin,
  varianceCauses,
  varianceHeadline,
  type SoldDish,
} from "@/lib/food-cost";
import { proposeRecipe } from "@/lib/recipe-catalogue";
import type {
  ApplyProposalInput,
  RecordLossInput,
  RecordProductionInput,
  RecordPurchaseInput,
  SaveIngredientInput,
  SaveInventoryInput,
  SavePreparationInput,
  SaveRecipeCardInput,
} from "@/lib/validators/food-cost";
import {
  applyMovementsWith,
  createFoodInventory,
  createIngredient,
  deleteDraftFoodInventory,
  findDraftInventory,
  findEntriesBetween,
  findFoodCostSettings,
  findFoodInventories,
  findFoodInventoryById,
  findFoodLosses,
  findFoodProductions,
  findIngredientByName,
  findIngredientPurchases,
  findIngredients,
  findLossesBetween,
  findMenuForCards,
  findMenuItemOwner,
  findOrdersPlacedBetween,
  markRecipeCardVerified,
  recordIngredientPurchase,
  replacePreparationLines,
  saveInventoryCounts,
  saveRecipeCard,
  setFoodCostSubRecipes,
  sumPurchasesPaid,
  updateIngredient,
  validateFoodInventory,
  type IngredientRow,
  type MenuCardRow,
} from "@/repositories/food-cost.repository";
import type { MovementInput } from "@/repositories/stock.repository";
import { computeBill } from "@/services/billing";
import { buildCostBook, type CostBook } from "@/services/food-cost-pricing.service";
import { getMenu } from "@/services/menu-item.service";
import { orderToBillLines } from "@/services/order.service";
import type { StockUnit } from "@/types/inventory";
import type {
  CatalogueProposalDTO,
  FoodCostOverviewDTO,
  FoodInventoryDTO,
  FoodInventoryListItemDTO,
  FoodLossDTO,
  FoodProductionDTO,
  IngredientDTO,
  IngredientPurchaseDTO,
  PreparationDTO,
  RecipeCardDTO,
  RecipeLineDTO,
} from "@/types/food-cost";

export const FOOD_INGREDIENT_NOT_FOUND = "FOOD_INGREDIENT_NOT_FOUND";
export const FOOD_INGREDIENT_NAME_TAKEN = "FOOD_INGREDIENT_NAME_TAKEN";
export const FOOD_DISH_NOT_FOUND = "FOOD_DISH_NOT_FOUND";
export const FOOD_NO_CATALOGUE_MATCH = "FOOD_NO_CATALOGUE_MATCH";
export const FOOD_INVENTORY_NOT_FOUND = "FOOD_INVENTORY_NOT_FOUND";
export const FOOD_INVENTORY_NOT_DRAFT = "FOOD_INVENTORY_NOT_DRAFT";
export const FOOD_PREPARATION_INVALID = "FOOD_PREPARATION_INVALID";
export const FOOD_NO_COST = "FOOD_NO_COST";

export interface FoodCostContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

const CATALOGUE_UNIT_TO_STOCK: Readonly<Record<"GRAM" | "ML" | "PIECE", StockUnit>> = {
  GRAM: "GRAM",
  ML: "ML",
  PIECE: "PIECE",
};

// -------------------------------------------------------------- settings ---

export const getSubRecipesEnabled = async (restaurantId: string): Promise<boolean> =>
  Boolean((await findFoodCostSettings(restaurantId))?.foodCostSubRecipes);

export const setSubRecipesEnabled = async (ctx: FoodCostContext, enabled: boolean): Promise<boolean> =>
  (await setFoodCostSubRecipes(ctx.restaurantId, enabled)).foodCostSubRecipes;

// ----------------------------------------------------------- ingredients ---

const toIngredientDTO = (row: IngredientRow, costOf: CostBook): IngredientDTO => {
  const net = costOf(row.id);
  const factor = num(row.purchaseFactor) || 1;
  const price = numOrNull(row.lastPurchasePrice);
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    category: row.category,
    onHand: num(row.onHand),
    purchaseUnit: row.purchaseUnit,
    purchaseFactor: factor,
    lastPurchasePrice: price,
    yieldPercent: num(row.yieldPercent),
    grossUnitCost: numOrNull(row.costPerUnit),
    netUnitCost: net == null ? null : round6(net),
    stockValue: net == null ? null : round2(Math.max(0, num(row.onHand)) * net),
    storageLocation: row.storageLocation,
    storageOrder: row.storageOrder,
    isPreparation: row.isPreparation,
    preparationYield: numOrNull(row.preparationYield),
    isActive: row.isActive,
  };
};

export const listIngredients = async (ctx: FoodCostContext): Promise<IngredientDTO[]> => {
  const rows = await findIngredients(ctx.restaurantId);
  const costOf = buildCostBook(rows);
  return rows.map((r) => toIngredientDTO(r, costOf));
};

const ownedIngredients = async (restaurantId: string) => {
  const rows = await findIngredients(restaurantId);
  return { rows, byId: new Map(rows.map((r) => [r.id, r])), costOf: buildCostBook(rows) };
};

/**
 * Create or update an ingredient. The price entered is for one purchase unit;
 * the gross price of a usage unit follows from the pack size.
 */
export const saveIngredient = async (ctx: FoodCostContext, input: SaveIngredientInput): Promise<{ id: string }> => {
  const { byId } = await ownedIngredients(ctx.restaurantId);
  const existing = input.id ? byId.get(input.id) : undefined;
  if (input.id && !existing) throw new Error(FOOD_INGREDIENT_NOT_FOUND);

  const clash = await findIngredientByName(ctx.restaurantId, input.name);
  if (clash && clash.id !== input.id && !clash.deletedAt) throw new Error(FOOD_INGREDIENT_NAME_TAKEN);

  const price = input.lastPurchasePrice ?? null;
  const data = {
    name: input.name,
    unit: input.unit,
    category: input.category ?? null,
    purchaseUnit: input.purchaseUnit ?? null,
    purchaseFactor: input.purchaseFactor,
    lastPurchasePrice: price,
    costPerUnit:
      price != null ? grossUnitCost(price, input.purchaseFactor) : existing ? numOrNull(existing.costPerUnit) : null,
    yieldPercent: input.yieldPercent,
    storageLocation: input.storageLocation ?? null,
    storageOrder: input.storageOrder,
    isPreparation: existing?.isPreparation ?? false,
    preparationYield: existing ? numOrNull(existing.preparationYield) : null,
  };
  return existing ? updateIngredient(existing.id, data) : createIngredient(ctx.restaurantId, data);
};

// --------------------------------------------------------- recipe cards ---

const linesOf = (
  lines: readonly { stockItemId: string; quantity: unknown }[],
  byId: ReadonlyMap<string, IngredientRow>,
  costOf: CostBook,
): RecipeLineDTO[] =>
  lines.map((l) => {
    const item = byId.get(l.stockItemId);
    const net = costOf(l.stockItemId);
    const quantity = num(l.quantity);
    return {
      stockItemId: l.stockItemId,
      name: item?.name ?? "Ingrédient supprimé",
      unit: (item?.unit ?? "PIECE") as StockUnit,
      quantity,
      netUnitCost: net == null ? null : round6(net),
      lineCost: net == null ? null : round6(quantity * net),
      isPreparation: item?.isPreparation ?? false,
    };
  });

const toCardDTO = (
  dish: MenuCardRow,
  priceHT: number,
  byId: ReadonlyMap<string, IngredientRow>,
  costOf: CostBook,
): RecipeCardDTO => {
  const lines = linesOf(dish.recipe, byId, costOf);
  const portions = dish.recipeCard?.portions ?? 1;
  const cost = recipeCost(
    lines.map((l) => ({ quantity: l.quantity, netCost: l.netUnitCost })),
    portions,
  );
  const economics = dishEconomics(cost.perPortion, priceHT);
  return {
    menuItemId: dish.id,
    menuItemName: dish.name,
    categoryName: dish.category.name,
    priceTTC: num(dish.price),
    priceHT: round2(priceHT),
    hasCard: lines.length > 0,
    portions,
    // Lines typed before the module existed were entered by the owner.
    reliability: dish.recipeCard?.reliability ?? (lines.length > 0 ? "ADJUSTED" : "ESTIMATED"),
    verifiedAt: dish.recipeCard?.verifiedAt?.toISOString() ?? null,
    source: dish.recipeCard?.source ?? "MANUAL",
    notes: dish.recipeCard?.notes ?? null,
    lines,
    totalCost: cost.total,
    portionCost: cost.perPortion,
    complete: cost.complete,
    unpricedLines: cost.unpricedLines,
    economics,
    sentence: dishSentence(economics),
  };
};

/** HT price of every dish, from its TTC price and dine-in VAT rate. */
const pricesHT = async (restaurantId: string): Promise<Map<string, number>> => {
  const menu = await getMenu(restaurantId);
  return new Map(
    menu.items.map((item) => {
      const rate = item.tax.ratesByService?.DINE_IN ?? item.tax.rate;
      const ht = item.tax.inclusive && rate > 0 ? item.price / (1 + rate / 100) : item.price;
      return [item.id, ht];
    }),
  );
};

export const listRecipeCards = async (ctx: FoodCostContext): Promise<RecipeCardDTO[]> => {
  const [dishes, prices, { byId, costOf }] = await Promise.all([
    findMenuForCards(ctx.restaurantId),
    pricesHT(ctx.restaurantId),
    ownedIngredients(ctx.restaurantId),
  ]);
  return dishes.map((d) => toCardDTO(d, prices.get(d.id) ?? num(d.price), byId, costOf));
};

export const getRecipeCard = async (ctx: FoodCostContext, menuItemId: string): Promise<RecipeCardDTO> => {
  const card = (await listRecipeCards(ctx)).find((c) => c.menuItemId === menuItemId);
  if (!card) throw new Error(FOOD_DISH_NOT_FOUND);
  return card;
};

const assertDishOwned = async (restaurantId: string, menuItemId: string) => {
  const dish = await findMenuItemOwner(menuItemId);
  if (!dish || dish.restaurantId !== restaurantId) throw new Error(FOOD_DISH_NOT_FOUND);
  return dish;
};

const assertLinesOwned = (lines: readonly { stockItemId: string }[], byId: ReadonlyMap<string, IngredientRow>) => {
  for (const line of lines) {
    if (!byId.has(line.stockItemId)) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
  }
};

/** Save a card the owner composed or corrected: it becomes « Ajustée ». */
export const saveOwnRecipeCard = async (ctx: FoodCostContext, input: SaveRecipeCardInput): Promise<void> => {
  await assertDishOwned(ctx.restaurantId, input.menuItemId);
  const { byId } = await ownedIngredients(ctx.restaurantId);
  assertLinesOwned(input.lines, byId);
  await saveRecipeCard(
    input.menuItemId,
    { portions: input.portions, reliability: "ADJUSTED", source: "MANUAL", notes: input.notes ?? null },
    mergeLines(input.lines),
  );
};

const mergeLines = (lines: readonly { stockItemId: string; quantity: number }[]) => {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.stockItemId, round3((merged.get(l.stockItemId) ?? 0) + l.quantity));
  return [...merged.entries()].map(([stockItemId, quantity]) => ({ stockItemId, quantity }));
};

/** Weighed at least once: the card becomes « Vérifiée ». */
export const verifyRecipeCard = async (ctx: FoodCostContext, menuItemId: string): Promise<void> => {
  await assertDishOwned(ctx.restaurantId, menuItemId);
  await markRecipeCardVerified(menuItemId, new Date());
};

export const proposeRecipeCard = async (ctx: FoodCostContext, menuItemId: string): Promise<CatalogueProposalDTO> => {
  const dish = await assertDishOwned(ctx.restaurantId, menuItemId);
  const { rows } = await ownedIngredients(ctx.restaurantId);
  const proposal = proposeRecipe(
    dish.name,
    rows.filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name, unit: r.unit })),
  );
  if (!proposal) throw new Error(FOOD_NO_CATALOGUE_MATCH);
  return { recipeName: proposal.recipe.name, portions: proposal.recipe.portions, lines: proposal.lines };
};

/**
 * Take a catalogue proposal: missing ingredients are created (without a price
 * yet) and the card is saved as « Estimée », whatever was matched.
 */
export const applyRecipeProposal = async (ctx: FoodCostContext, input: ApplyProposalInput): Promise<void> => {
  await assertDishOwned(ctx.restaurantId, input.menuItemId);
  const { byId, rows } = await ownedIngredients(ctx.restaurantId);
  const lines: { stockItemId: string; quantity: number }[] = [];

  for (const line of input.lines) {
    if (line.stockItemId) {
      if (!byId.has(line.stockItemId)) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
      lines.push({ stockItemId: line.stockItemId, quantity: line.quantity ?? line.catalogueQuantity });
      continue;
    }
    const name = line.ingredient.charAt(0).toUpperCase() + line.ingredient.slice(1);
    const existing = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    const id =
      existing?.id ??
      (
        await createIngredient(ctx.restaurantId, {
          name,
          unit: CATALOGUE_UNIT_TO_STOCK[line.catalogueUnit],
          category: null,
          purchaseUnit: null,
          purchaseFactor: 1,
          lastPurchasePrice: null,
          costPerUnit: null,
          yieldPercent: 100,
          storageLocation: null,
          storageOrder: 0,
          isPreparation: false,
          preparationYield: null,
        })
      ).id;
    lines.push({ stockItemId: id, quantity: existing ? (line.quantity ?? line.catalogueQuantity) : line.catalogueQuantity });
  }

  await saveRecipeCard(
    input.menuItemId,
    { portions: input.portions, reliability: "ESTIMATED", source: "CATALOGUE", notes: null, verifiedAt: null },
    mergeLines(lines),
  );
};

// ------------------------------------------------------------ purchases ---

/** « 2 paniers pour 7 € » : stock + 16 000 g, price of a basket 3,50 €. */
export const recordPurchase = async (ctx: FoodCostContext, input: RecordPurchaseInput): Promise<{ id: string }> => {
  const { byId } = await ownedIngredients(ctx.restaurantId);
  const item = byId.get(input.stockItemId);
  if (!item || item.isPreparation) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
  const factor = num(item.purchaseFactor) || 1;
  const purchasePrice = round2(input.amount / input.quantity);
  const gross = input.amount / input.quantity / factor;
  return recordIngredientPurchase({
    restaurantId: ctx.restaurantId,
    stockItemId: item.id,
    purchasedAt: input.purchasedAt ?? new Date(),
    quantity: input.quantity,
    amount: input.amount,
    usageQuantity: round3(input.quantity * factor),
    purchasePrice,
    grossUnitCost: round6(gross),
    netUnitCost: round6(netFromGross(gross, num(item.yieldPercent)) ?? gross),
    note: input.note ?? null,
    createdById: ctx.userId,
  });
};

export const listPurchases = async (ctx: FoodCostContext): Promise<IngredientPurchaseDTO[]> =>
  (await findIngredientPurchases(ctx.restaurantId)).map((p) => ({
    id: p.id,
    purchasedAt: p.purchasedAt.toISOString(),
    stockItemId: p.stockItemId,
    ingredientName: p.stockItem.name,
    quantity: num(p.quantity),
    purchaseUnit: p.stockItem.purchaseUnit,
    amount: num(p.amount),
    usageQuantity: num(p.usageQuantity),
    unit: p.stockItem.unit,
    note: p.note,
  }));

// ----------------------------------------------------------- inventories ---

const inventoryListItem = (inv: Awaited<ReturnType<typeof findFoodInventories>>[number]): FoodInventoryListItemDTO => ({
  id: inv.id,
  countedAt: inv.countedAt.toISOString(),
  status: inv.status,
  validatedAt: inv.validatedAt?.toISOString() ?? null,
  lineCount: inv.lines.length,
  countedLines: inv.lines.filter((l) => l.countedQty != null).length,
  stockValue: round2(inv.lines.reduce((s, l) => s + num(l.countedQty ?? l.theoreticalQty) * num(l.unitCost), 0)),
  varianceValue: round2(inv.lines.reduce((s, l) => s + num(l.varianceValue), 0)),
});

export const listInventories = async (ctx: FoodCostContext): Promise<FoodInventoryListItemDTO[]> =>
  (await findFoodInventories(ctx.restaurantId)).map(inventoryListItem);

/** Open a count, pre-filled in store-room order; an open draft is reused. */
export const openInventory = async (ctx: FoodCostContext, countedAt?: Date): Promise<{ id: string }> => {
  const draft = await findDraftInventory(ctx.restaurantId);
  if (draft) return draft;
  const { rows, costOf } = await ownedIngredients(ctx.restaurantId);
  return createFoodInventory({
    restaurantId: ctx.restaurantId,
    countedAt: countedAt ?? new Date(),
    createdById: ctx.userId,
    lines: rows
      .filter((r) => r.isActive)
      .map((r, sortOrder) => ({
        stockItemId: r.id,
        location: r.storageLocation,
        sortOrder,
        theoreticalQty: Math.max(0, num(r.onHand)),
        unitCost: round6(costOf(r.id) ?? 0),
      })),
  });
};

const loadOwnedInventory = async (restaurantId: string, id: string) => {
  const inventory = await findFoodInventoryById(id);
  if (!inventory || inventory.restaurantId !== restaurantId) throw new Error(FOOD_INVENTORY_NOT_FOUND);
  return inventory;
};

export const getInventory = async (ctx: FoodCostContext, id: string): Promise<FoodInventoryDTO> => {
  const inv = await loadOwnedInventory(ctx.restaurantId, id);
  return {
    id: inv.id,
    countedAt: inv.countedAt.toISOString(),
    status: inv.status,
    note: inv.note,
    validatedAt: inv.validatedAt?.toISOString() ?? null,
    lines: inv.lines.map((l) => ({
      id: l.id,
      stockItemId: l.stockItemId,
      name: l.stockItem.name,
      unit: l.stockItem.unit,
      location: l.location,
      sortOrder: l.sortOrder,
      theoreticalQty: num(l.theoreticalQty),
      countedQty: numOrNull(l.countedQty),
      unitCost: num(l.unitCost),
      varianceQty: numOrNull(l.varianceQty),
      varianceValue: numOrNull(l.varianceValue),
    })),
  };
};

export const saveInventory = async (ctx: FoodCostContext, input: SaveInventoryInput): Promise<void> => {
  const inv = await loadOwnedInventory(ctx.restaurantId, input.id);
  if (inv.status !== "DRAFT") throw new Error(FOOD_INVENTORY_NOT_DRAFT);
  const lineIds = new Set(inv.lines.map((l) => l.id));
  await saveInventoryCounts(
    inv.id,
    input.countedAt ?? null,
    input.counts.filter((c) => lineIds.has(c.lineId)),
  );
};

/**
 * Validate a count. A line left blank is taken at its theoretical quantity, so
 * a forgotten shelf never shows as a loss. Unit costs are frozen now.
 */
export const validateInventory = async (ctx: FoodCostContext, input: SaveInventoryInput): Promise<void> => {
  await saveInventory(ctx, input);
  const inv = await loadOwnedInventory(ctx.restaurantId, input.id);
  const { costOf } = await ownedIngredients(ctx.restaurantId);
  await validateFoodInventory({
    inventoryId: inv.id,
    restaurantId: ctx.restaurantId,
    createdById: ctx.userId,
    lines: inv.lines.map((l) => ({
      lineId: l.id,
      stockItemId: l.stockItemId,
      countedQty: num(l.countedQty ?? l.theoreticalQty),
      theoreticalQty: num(l.theoreticalQty),
      unitCost: round6(costOf(l.stockItemId) ?? num(l.unitCost)),
    })),
  });
};

export const deleteInventory = async (ctx: FoodCostContext, id: string): Promise<void> => {
  const inv = await loadOwnedInventory(ctx.restaurantId, id);
  if (inv.status !== "DRAFT") throw new Error(FOOD_INVENTORY_NOT_DRAFT);
  await deleteDraftFoodInventory(inv.id);
};

// -------------------------------------------------------------- losses ---

export const recordLoss = async (ctx: FoodCostContext, input: RecordLossInput): Promise<void> => {
  const { byId, costOf } = await ownedIngredients(ctx.restaurantId);
  const lossAt = input.lossAt ?? new Date();
  const movement = (stockItemId: string, quantity: number): MovementInput => ({
    restaurantId: ctx.restaurantId,
    stockItemId,
    type: "WASTE",
    delta: -round3(quantity),
    reason: input.reason,
    note: "Perte déclarée",
    orderId: null,
    unitCost: costOf(stockItemId),
    createdById: ctx.userId,
  });

  if (input.kind === "INGREDIENT") {
    const item = input.stockItemId ? byId.get(input.stockItemId) : undefined;
    if (!item) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
    const value = round2(input.quantity * (costOf(item.id) ?? 0));
    await applyMovementsWith([movement(item.id, input.quantity)], (tx) =>
      tx.foodLoss.create({
        data: { restaurantId: ctx.restaurantId, lossAt, stockItemId: item.id, quantity: input.quantity, value, reason: input.reason, createdById: ctx.userId },
      }),
    );
    return;
  }

  const card = await getRecipeCard(ctx, input.menuItemId ?? "");
  const movements = card.lines.map((l) => movement(l.stockItemId, (l.quantity * input.quantity) / card.portions));
  await applyMovementsWith(movements, (tx) =>
    tx.foodLoss.create({
      data: {
        restaurantId: ctx.restaurantId,
        lossAt,
        menuItemId: card.menuItemId,
        quantity: input.quantity,
        value: round2(card.portionCost * input.quantity),
        reason: input.reason,
        createdById: ctx.userId,
      },
    }),
  );
};

export const listLosses = async (ctx: FoodCostContext): Promise<FoodLossDTO[]> =>
  (await findFoodLosses(ctx.restaurantId)).map((l) => ({
    id: l.id,
    lossAt: l.lossAt.toISOString(),
    kind: l.menuItemId ? "DISH" : "INGREDIENT",
    name: l.menuItem?.name ?? l.stockItem?.name ?? "—",
    quantity: num(l.quantity),
    unit: l.stockItem?.unit ?? null,
    value: num(l.value),
    reason: l.reason,
  }));

// -------------------------------------------------------- preparations ---

export const listPreparations = async (ctx: FoodCostContext): Promise<PreparationDTO[]> => {
  const { rows, byId, costOf } = await ownedIngredients(ctx.restaurantId);
  return rows
    .filter((r) => r.isPreparation)
    .map((r) => {
      const lines = linesOf(r.preparationLines, byId, costOf);
      const cost = recipeCost(lines.map((l) => ({ quantity: l.quantity, netCost: l.netUnitCost })), 1);
      return {
        id: r.id,
        name: r.name,
        unit: r.unit,
        preparationYield: numOrNull(r.preparationYield),
        onHand: num(r.onHand),
        storageLocation: r.storageLocation,
        unitCost: costOf(r.id),
        lines,
        batchCost: cost.total,
        complete: cost.complete,
      };
    });
};

/** A preparation is made from raw ingredients only — never from itself or another base. */
export const savePreparation = async (ctx: FoodCostContext, input: SavePreparationInput): Promise<{ id: string }> => {
  const { byId } = await ownedIngredients(ctx.restaurantId);
  const existing = input.id ? byId.get(input.id) : undefined;
  if (input.id && (!existing || !existing.isPreparation)) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
  for (const line of input.lines) {
    const item = byId.get(line.stockItemId);
    if (!item) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
    if (item.isPreparation || line.stockItemId === input.id) throw new Error(FOOD_PREPARATION_INVALID);
  }
  const clash = await findIngredientByName(ctx.restaurantId, input.name);
  if (clash && clash.id !== input.id && !clash.deletedAt) throw new Error(FOOD_INGREDIENT_NAME_TAKEN);

  const data = {
    name: input.name,
    unit: input.unit,
    category: "Bases maison",
    purchaseUnit: null,
    purchaseFactor: 1,
    lastPurchasePrice: null,
    costPerUnit: null,
    yieldPercent: 100,
    storageLocation: input.storageLocation ?? null,
    storageOrder: existing?.storageOrder ?? 0,
    isPreparation: true,
    preparationYield: input.preparationYield,
  };
  const saved = existing ? await updateIngredient(existing.id, data) : await createIngredient(ctx.restaurantId, data);
  await replacePreparationLines(saved.id, mergeLines(input.lines));
  return saved;
};

/** Produce a batch: ingredients leave the stock, the preparation enters it at its cost. */
export const recordProduction = async (ctx: FoodCostContext, input: RecordProductionInput): Promise<void> => {
  const { byId, costOf } = await ownedIngredients(ctx.restaurantId);
  const base = byId.get(input.preparationId);
  const yieldQty = numOrNull(base?.preparationYield);
  if (!base || !base.isPreparation || !yieldQty) throw new Error(FOOD_INGREDIENT_NOT_FOUND);
  const unitCost = costOf(base.id);
  if (unitCost == null) throw new Error(FOOD_NO_COST);
  const scale = input.quantity / yieldQty;

  const movements: MovementInput[] = [
    ...base.preparationLines.map((l) => ({
      restaurantId: ctx.restaurantId,
      stockItemId: l.stockItemId,
      type: "PRODUCTION" as const,
      delta: -round3(num(l.quantity) * scale),
      reason: `Production : ${base.name}`,
      note: null,
      orderId: null,
      unitCost: costOf(l.stockItemId),
      createdById: ctx.userId,
    })),
    {
      restaurantId: ctx.restaurantId,
      stockItemId: base.id,
      type: "PRODUCTION",
      delta: round3(input.quantity),
      reason: "Production",
      note: null,
      orderId: null,
      unitCost,
      createdById: ctx.userId,
    },
  ];
  await applyMovementsWith(movements, (tx) =>
    tx.foodProduction.create({
      data: { restaurantId: ctx.restaurantId, preparationId: base.id, quantity: input.quantity, unitCost: round6(unitCost), createdById: ctx.userId },
    }),
  );
};

export const listProductions = async (ctx: FoodCostContext): Promise<FoodProductionDTO[]> =>
  (await findFoodProductions(ctx.restaurantId)).map((p) => ({
    id: p.id,
    producedAt: p.producedAt.toISOString(),
    preparationName: p.preparation.name,
    quantity: num(p.quantity),
    unit: p.preparation.unit,
    value: round2(num(p.quantity) * num(p.unitCost)),
  }));

// --------------------------------------------------------------- report ---

/**
 * The food cost of the period framed by two validated counts: what sales
 * explain (frozen costs) against what the counts and entries say was used.
 */
export const getFoodCostOverview = async (
  ctx: FoodCostContext,
  selection: { startId?: string; endId?: string } = {},
): Promise<FoodCostOverviewDTO> => {
  const [inventories, subRecipes, cards] = await Promise.all([
    findFoodInventories(ctx.restaurantId, "VALIDATED"),
    getSubRecipesEnabled(ctx.restaurantId),
    listRecipeCards(ctx),
  ]);
  const validated = inventories.map(inventoryListItem);
  const cardStats = {
    dishes: cards.length,
    withCard: cards.filter((c) => c.hasCard).length,
    estimated: cards.filter((c) => c.hasCard && c.reliability === "ESTIMATED").length,
    adjusted: cards.filter((c) => c.hasCard && c.reliability === "ADJUSTED").length,
    verified: cards.filter((c) => c.hasCard && c.reliability === "VERIFIED").length,
  };
  const empty = {
    validatedInventories: validated,
    days: 0,
    report: null,
    headline: null,
    causes: [],
    topDishes: [],
    purchasesPaid: 0,
    cards: cardStats,
    subRecipes,
  };

  if (inventories.length < 2) {
    return { ...empty, status: inventories.length === 0 ? "NO_INVENTORY" : "ONE_INVENTORY", start: validated[0] ?? null, end: null };
  }

  // Newest first: by default the last two counts frame the period.
  const end = inventories.find((i) => i.id === selection.endId) ?? inventories[0];
  const start =
    inventories.find((i) => i.id === selection.startId && i.countedAt < end.countedAt) ??
    inventories.find((i) => i.countedAt < end.countedAt);
  if (!start) {
    return { ...empty, status: "ONE_INVENTORY", start: null, end: inventoryListItem(end) };
  }

  const from = start.countedAt;
  const to = end.countedAt;
  const [startFull, endFull, entries, orders, losses, purchasesPaid, { rows, costOf }] = await Promise.all([
    findFoodInventoryById(start.id),
    findFoodInventoryById(end.id),
    findEntriesBetween(ctx.restaurantId, from, to),
    findOrdersPlacedBetween(ctx.restaurantId, from, to),
    findLossesBetween(ctx.restaurantId, from, to),
    sumPurchasesPaid(ctx.restaurantId, from, to),
    ownedIngredients(ctx.restaurantId),
  ]);

  const valued = (inv: typeof startFull) =>
    (inv?.lines ?? []).map((l) => ({
      stockItemId: l.stockItemId,
      quantity: num(l.countedQty ?? l.theoreticalQty),
      unitCost: num(l.unitCost),
    }));

  const sales: SoldDish[] = orders.flatMap((order) => {
    const sold = order.items.filter((i) => i.state !== "VOID");
    const bill = computeBill(orderToBillLines(order), { type: order.discountType, value: num(order.discountValue) });
    return sold.map((item, i) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      revenueHT: bill.lines[i]?.taxable ?? 0,
      foodCost: numOrNull(item.foodCost),
    }));
  });

  const report = foodCostReport({
    start: valued(startFull),
    end: valued(endFull),
    entries: entries.map((e) => ({
      stockItemId: e.stockItemId,
      quantity: num(e.quantity),
      unitCost: numOrNull(e.unitCost) ?? costOf(e.stockItemId) ?? 0,
    })),
    sales,
    losses: losses.map((l) => ({ value: num(l.value) })),
  });

  // The test to weigh portions only makes sense for a plate, not a drink.
  const drinks = new Set(
    orders.flatMap((o) => o.items.filter((i) => i.vatCategory === "SOFT_DRINK" || i.vatCategory === "ALCOHOL").map((i) => i.menuItemId)),
  );
  const soldByDish = new Map<string, { name: string; quantity: number }>();
  for (const s of sales) {
    if (!s.menuItemId || s.foodCost == null || drinks.has(s.menuItemId)) continue;
    const row = soldByDish.get(s.menuItemId) ?? { name: s.name, quantity: 0 };
    row.quantity += s.quantity;
    soldByDish.set(s.menuItemId, row);
  }
  const bestSeller = [...soldByDish.values()].sort((a, b) => b.quantity - a.quantity)[0]?.name ?? null;

  const familyValue = new Map<string, number>();
  const categoryOf = new Map(rows.map((r) => [r.id, r.category ?? "Sans famille"]));
  for (const line of valued(endFull)) {
    const family = categoryOf.get(line.stockItemId) ?? "Sans famille";
    familyValue.set(family, (familyValue.get(family) ?? 0) + line.quantity * line.unitCost);
  }
  const costliestFamily = [...familyValue.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    status: "READY",
    validatedInventories: validated,
    start: inventoryListItem(start),
    end: inventoryListItem(end),
    days: Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000)),
    report,
    headline: varianceHeadline(report.variance, report.variancePoints),
    causes: varianceCauses({ bestSeller, estimatedCards: cardStats.estimated, lossesValue: report.lossesValue, costliestFamily }),
    topDishes: topDishesByMargin(sales, 5),
    purchasesPaid: round2(purchasesPaid),
    cards: cardStats,
    subRecipes,
  };
};
