"use server";

import { withPermission } from "@/actions/helpers";
import {
  applyProposalSchema,
  inventoryRefSchema,
  menuItemRefSchema,
  openInventorySchema,
  recordLossSchema,
  recordProductionSchema,
  recordPurchaseSchema,
  saveIngredientSchema,
  saveInventorySchema,
  savePreparationSchema,
  saveRecipeCardSchema,
  setSubRecipesSchema,
} from "@/lib/validators/food-cost";
import {
  applyRecipeProposal,
  deleteInventory,
  openInventory,
  proposeRecipeCard,
  recordLoss,
  recordProduction,
  recordPurchase,
  saveIngredient,
  saveInventory,
  saveOwnRecipeCard,
  savePreparation,
  setSubRecipesEnabled,
  validateInventory,
  verifyRecipeCard,
} from "@/services/food-cost.service";

export const saveIngredientAction = withPermission("INVENTORY", "EDIT", saveIngredientSchema, (data, ctx) =>
  saveIngredient(ctx, data),
);

export const saveRecipeCardAction = withPermission("INVENTORY", "EDIT", saveRecipeCardSchema, (data, ctx) =>
  saveOwnRecipeCard(ctx, data),
);

export const verifyRecipeCardAction = withPermission("INVENTORY", "EDIT", menuItemRefSchema, (data, ctx) =>
  verifyRecipeCard(ctx, data.menuItemId),
);

export const proposeRecipeCardAction = withPermission("INVENTORY", "READ", menuItemRefSchema, (data, ctx) =>
  proposeRecipeCard(ctx, data.menuItemId),
);

export const applyRecipeProposalAction = withPermission("INVENTORY", "EDIT", applyProposalSchema, (data, ctx) =>
  applyRecipeProposal(ctx, data),
);

export const recordPurchaseAction = withPermission("INVENTORY", "EDIT", recordPurchaseSchema, (data, ctx) =>
  recordPurchase(ctx, data),
);

export const openInventoryAction = withPermission("INVENTORY", "EDIT", openInventorySchema, (data, ctx) =>
  openInventory(ctx, data.countedAt),
);

export const saveInventoryAction = withPermission("INVENTORY", "EDIT", saveInventorySchema, (data, ctx) =>
  saveInventory(ctx, data),
);

export const validateInventoryAction = withPermission("INVENTORY", "EDIT", saveInventorySchema, (data, ctx) =>
  validateInventory(ctx, data),
);

export const deleteInventoryAction = withPermission("INVENTORY", "EDIT", inventoryRefSchema, (data, ctx) =>
  deleteInventory(ctx, data.id),
);

export const recordLossAction = withPermission("INVENTORY", "EDIT", recordLossSchema, (data, ctx) =>
  recordLoss(ctx, data),
);

export const savePreparationAction = withPermission("INVENTORY", "EDIT", savePreparationSchema, (data, ctx) =>
  savePreparation(ctx, data),
);

export const recordProductionAction = withPermission("INVENTORY", "EDIT", recordProductionSchema, (data, ctx) =>
  recordProduction(ctx, data),
);

export const setSubRecipesAction = withPermission("INVENTORY", "EDIT", setSubRecipesSchema, (data, ctx) =>
  setSubRecipesEnabled(ctx, data.enabled),
);
