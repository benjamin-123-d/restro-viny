"use server";

/**
 * Advanced stock: warehouses and bins, batches, material requests, stock
 * entries (receipt / issue / transfer) and physical reconciliations.
 */

import { withPermission } from "@/actions/helpers";
import {
  createBatchSchema,
  createMaterialRequestSchema,
  createStockEntrySchema,
  createStockReconciliationSchema,
  createWarehouseSchema,
  stockDocIdSchema,
  updateBatchSchema,
  updateMaterialRequestSchema,
  updateWarehouseSchema,
} from "@/lib/validators/stock-advanced";
import {
  cancelMaterialRequest,
  cancelStockEntry,
  createBatch,
  createMaterialRequest,
  createStockEntry,
  createStockReconciliation,
  createWarehouse,
  deleteMaterialRequest,
  deleteStockEntry,
  deleteStockReconciliation,
  deleteWarehouse,
  removeBatch,
  stopMaterialRequest,
  submitMaterialRequest,
  submitStockEntry,
  submitStockReconciliation,
  updateBatch,
  updateMaterialRequest,
  updateWarehouse,
} from "@/services/stock-advanced.service";

// Warehouses — one cannot be removed while it still holds stock.
export const createWarehouseAction = withPermission(
  "STOCK",
  "EDIT",
  createWarehouseSchema,
  (data, ctx) => createWarehouse(ctx, data),
);
export const updateWarehouseAction = withPermission(
  "STOCK",
  "EDIT",
  updateWarehouseSchema,
  (data, ctx) => updateWarehouse(ctx, data),
);
export const deleteWarehouseAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => deleteWarehouse(ctx, data),
);

// Batches and expiry tracking.
export const createBatchAction = withPermission(
  "STOCK",
  "EDIT",
  createBatchSchema,
  (data, ctx) => createBatch(ctx, data),
);
export const updateBatchAction = withPermission(
  "STOCK",
  "EDIT",
  updateBatchSchema,
  (data, ctx) => updateBatch(ctx, data),
);
export const deleteBatchAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => removeBatch(ctx, data),
);

// Material requests.
export const createMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  createMaterialRequestSchema,
  (data, ctx) => createMaterialRequest(ctx, data),
);
export const updateMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  updateMaterialRequestSchema,
  (data, ctx) => updateMaterialRequest(ctx, data),
);
export const submitMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => submitMaterialRequest(ctx, data),
);
export const stopMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => stopMaterialRequest(ctx, data),
);
export const cancelMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => cancelMaterialRequest(ctx, data),
);
export const deleteMaterialRequestAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => deleteMaterialRequest(ctx, data),
);

// Stock entries — submission moves the ledger and the bins together.
export const createStockEntryAction = withPermission(
  "STOCK",
  "EDIT",
  createStockEntrySchema,
  (data, ctx) => createStockEntry(ctx, data),
);
export const submitStockEntryAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => submitStockEntry(ctx, data),
);
export const cancelStockEntryAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => cancelStockEntry(ctx, data),
);
export const deleteStockEntryAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => deleteStockEntry(ctx, data),
);

// Physical counts.
export const createStockReconciliationAction = withPermission(
  "STOCK",
  "EDIT",
  createStockReconciliationSchema,
  (data, ctx) => createStockReconciliation(ctx, data),
);
export const submitStockReconciliationAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => submitStockReconciliation(ctx, data),
);
export const deleteStockReconciliationAction = withPermission(
  "STOCK",
  "EDIT",
  stockDocIdSchema,
  (data, ctx) => deleteStockReconciliation(ctx, data),
);
