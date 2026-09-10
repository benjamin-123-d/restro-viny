import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const positiveQty = z.coerce.number().positive().max(1_000_000);
const nonNegQty = z.coerce.number().nonnegative().max(1_000_000);
const rate = z.coerce.number().nonnegative().max(10_000_000);
const optionalDate = z.coerce.date().optional();

export const stockDocIdSchema = z.object({ id: idSchema });
export type StockDocIdInput = z.infer<typeof stockDocIdSchema>;

// ------------------------------------------------------------ warehouse ---

const warehouseFields = {
  name: z.string().trim().min(1, "Name is required").max(120),
  code: optionalText(20),
  parentId: idSchema.optional(),
  isGroup: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  addressLine1: optionalText(160),
  city: optionalText(80),
  disabled: z.boolean().default(false),
  notes: optionalText(300),
};

export const createWarehouseSchema = z.object(warehouseFields);
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export const updateWarehouseSchema = z.object({
  ...warehouseFields,
  id: idSchema,
});
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

// ---------------------------------------------------------------- batch ---

export const createBatchSchema = z.object({
  stockItemId: idSchema,
  warehouseId: idSchema.optional(),
  batchNo: z.string().trim().min(1, "Batch number is required").max(60),
  expiryDate: optionalDate,
  manufactureDate: optionalDate,
  quantity: nonNegQty.default(0),
  notes: optionalText(300),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = createBatchSchema.extend({ id: idSchema });
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

// ----------------------------------------------------- material request ---

export const materialRequestTypeSchema = z.enum([
  "PURCHASE",
  "MATERIAL_TRANSFER",
  "MATERIAL_ISSUE",
  "MANUFACTURE",
]);

const materialRequestLineSchema = z.object({
  stockItemId: idSchema,
  warehouseId: idSchema.optional(),
  description: optionalText(200),
  quantity: positiveQty,
  requiredBy: optionalDate,
});

export const createMaterialRequestSchema = z.object({
  type: materialRequestTypeSchema.default("PURCHASE"),
  transactionDate: optionalDate,
  requiredBy: optionalDate,
  notes: optionalText(600),
  items: z.array(materialRequestLineSchema).min(1, "Add at least one item"),
});
export type CreateMaterialRequestInput = z.infer<
  typeof createMaterialRequestSchema
>;

export const updateMaterialRequestSchema = createMaterialRequestSchema.extend({
  id: idSchema,
});
export type UpdateMaterialRequestInput = z.infer<
  typeof updateMaterialRequestSchema
>;

/** Turn an approved request into a purchase order for one supplier. */
export const orderFromMaterialRequestSchema = z.object({
  materialRequestId: idSchema,
  supplierId: idSchema,
  scheduleDate: optionalDate,
});
export type OrderFromMaterialRequestInput = z.infer<
  typeof orderFromMaterialRequestSchema
>;

// --------------------------------------------------------- stock entry ---

export const stockEntryPurposeSchema = z.enum([
  "MATERIAL_RECEIPT",
  "MATERIAL_ISSUE",
  "MATERIAL_TRANSFER",
  "REPACK",
  "MANUFACTURE",
]);

const stockEntryLineSchema = z.object({
  stockItemId: idSchema,
  fromWarehouseId: idSchema.optional(),
  toWarehouseId: idSchema.optional(),
  quantity: positiveQty,
  valuationRate: rate.default(0),
  batchNo: optionalText(60),
});

/**
 * The purpose decides which warehouse fields each line must carry: a receipt
 * needs a destination, an issue needs a source, a transfer needs both and they
 * must differ.
 */
export const createStockEntrySchema = z
  .object({
    purpose: stockEntryPurposeSchema,
    postingDate: optionalDate,
    reason: optionalText(120),
    notes: optionalText(600),
    items: z.array(stockEntryLineSchema).min(1, "Add at least one item"),
  })
  .superRefine((v, ctx) => {
    v.items.forEach((item, index) => {
      const needsSource =
        v.purpose === "MATERIAL_ISSUE" || v.purpose === "MATERIAL_TRANSFER";
      const needsTarget =
        v.purpose === "MATERIAL_RECEIPT" || v.purpose === "MATERIAL_TRANSFER";

      if (needsSource && !item.fromWarehouseId) {
        ctx.addIssue({
          code: "custom",
          message: "Choose where the stock comes from",
          path: ["items", index, "fromWarehouseId"],
        });
      }
      if (needsTarget && !item.toWarehouseId) {
        ctx.addIssue({
          code: "custom",
          message: "Choose where the stock goes",
          path: ["items", index, "toWarehouseId"],
        });
      }
      if (
        v.purpose === "MATERIAL_TRANSFER" &&
        item.fromWarehouseId &&
        item.fromWarehouseId === item.toWarehouseId
      ) {
        ctx.addIssue({
          code: "custom",
          message: "A transfer must move between two different warehouses",
          path: ["items", index, "toWarehouseId"],
        });
      }
    });
  });
export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>;

// ------------------------------------------------ stock reconciliation ---

const reconciliationLineSchema = z.object({
  stockItemId: idSchema,
  warehouseId: idSchema.optional(),
  countedQty: nonNegQty,
  valuationRate: rate.optional(),
});

export const createStockReconciliationSchema = z.object({
  postingDate: optionalDate,
  reason: optionalText(120),
  notes: optionalText(600),
  items: z.array(reconciliationLineSchema).min(1, "Nothing to count"),
});
export type CreateStockReconciliationInput = z.infer<
  typeof createStockReconciliationSchema
>;
