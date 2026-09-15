import { z } from "zod";

import { stockUnitSchema } from "@/lib/validators/inventory";
import { idSchema } from "@/lib/validators/shared";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const positive = (message: string) => z.coerce.number({ error: message }).positive(message).max(10_000_000);
const optionalDate = z.coerce.date().optional();

export const saveIngredientSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Donnez un nom à l'ingrédient.").max(80),
  unit: stockUnitSchema,
  category: text(60),
  purchaseUnit: text(40),
  purchaseFactor: positive("Indiquez combien d'unités d'usage contient une unité d'achat.").default(1),
  lastPurchasePrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  yieldPercent: z.coerce
    .number()
    .min(1, "Le rendement va de 1 à 100 %.")
    .max(100, "Le rendement va de 1 à 100 %.")
    .default(100),
  storageLocation: text(60),
  storageOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type SaveIngredientInput = z.infer<typeof saveIngredientSchema>;

const recipeLineSchema = z.object({
  stockItemId: idSchema,
  quantity: positive("Chaque ligne doit avoir une quantité."),
});

export const saveRecipeCardSchema = z.object({
  menuItemId: idSchema,
  portions: z.coerce.number().int().min(1, "Au moins une portion.").max(1000),
  notes: text(400),
  lines: z.array(recipeLineSchema).min(1, "Ajoutez au moins un ingrédient."),
});
export type SaveRecipeCardInput = z.infer<typeof saveRecipeCardSchema>;

export const menuItemRefSchema = z.object({ menuItemId: idSchema });

export const applyProposalSchema = z.object({
  menuItemId: idSchema,
  portions: z.coerce.number().int().min(1).max(1000),
  lines: z
    .array(
      z.object({
        stockItemId: idSchema.optional(),
        ingredient: z.string().trim().min(1).max(80),
        catalogueQuantity: positive("Quantité manquante."),
        catalogueUnit: z.enum(["GRAM", "ML", "PIECE"]),
        quantity: z.coerce.number().positive().optional(),
      }),
    )
    .min(1),
});
export type ApplyProposalInput = z.infer<typeof applyProposalSchema>;

export const recordPurchaseSchema = z.object({
  stockItemId: idSchema,
  quantity: positive("Indiquez la quantité achetée."),
  amount: positive("Indiquez le montant payé."),
  purchasedAt: optionalDate,
  note: text(200),
});
export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>;

export const openInventorySchema = z.object({ countedAt: optionalDate });

const countsSchema = z.array(
  z.object({
    lineId: idSchema,
    countedQty: z.coerce.number().nonnegative().max(10_000_000).nullable(),
  }),
);

export const saveInventorySchema = z.object({
  id: idSchema,
  countedAt: optionalDate,
  counts: countsSchema,
});
export type SaveInventoryInput = z.infer<typeof saveInventorySchema>;

export const inventoryRefSchema = z.object({ id: idSchema });

export const recordLossSchema = z
  .object({
    kind: z.enum(["INGREDIENT", "DISH"]),
    stockItemId: idSchema.optional(),
    menuItemId: idSchema.optional(),
    quantity: positive("Indiquez la quantité perdue."),
    reason: z.string().trim().min(1, "Indiquez le motif.").max(80),
    lossAt: optionalDate,
  })
  .refine((v) => (v.kind === "INGREDIENT" ? Boolean(v.stockItemId) : Boolean(v.menuItemId)), {
    message: "Choisissez ce qui a été perdu.",
    path: ["target"],
  });
export type RecordLossInput = z.infer<typeof recordLossSchema>;

export const savePreparationSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Donnez un nom à la base.").max(80),
  unit: stockUnitSchema,
  preparationYield: positive("Indiquez la quantité produite par la recette."),
  storageLocation: text(60),
  lines: z.array(recipeLineSchema).min(1, "Ajoutez au moins un ingrédient."),
});
export type SavePreparationInput = z.infer<typeof savePreparationSchema>;

export const recordProductionSchema = z.object({
  preparationId: idSchema,
  quantity: positive("Indiquez la quantité produite."),
});
export type RecordProductionInput = z.infer<typeof recordProductionSchema>;

export const setSubRecipesSchema = z.object({ enabled: z.boolean() });
