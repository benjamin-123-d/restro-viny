import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/food-cost.repository", () => ({
  applyMovementsWith: vi.fn((_moves, record) => record({ foodLoss: { create: vi.fn() }, foodProduction: { create: vi.fn() } })),
  createFoodInventory: vi.fn(),
  createIngredient: vi.fn(),
  deleteDraftFoodInventory: vi.fn(),
  findDraftInventory: vi.fn(),
  findEntriesBetween: vi.fn(),
  findFoodCostSettings: vi.fn(),
  findFoodInventories: vi.fn(),
  findFoodInventoryById: vi.fn(),
  findFoodLosses: vi.fn(),
  findFoodProductions: vi.fn(),
  findIngredientByName: vi.fn(),
  findIngredientPurchases: vi.fn(),
  findIngredients: vi.fn(),
  findLossesBetween: vi.fn(),
  findMenuForCards: vi.fn(),
  findMenuItemOwner: vi.fn(),
  findOrdersPlacedBetween: vi.fn(),
  findCardsForMenuItems: vi.fn(),
  markRecipeCardVerified: vi.fn(),
  recordIngredientPurchase: vi.fn(),
  replacePreparationLines: vi.fn(),
  saveInventoryCounts: vi.fn(),
  saveRecipeCard: vi.fn(),
  setFoodCostSubRecipes: vi.fn(),
  sumPurchasesPaid: vi.fn(),
  updateIngredient: vi.fn(),
  validateFoodInventory: vi.fn(),
}));
vi.mock("@/services/menu-item.service", () => ({ getMenu: vi.fn() }));
vi.mock("@/services/order.service", () => ({ orderToBillLines: vi.fn(() => []) }));

import {
  applyMovementsWith,
  createFoodInventory,
  findDraftInventory,
  findFoodCostSettings,
  findFoodInventories,
  findFoodInventoryById,
  findIngredients,
  findMenuForCards,
  findMenuItemOwner,
  recordIngredientPurchase,
  saveRecipeCard,
  validateFoodInventory,
  type IngredientRow,
} from "@/repositories/food-cost.repository";
import { getMenu } from "@/services/menu-item.service";

import {
  applyRecipeProposal,
  FOOD_PREPARATION_INVALID,
  getFoodCostOverview,
  openInventory,
  recordLoss,
  recordPurchase,
  savePreparation,
  validateInventory,
} from "./food-cost.service";

const ctx = { restaurantId: "r1", userId: "u1" };

const ingredient = (o: Partial<IngredientRow> = {}): IngredientRow =>
  ({
    id: "tomate",
    restaurantId: "r1",
    name: "Tomates",
    unit: "GRAM",
    category: "Légumes",
    onHand: 12400,
    costPerUnit: 0.0004375,
    purchaseUnit: "panier",
    purchaseFactor: 8000,
    lastPurchasePrice: 3.5,
    yieldPercent: 90,
    storageLocation: "Chambre froide",
    storageOrder: 1,
    isPreparation: false,
    preparationYield: null,
    isActive: true,
    deletedAt: null,
    preparationLines: [],
    ...o,
  }) as unknown as IngredientRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findIngredients).mockResolvedValue([ingredient()]);
  vi.mocked(findMenuItemOwner).mockResolvedValue({ id: "riz", restaurantId: "r1", name: "Riz au gras" });
  vi.mocked(getMenu).mockResolvedValue({ categories: [], items: [] } as never);
  vi.mocked(findFoodCostSettings).mockResolvedValue({ foodCostSubRecipes: false });
});

describe("recordPurchase", () => {
  it("turns purchase units into usage units and refreshes the price", async () => {
    vi.mocked(recordIngredientPurchase).mockResolvedValue({ id: "p1" });
    await recordPurchase(ctx, { stockItemId: "tomate", quantity: 2, amount: 7, note: undefined });
    expect(recordIngredientPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        usageQuantity: 16000,
        purchasePrice: 3.5,
        grossUnitCost: 0.000438,
        netUnitCost: 0.000486,
      }),
    );
  });
});

describe("applyRecipeProposal", () => {
  it("always saves a catalogue card as « Estimée », creating what is missing", async () => {
    const { createIngredient } = await import("@/repositories/food-cost.repository");
    vi.mocked(createIngredient).mockResolvedValue({ id: "piment" });
    await applyRecipeProposal(ctx, {
      menuItemId: "riz",
      portions: 10,
      lines: [
        { stockItemId: "tomate", ingredient: "tomate", catalogueQuantity: 1200, catalogueUnit: "GRAM", quantity: 1200 },
        { ingredient: "piment", catalogueQuantity: 30, catalogueUnit: "GRAM" },
      ],
    });
    expect(createIngredient).toHaveBeenCalledWith("r1", expect.objectContaining({ name: "Piment", unit: "GRAM" }));
    expect(saveRecipeCard).toHaveBeenCalledWith(
      "riz",
      expect.objectContaining({ reliability: "ESTIMATED", source: "CATALOGUE", portions: 10 }),
      [
        { stockItemId: "tomate", quantity: 1200 },
        { stockItemId: "piment", quantity: 30 },
      ],
    );
  });
});

describe("inventories", () => {
  it("reuses an open draft rather than starting a second count", async () => {
    vi.mocked(findDraftInventory).mockResolvedValue({ id: "draft" });
    await expect(openInventory(ctx)).resolves.toEqual({ id: "draft" });
    expect(createFoodInventory).not.toHaveBeenCalled();
  });

  it("pre-fills a new count with the theoretical stock and net cost", async () => {
    vi.mocked(findDraftInventory).mockResolvedValue(null);
    vi.mocked(createFoodInventory).mockResolvedValue({ id: "inv" });
    await openInventory(ctx);
    const lines = vi.mocked(createFoodInventory).mock.calls[0][0].lines;
    expect(lines[0]).toMatchObject({ stockItemId: "tomate", theoreticalQty: 12400, location: "Chambre froide", unitCost: 0.000486 });
  });

  it("takes a line left blank at its theoretical quantity", async () => {
    const draft = {
      id: "inv",
      restaurantId: "r1",
      status: "DRAFT",
      lines: [{ id: "l1", stockItemId: "tomate", countedQty: null, theoreticalQty: 12400, unitCost: 0 }],
    };
    vi.mocked(findFoodInventoryById).mockResolvedValue(draft as never);
    await validateInventory(ctx, { id: "inv", counts: [] });
    expect(vi.mocked(validateFoodInventory).mock.calls[0][0].lines[0]).toMatchObject({
      countedQty: 12400,
      theoreticalQty: 12400,
    });
  });
});

describe("recordLoss", () => {
  it("takes a lost dish's ingredients out of stock at its portion cost", async () => {
    vi.mocked(findMenuForCards).mockResolvedValue([
      {
        id: "riz",
        name: "Riz au gras",
        price: 11,
        category: { name: "Plats", sortOrder: 0 },
        recipeCard: { portions: 10, reliability: "ADJUSTED", verifiedAt: null, source: "MANUAL", notes: null },
        recipe: [{ stockItemId: "tomate", quantity: 2000 }],
      },
    ] as never);
    await recordLoss(ctx, { kind: "DISH", menuItemId: "riz", quantity: 2, reason: "Assiette renvoyée" });
    const [movements] = vi.mocked(applyMovementsWith).mock.calls[0];
    // 2 portions of a 10-portion card of 2 000 g: 400 g out.
    expect(movements[0]).toMatchObject({ stockItemId: "tomate", type: "WASTE", delta: -400 });
  });
});

describe("savePreparation", () => {
  it("refuses a base made from another base", async () => {
    vi.mocked(findIngredients).mockResolvedValue([ingredient(), ingredient({ id: "fond", name: "Fond", isPreparation: true })]);
    await expect(
      savePreparation(ctx, { name: "Sauce", unit: "ML", preparationYield: 1000, storageLocation: undefined, lines: [{ stockItemId: "fond", quantity: 200 }] }),
    ).rejects.toThrow(FOOD_PREPARATION_INVALID);
  });
});

describe("getFoodCostOverview", () => {
  it("shows nothing until an opening and a closing count exist", async () => {
    vi.mocked(findMenuForCards).mockResolvedValue([]);
    vi.mocked(findFoodInventories).mockResolvedValue([]);
    const overview = await getFoodCostOverview(ctx);
    expect(overview.status).toBe("NO_INVENTORY");
    expect(overview.report).toBeNull();
  });
});
