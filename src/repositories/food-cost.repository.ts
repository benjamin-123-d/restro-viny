import type {
  Prisma,
  RecipeReliability,
  StockUnit,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ORDER_INCLUDE } from "@/repositories/order.repository";
import { applyMovementInTx, type MovementInput } from "@/repositories/stock.repository";

// ------------------------------------------------------------- settings ---

export const findFoodCostSettings = (restaurantId: string) =>
  prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { foodCostSubRecipes: true },
  });

export const setFoodCostSubRecipes = (restaurantId: string, enabled: boolean) =>
  prisma.restaurant.update({
    where: { id: restaurantId },
    data: { foodCostSubRecipes: enabled },
    select: { foodCostSubRecipes: true },
  });

// ----------------------------------------------------------- ingredients ---

export const INGREDIENT_SELECT = {
  id: true,
  restaurantId: true,
  name: true,
  unit: true,
  category: true,
  onHand: true,
  costPerUnit: true,
  purchaseUnit: true,
  purchaseFactor: true,
  lastPurchasePrice: true,
  yieldPercent: true,
  storageLocation: true,
  storageOrder: true,
  isPreparation: true,
  preparationYield: true,
  isActive: true,
  deletedAt: true,
  preparationLines: { select: { stockItemId: true, quantity: true } },
} satisfies Prisma.StockItemSelect;

export type IngredientRow = Prisma.StockItemGetPayload<{ select: typeof INGREDIENT_SELECT }>;

export const findIngredients = (restaurantId: string): Promise<IngredientRow[]> =>
  prisma.stockItem.findMany({
    where: { restaurantId, deletedAt: null },
    select: INGREDIENT_SELECT,
    orderBy: [{ storageLocation: "asc" }, { storageOrder: "asc" }, { name: "asc" }],
  });

export interface IngredientWriteData {
  name: string;
  unit: StockUnit;
  category: string | null;
  purchaseUnit: string | null;
  purchaseFactor: number;
  lastPurchasePrice: number | null;
  costPerUnit: number | null;
  yieldPercent: number;
  storageLocation: string | null;
  storageOrder: number;
  isPreparation: boolean;
  preparationYield: number | null;
}

export const createIngredient = (restaurantId: string, data: IngredientWriteData) =>
  prisma.stockItem.create({ data: { restaurantId, ...data }, select: { id: true } });

export const updateIngredient = (id: string, data: IngredientWriteData) =>
  prisma.stockItem.update({ where: { id }, data, select: { id: true } });

export const findIngredientByName = (restaurantId: string, name: string) =>
  prisma.stockItem.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
    select: { id: true, deletedAt: true },
  });

export const replacePreparationLines = (
  preparationId: string,
  lines: readonly { stockItemId: string; quantity: number }[],
) =>
  prisma.$transaction([
    prisma.preparationComponent.deleteMany({ where: { preparationId } }),
    prisma.preparationComponent.createMany({
      data: lines.map((l) => ({ preparationId, stockItemId: l.stockItemId, quantity: l.quantity })),
    }),
  ]);

// --------------------------------------------------------- recipe cards ---

export const findMenuForCards = (restaurantId: string) =>
  prisma.menuItem.findMany({
    where: { restaurantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      category: { select: { name: true, sortOrder: true } },
      recipeCard: true,
      recipe: { select: { stockItemId: true, quantity: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });

export type MenuCardRow = Awaited<ReturnType<typeof findMenuForCards>>[number];

export const findCardsForMenuItems = (menuItemIds: readonly string[]) =>
  prisma.menuItem.findMany({
    where: { id: { in: [...menuItemIds] } },
    select: {
      id: true,
      restaurantId: true,
      recipeCard: { select: { portions: true } },
      recipe: { select: { stockItemId: true, quantity: true } },
    },
  });

export interface RecipeCardWriteData {
  portions: number;
  reliability: RecipeReliability;
  source: string;
  notes: string | null;
  verifiedAt?: Date | null;
}

/** Replace a dish's card and lines in one go. */
export const saveRecipeCard = (
  menuItemId: string,
  card: RecipeCardWriteData,
  lines: readonly { stockItemId: string; quantity: number }[],
) =>
  prisma.$transaction([
    prisma.recipeComponent.deleteMany({ where: { menuItemId } }),
    prisma.recipeComponent.createMany({
      data: lines.map((l) => ({ menuItemId, stockItemId: l.stockItemId, quantity: l.quantity })),
    }),
    prisma.recipeCard.upsert({
      where: { menuItemId },
      create: { menuItemId, ...card },
      update: card,
    }),
  ]);

export const markRecipeCardVerified = (menuItemId: string, at: Date) =>
  prisma.recipeCard.upsert({
    where: { menuItemId },
    create: { menuItemId, reliability: "VERIFIED", verifiedAt: at, source: "MANUAL" },
    update: { reliability: "VERIFIED", verifiedAt: at },
  });

export const findMenuItemOwner = (menuItemId: string) =>
  prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { id: true, restaurantId: true, name: true } });

// ------------------------------------------------------------ purchases ---

export const recordIngredientPurchase = (input: {
  restaurantId: string;
  stockItemId: string;
  purchasedAt: Date;
  quantity: number;
  amount: number;
  usageQuantity: number;
  purchasePrice: number;
  grossUnitCost: number;
  netUnitCost: number;
  note: string | null;
  createdById: string;
  purchaseInvoiceId?: string | null;
}) =>
  prisma.$transaction(async (tx) => {
    await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { lastPurchasePrice: input.purchasePrice, costPerUnit: input.grossUnitCost },
    });
    const movement = await applyMovementInTx(tx, {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      type: "RECEIVE",
      delta: input.usageQuantity,
      reason: "Achat",
      note: input.note,
      orderId: null,
      unitCost: input.netUnitCost,
      createdById: input.createdById,
    });
    return tx.ingredientPurchase.create({
      data: {
        restaurantId: input.restaurantId,
        stockItemId: input.stockItemId,
        purchasedAt: input.purchasedAt,
        quantity: input.quantity,
        amount: input.amount,
        usageQuantity: input.usageQuantity,
        note: input.note,
        movementId: movement.id,
        purchaseInvoiceId: input.purchaseInvoiceId ?? null,
        createdById: input.createdById,
      },
      select: { id: true },
    });
  });

export const findIngredientPurchases = (restaurantId: string, take = 30) =>
  prisma.ingredientPurchase.findMany({
    where: { restaurantId },
    include: { stockItem: { select: { name: true, unit: true, purchaseUnit: true } } },
    orderBy: { purchasedAt: "desc" },
    take,
  });

export const sumPurchasesPaid = async (restaurantId: string, from: Date, to: Date): Promise<number> => {
  const agg = await prisma.ingredientPurchase.aggregate({
    where: { restaurantId, purchasedAt: { gt: from, lte: to } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
};

// ----------------------------------------------------------- inventories ---

const INVENTORY_INCLUDE = {
  lines: {
    include: { stockItem: { select: { name: true, unit: true } } },
    orderBy: [{ sortOrder: "asc" }],
  },
} satisfies Prisma.FoodInventoryInclude;

export type FoodInventoryWithLines = Prisma.FoodInventoryGetPayload<{ include: typeof INVENTORY_INCLUDE }>;

export const findDraftInventory = (restaurantId: string) =>
  prisma.foodInventory.findFirst({ where: { restaurantId, status: "DRAFT" }, select: { id: true } });

export const createFoodInventory = (input: {
  restaurantId: string;
  countedAt: Date;
  createdById: string;
  lines: readonly {
    stockItemId: string;
    location: string | null;
    sortOrder: number;
    theoreticalQty: number;
    unitCost: number;
  }[];
}) =>
  prisma.foodInventory.create({
    data: {
      restaurantId: input.restaurantId,
      countedAt: input.countedAt,
      createdById: input.createdById,
      lines: { create: input.lines.map((l) => ({ ...l })) },
    },
    select: { id: true },
  });

export const findFoodInventoryById = (id: string): Promise<FoodInventoryWithLines | null> =>
  prisma.foodInventory.findUnique({ where: { id }, include: INVENTORY_INCLUDE });

export const findFoodInventories = (restaurantId: string, status?: "DRAFT" | "VALIDATED") =>
  prisma.foodInventory.findMany({
    where: { restaurantId, ...(status ? { status } : {}) },
    include: { lines: { select: { countedQty: true, unitCost: true, varianceValue: true, theoreticalQty: true } } },
    orderBy: { countedAt: "desc" },
  });

export const saveInventoryCounts = (
  inventoryId: string,
  countedAt: Date | null,
  counts: readonly { lineId: string; countedQty: number | null }[],
) =>
  prisma.$transaction([
    ...counts.map((c) =>
      prisma.foodInventoryLine.update({
        where: { id: c.lineId, inventoryId },
        data: { countedQty: c.countedQty },
      }),
    ),
    prisma.foodInventory.update({
      where: { id: inventoryId },
      data: countedAt ? { countedAt } : {},
    }),
  ]);

/**
 * Validate a count: every counted line becomes the item's on-hand through a
 * CORRECTION movement, with its variance and unit cost frozen on the line.
 */
export const validateFoodInventory = (input: {
  inventoryId: string;
  restaurantId: string;
  createdById: string;
  lines: readonly {
    lineId: string;
    stockItemId: string;
    countedQty: number;
    theoreticalQty: number;
    unitCost: number;
  }[];
}) =>
  prisma.$transaction(async (tx) => {
    for (const line of input.lines) {
      const item = await tx.stockItem.findUniqueOrThrow({
        where: { id: line.stockItemId },
        select: { onHand: true },
      });
      const delta = Math.round((line.countedQty - Number(item.onHand)) * 1000) / 1000;
      if (delta !== 0) {
        await applyMovementInTx(tx, {
          restaurantId: input.restaurantId,
          stockItemId: line.stockItemId,
          type: "CORRECTION",
          delta,
          reason: "Inventaire",
          note: null,
          orderId: null,
          unitCost: line.unitCost,
          createdById: input.createdById,
        });
      }
      const varianceQty = Math.round((line.countedQty - line.theoreticalQty) * 1000) / 1000;
      await tx.foodInventoryLine.update({
        where: { id: line.lineId },
        data: {
          countedQty: line.countedQty,
          unitCost: line.unitCost,
          varianceQty,
          varianceValue: Math.round(varianceQty * line.unitCost * 100) / 100,
        },
      });
    }
    await tx.foodInventory.update({
      where: { id: input.inventoryId },
      data: { status: "VALIDATED", validatedAt: new Date() },
    });
  });

export const deleteDraftFoodInventory = (id: string) =>
  prisma.foodInventory.delete({ where: { id } }).then(() => undefined);

// ---------------------------------------------------------- stock moves ---

/** Apply several movements (losses, production) and record the business row, atomically. */
export const applyMovementsWith = <T>(
  movements: readonly MovementInput[],
  record: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> =>
  prisma.$transaction(async (tx) => {
    for (const movement of movements) {
      await applyMovementInTx(tx, movement);
    }
    return record(tx);
  });

export const findEntriesBetween = (restaurantId: string, from: Date, to: Date) =>
  prisma.stockMovement.findMany({
    where: { restaurantId, type: "RECEIVE", createdAt: { gt: from, lte: to } },
    select: { stockItemId: true, quantity: true, unitCost: true },
  });

// ------------------------------------------------------------- losses ---

export const findFoodLosses = (restaurantId: string, take = 30) =>
  prisma.foodLoss.findMany({
    where: { restaurantId },
    include: {
      stockItem: { select: { name: true, unit: true } },
      menuItem: { select: { name: true } },
    },
    orderBy: { lossAt: "desc" },
    take,
  });

export const findLossesBetween = (restaurantId: string, from: Date, to: Date) =>
  prisma.foodLoss.findMany({
    where: { restaurantId, lossAt: { gt: from, lte: to } },
    select: { value: true },
  });

// --------------------------------------------------------- production ---

export const findFoodProductions = (restaurantId: string, take = 20) =>
  prisma.foodProduction.findMany({
    where: { restaurantId },
    include: { preparation: { select: { name: true, unit: true } } },
    orderBy: { producedAt: "desc" },
    take,
  });

// --------------------------------------------------------------- sales ---

/** Orders placed in a period (voided ones excepted), with lines and frozen costs. */
export const findOrdersPlacedBetween = (restaurantId: string, from: Date, to: Date) =>
  prisma.order.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      status: { not: "VOID" },
      createdAt: { gt: from, lte: to },
    },
    include: ORDER_INCLUDE,
  });
