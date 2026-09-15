import type {
  DishEconomics,
  DishMargin,
  FoodCostReport,
  RecipeReliability,
  VarianceCause,
} from "@/lib/food-cost";
import type { CatalogueUnit } from "@/lib/recipe-catalogue";
import type { StockUnit } from "@/types/inventory";

export interface IngredientDTO {
  readonly id: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly category: string | null;
  readonly onHand: number;
  readonly purchaseUnit: string | null;
  readonly purchaseFactor: number;
  readonly lastPurchasePrice: number | null;
  readonly yieldPercent: number;
  /** Price of one usage unit, before yield. */
  readonly grossUnitCost: number | null;
  /** (price ÷ pack size) ÷ yield — what recipe cards use. */
  readonly netUnitCost: number | null;
  readonly stockValue: number | null;
  readonly storageLocation: string | null;
  readonly storageOrder: number;
  readonly isPreparation: boolean;
  readonly preparationYield: number | null;
  readonly isActive: boolean;
}

export interface RecipeLineDTO {
  readonly stockItemId: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly quantity: number;
  readonly netUnitCost: number | null;
  readonly lineCost: number | null;
  readonly isPreparation: boolean;
}

export interface RecipeCardDTO {
  readonly menuItemId: string;
  readonly menuItemName: string;
  readonly categoryName: string;
  readonly priceTTC: number;
  readonly priceHT: number;
  readonly hasCard: boolean;
  readonly portions: number;
  readonly reliability: RecipeReliability;
  readonly verifiedAt: string | null;
  readonly source: string;
  readonly notes: string | null;
  readonly lines: readonly RecipeLineDTO[];
  readonly totalCost: number;
  readonly portionCost: number;
  readonly complete: boolean;
  readonly unpricedLines: number;
  readonly economics: DishEconomics;
  readonly sentence: string;
}

export interface CatalogueProposalDTO {
  readonly recipeName: string;
  readonly portions: number;
  readonly lines: readonly {
    readonly ingredient: string;
    readonly catalogueQuantity: number;
    readonly catalogueUnit: CatalogueUnit;
    readonly stockItemId: string | null;
    readonly stockItemName: string | null;
    readonly quantity: number | null;
  }[];
}

export interface IngredientPurchaseDTO {
  readonly id: string;
  readonly purchasedAt: string;
  readonly stockItemId: string;
  readonly ingredientName: string;
  readonly quantity: number;
  readonly purchaseUnit: string | null;
  readonly amount: number;
  readonly usageQuantity: number;
  readonly unit: StockUnit;
  readonly note: string | null;
}

export type FoodInventoryStatus = "DRAFT" | "VALIDATED";

export interface FoodInventoryListItemDTO {
  readonly id: string;
  readonly countedAt: string;
  readonly status: FoodInventoryStatus;
  readonly validatedAt: string | null;
  readonly lineCount: number;
  readonly countedLines: number;
  readonly stockValue: number;
  readonly varianceValue: number;
}

export interface FoodInventoryLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly location: string | null;
  readonly sortOrder: number;
  readonly theoreticalQty: number;
  readonly countedQty: number | null;
  readonly unitCost: number;
  readonly varianceQty: number | null;
  readonly varianceValue: number | null;
}

export interface FoodInventoryDTO {
  readonly id: string;
  readonly countedAt: string;
  readonly status: FoodInventoryStatus;
  readonly note: string | null;
  readonly validatedAt: string | null;
  readonly lines: readonly FoodInventoryLineDTO[];
}

export interface FoodLossDTO {
  readonly id: string;
  readonly lossAt: string;
  readonly kind: "INGREDIENT" | "DISH";
  readonly name: string;
  readonly quantity: number;
  readonly unit: StockUnit | null;
  readonly value: number;
  readonly reason: string;
}

export interface PreparationDTO {
  readonly id: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly preparationYield: number | null;
  readonly onHand: number;
  readonly storageLocation: string | null;
  readonly unitCost: number | null;
  readonly lines: readonly RecipeLineDTO[];
  readonly batchCost: number;
  readonly complete: boolean;
}

export interface FoodProductionDTO {
  readonly id: string;
  readonly producedAt: string;
  readonly preparationName: string;
  readonly quantity: number;
  readonly unit: StockUnit;
  readonly value: number;
}

export interface FoodCostOverviewDTO {
  /** NO_INVENTORY / ONE_INVENTORY: the report needs an opening and a closing count. */
  readonly status: "NO_INVENTORY" | "ONE_INVENTORY" | "READY";
  readonly validatedInventories: readonly FoodInventoryListItemDTO[];
  readonly start: FoodInventoryListItemDTO | null;
  readonly end: FoodInventoryListItemDTO | null;
  readonly days: number;
  readonly report: FoodCostReport | null;
  readonly headline: string | null;
  readonly causes: readonly VarianceCause[];
  readonly topDishes: readonly DishMargin[];
  readonly purchasesPaid: number;
  readonly cards: {
    readonly dishes: number;
    readonly withCard: number;
    readonly estimated: number;
    readonly adjusted: number;
    readonly verified: number;
  };
  readonly subRecipes: boolean;
}
