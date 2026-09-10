"use server";

/**
 * Advanced stock: warehouses and bins, batches, material requests, stock
 * entries (receipt / issue / transfer) and physical reconciliations.
 */

import { withManagerValidation } from "@/actions/helpers";
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
export const createWarehouseAction = withManagerValidation(
  createWarehouseSchema,
  (data, ctx) => createWarehouse(ctx, data),
);
export const updateWarehouseAction = withManagerValidation(
  updateWarehouseSchema,
  (data, ctx) => updateWarehouse(ctx, data),
);
export const deleteWarehouseAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => deleteWarehouse(ctx, data),
);

// Batches and expiry tracking.
export const createBatchAction = withManagerValidation(
  createBatchSchema,
  (data, ctx) => createBatch(ctx, data),
);
export const updateBatchAction = withManagerValidation(
  updateBatchSchema,
  (data, ctx) => updateBatch(ctx, data),
);
export const deleteBatchAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => removeBatch(ctx, data),
);

// Material requests.
export const createMaterialRequestAction = withManagerValidation(
  createMaterialRequestSchema,
  (data, ctx) => createMaterialRequest(ctx, data),
);
export const updateMaterialRequestAction = withManagerValidation(
  updateMaterialRequestSchema,
  (data, ctx) => updateMaterialRequest(ctx, data),
);
export const submitMaterialRequestAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => submitMaterialRequest(ctx, data),
);
export const stopMaterialRequestAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => stopMaterialRequest(ctx, data),
);
export const cancelMaterialRequestAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => cancelMaterialRequest(ctx, data),
);
export const deleteMaterialRequestAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => deleteMaterialRequest(ctx, data),
);

// Stock entries — submission moves the ledger and the bins together.
export const createStockEntryAction = withManagerValidation(
  createStockEntrySchema,
  (data, ctx) => createStockEntry(ctx, data),
);
export const submitStockEntryAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => submitStockEntry(ctx, data),
);
export const cancelStockEntryAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => cancelStockEntry(ctx, data),
);
export const deleteStockEntryAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => deleteStockEntry(ctx, data),
);

// Physical counts.
export const createStockReconciliationAction = withManagerValidation(
  createStockReconciliationSchema,
  (data, ctx) => createStockReconciliation(ctx, data),
);
export const submitStockReconciliationAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => submitStockReconciliation(ctx, data),
);
export const deleteStockReconciliationAction = withManagerValidation(
  stockDocIdSchema,
  (data, ctx) => deleteStockReconciliation(ctx, data),
);
