import type {
  CreateBatchInput,
  CreateMaterialRequestInput,
  CreateStockEntryInput,
  CreateStockReconciliationInput,
  CreateWarehouseInput,
  UpdateBatchInput,
  UpdateMaterialRequestInput,
  UpdateWarehouseInput,
} from "@/lib/validators/stock-advanced";
import {
  cancelStockEntry as cancelStockEntryRepo,
  createMaterialRequest as createMaterialRequestRepo,
  createStockEntry as createStockEntryRepo,
  createStockReconciliation as createStockReconciliationRepo,
  deleteDraftMaterialRequest,
  deleteDraftStockEntry,
  deleteDraftStockReconciliation,
  findMaterialRequestById,
  findMaterialRequests,
  findStockEntries,
  findStockEntryById,
  findStockReconciliationById,
  findStockReconciliations,
  setMaterialRequestStatus,
  submitStockEntry as submitStockEntryRepo,
  submitStockReconciliation as submitStockReconciliationRepo,
  updateMaterialRequest as updateMaterialRequestRepo,
  type MaterialRequestWithDetail,
  type ReconciliationWithDetail,
  type StockEntryWithDetail,
} from "@/repositories/stock-document.repository";
import {
  clearDefaultWarehouses,
  countStockInWarehouse,
  createBatch as createBatchRepo,
  createWarehouse as createWarehouseRepo,
  deleteBatch,
  findBatchById,
  findBatches,
  findBins,
  findWarehouseById,
  findWarehouses,
  findWarehouseTotals,
  softDeleteWarehouse,
  updateBatch as updateBatchRepo,
  updateWarehouse as updateWarehouseRepo,
  type BatchWithDetail,
  type BinWithDetail,
  type WarehouseWithParent,
} from "@/repositories/warehouse.repository";
import type { SellingContext } from "@/services/customer.service";
import type { StockUnit } from "@/types/inventory";
import type {
  BatchDTO,
  BinDTO,
  MaterialRequestDTO,
  MaterialRequestListItemDTO,
  StockEntryDTO,
  StockEntryListItemDTO,
  StockReconciliationDTO,
  StockReconciliationListItemDTO,
  WarehouseDTO,
} from "@/types/stock-advanced";

export const WAREHOUSE_NOT_FOUND = "WAREHOUSE_NOT_FOUND";
export const WAREHOUSE_NOT_EMPTY = "WAREHOUSE_NOT_EMPTY";
export const WAREHOUSE_IS_GROUP = "WAREHOUSE_IS_GROUP";
export const BATCH_NOT_FOUND = "BATCH_NOT_FOUND";
export const MR_NOT_FOUND = "MR_NOT_FOUND";
export const MR_NOT_DRAFT = "MR_NOT_DRAFT";
export const MR_NOT_SUBMITTED = "MR_NOT_SUBMITTED";
export const SE_NOT_FOUND = "SE_NOT_FOUND";
export const SE_NOT_DRAFT = "SE_NOT_DRAFT";
export const SE_NOT_SUBMITTED = "SE_NOT_SUBMITTED";
export const RECO_NOT_FOUND = "RECO_NOT_FOUND";
export const RECO_NOT_DRAFT = "RECO_NOT_DRAFT";

export type StockContext = SellingContext;

const num = (v: unknown): number => Number(v);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const DAY_MS = 86_400_000;

// ------------------------------------------------------------ warehouse ---

const mapWarehouse = (
  w: WarehouseWithParent,
  totals?: { itemCount: number; stockValue: number },
): WarehouseDTO => ({
  id: w.id,
  name: w.name,
  code: w.code,
  parentId: w.parentId,
  parentName: w.parent?.name ?? null,
  isGroup: w.isGroup,
  isDefault: w.isDefault,
  addressLine1: w.addressLine1,
  city: w.city,
  disabled: w.disabled,
  notes: w.notes,
  itemCount: totals?.itemCount ?? 0,
  stockValue: totals?.stockValue ?? 0,
});

export const loadOwnedWarehouse = async (
  restaurantId: string,
  id: string,
): Promise<WarehouseWithParent> => {
  const warehouse = await findWarehouseById(id);
  if (
    !warehouse ||
    warehouse.deletedAt ||
    warehouse.restaurantId !== restaurantId
  ) {
    throw new Error(WAREHOUSE_NOT_FOUND);
  }
  return warehouse;
};

export const listWarehouses = async (
  ctx: StockContext,
  opts: { includeDisabled?: boolean } = {},
): Promise<WarehouseDTO[]> => {
  const [warehouses, totals] = await Promise.all([
    findWarehouses(ctx.restaurantId, opts),
    findWarehouseTotals(ctx.restaurantId),
  ]);
  return warehouses.map((w) => mapWarehouse(w, totals.get(w.id)));
};

export const createWarehouse = async (
  ctx: StockContext,
  input: CreateWarehouseInput,
): Promise<WarehouseDTO> => {
  const warehouse = await createWarehouseRepo(ctx.restaurantId, {
    name: input.name,
    code: input.code ?? null,
    parentId: input.parentId ?? null,
    isGroup: input.isGroup,
    isDefault: input.isDefault,
    addressLine1: input.addressLine1 ?? null,
    city: input.city ?? null,
    disabled: input.disabled,
    notes: input.notes ?? null,
  });
  if (input.isDefault) {
    await clearDefaultWarehouses(ctx.restaurantId, warehouse.id);
  }
  return mapWarehouse(warehouse);
};

export const updateWarehouse = async (
  ctx: StockContext,
  input: UpdateWarehouseInput,
): Promise<WarehouseDTO> => {
  const warehouse = await loadOwnedWarehouse(ctx.restaurantId, input.id);
  const updated = await updateWarehouseRepo(warehouse.id, {
    name: input.name,
    code: input.code ?? null,
    parentId: input.parentId ?? null,
    isGroup: input.isGroup,
    isDefault: input.isDefault,
    addressLine1: input.addressLine1 ?? null,
    city: input.city ?? null,
    disabled: input.disabled,
    notes: input.notes ?? null,
  });
  if (input.isDefault) {
    await clearDefaultWarehouses(ctx.restaurantId, updated.id);
  }
  return mapWarehouse(updated);
};

/** A warehouse still holding stock cannot be removed — move it out first. */
export const deleteWarehouse = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const warehouse = await loadOwnedWarehouse(ctx.restaurantId, input.id);
  if ((await countStockInWarehouse(warehouse.id)) > 0) {
    throw new Error(WAREHOUSE_NOT_EMPTY);
  }
  await softDeleteWarehouse(warehouse.id);
};

const mapBin = (b: BinWithDetail): BinDTO => ({
  id: b.id,
  stockItemId: b.stockItemId,
  stockItemName: b.stockItem.name,
  unit: b.stockItem.unit as StockUnit,
  warehouseId: b.warehouseId,
  warehouseName: b.warehouse.name,
  actualQty: num(b.actualQty),
  reservedQty: num(b.reservedQty),
  orderedQty: num(b.orderedQty),
  indentedQty: num(b.indentedQty),
  projectedQty: num(b.projectedQty),
  valuationRate: num(b.valuationRate),
  stockValue: num(b.stockValue),
});

export const listBins = async (
  ctx: StockContext,
  filter: { warehouseId?: string; stockItemId?: string } = {},
): Promise<BinDTO[]> =>
  (await findBins(ctx.restaurantId, filter)).map(mapBin);

// ---------------------------------------------------------------- batch ---

const mapBatch = (b: BatchWithDetail, now: Date): BatchDTO => {
  const daysToExpiry =
    b.expiryDate === null
      ? null
      : Math.ceil((b.expiryDate.getTime() - now.getTime()) / DAY_MS);
  return {
    id: b.id,
    stockItemId: b.stockItemId,
    stockItemName: b.stockItem.name,
    unit: b.stockItem.unit as StockUnit,
    warehouseId: b.warehouseId,
    warehouseName: b.warehouse?.name ?? null,
    batchNo: b.batchNo,
    expiryDate: iso(b.expiryDate),
    manufactureDate: iso(b.manufactureDate),
    quantity: num(b.quantity),
    notes: b.notes,
    daysToExpiry,
    isExpired: daysToExpiry !== null && daysToExpiry < 0,
  };
};

export const listBatches = async (
  ctx: StockContext,
  filter: { stockItemId?: string; expiringWithinDays?: number } = {},
): Promise<BatchDTO[]> => {
  const now = new Date();
  const expiringBefore =
    filter.expiringWithinDays !== undefined
      ? new Date(now.getTime() + filter.expiringWithinDays * DAY_MS)
      : undefined;
  return (
    await findBatches(ctx.restaurantId, {
      stockItemId: filter.stockItemId,
      expiringBefore,
    })
  ).map((b) => mapBatch(b, now));
};

export const createBatch = async (
  ctx: StockContext,
  input: CreateBatchInput,
): Promise<BatchDTO> =>
  mapBatch(
    await createBatchRepo(ctx.restaurantId, {
      stockItemId: input.stockItemId,
      warehouseId: input.warehouseId ?? null,
      batchNo: input.batchNo,
      expiryDate: input.expiryDate ?? null,
      manufactureDate: input.manufactureDate ?? null,
      quantity: input.quantity,
      notes: input.notes ?? null,
    }),
    new Date(),
  );

export const updateBatch = async (
  ctx: StockContext,
  input: UpdateBatchInput,
): Promise<BatchDTO> => {
  const batch = await findBatchById(input.id);
  if (!batch || batch.restaurantId !== ctx.restaurantId) {
    throw new Error(BATCH_NOT_FOUND);
  }
  return mapBatch(
    await updateBatchRepo(batch.id, {
      stockItemId: input.stockItemId,
      warehouseId: input.warehouseId ?? null,
      batchNo: input.batchNo,
      expiryDate: input.expiryDate ?? null,
      manufactureDate: input.manufactureDate ?? null,
      quantity: input.quantity,
      notes: input.notes ?? null,
    }),
    new Date(),
  );
};

export const removeBatch = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const batch = await findBatchById(input.id);
  if (!batch || batch.restaurantId !== ctx.restaurantId) {
    throw new Error(BATCH_NOT_FOUND);
  }
  await deleteBatch(batch.id);
};

// ----------------------------------------------------- material request ---

const mapMaterialRequest = (
  r: MaterialRequestWithDetail,
): MaterialRequestDTO => ({
  id: r.id,
  number: r.number,
  type: r.type,
  status: r.status,
  transactionDate: r.transactionDate.toISOString(),
  requiredBy: iso(r.requiredBy),
  notes: r.notes,
  isEditable: r.status === "DRAFT",
  items: r.items.map((i) => {
    const quantity = num(i.quantity);
    const orderedQty = num(i.orderedQty);
    return {
      id: i.id,
      stockItemId: i.stockItemId,
      stockItemName: i.stockItem.name,
      unit: i.stockItem.unit as StockUnit,
      warehouseId: i.warehouseId,
      warehouseName: i.warehouse?.name ?? null,
      description: i.description,
      quantity,
      orderedQty,
      receivedQty: num(i.receivedQty),
      pendingQty: Math.max(0, quantity - orderedQty),
      requiredBy: iso(i.requiredBy),
    };
  }),
});

const loadOwnedRequest = async (
  restaurantId: string,
  id: string,
): Promise<MaterialRequestWithDetail> => {
  const doc = await findMaterialRequestById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(MR_NOT_FOUND);
  return doc;
};

export const createMaterialRequest = async (
  ctx: StockContext,
  input: CreateMaterialRequestInput,
): Promise<MaterialRequestDTO> =>
  mapMaterialRequest(
    await createMaterialRequestRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        type: input.type,
        transactionDate: input.transactionDate ?? new Date(),
        requiredBy: input.requiredBy ?? null,
        notes: input.notes ?? null,
      },
      input.items.map((i, index) => ({
        stockItemId: i.stockItemId,
        warehouseId: i.warehouseId ?? null,
        description: i.description ?? null,
        quantity: i.quantity,
        requiredBy: i.requiredBy ?? null,
        sortOrder: index,
      })),
    ),
  );

export const updateMaterialRequest = async (
  ctx: StockContext,
  input: UpdateMaterialRequestInput,
): Promise<MaterialRequestDTO> => {
  const doc = await loadOwnedRequest(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(MR_NOT_DRAFT);
  return mapMaterialRequest(
    await updateMaterialRequestRepo(
      doc.id,
      {
        type: input.type,
        transactionDate: input.transactionDate ?? doc.transactionDate,
        requiredBy: input.requiredBy ?? null,
        notes: input.notes ?? null,
      },
      input.items.map((i, index) => ({
        stockItemId: i.stockItemId,
        warehouseId: i.warehouseId ?? null,
        description: i.description ?? null,
        quantity: i.quantity,
        requiredBy: i.requiredBy ?? null,
        sortOrder: index,
      })),
    ),
  );
};

export const submitMaterialRequest = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedRequest(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(MR_NOT_DRAFT);
  await setMaterialRequestStatus(doc.id, "PENDING", {
    submittedAt: new Date(),
  });
};

/** Stopping parks a request without deleting the need it recorded. */
export const stopMaterialRequest = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedRequest(ctx.restaurantId, input.id);
  if (doc.status === "DRAFT" || doc.status === "CANCELLED") {
    throw new Error(MR_NOT_SUBMITTED);
  }
  await setMaterialRequestStatus(doc.id, "STOPPED");
};

export const cancelMaterialRequest = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedRequest(ctx.restaurantId, input.id);
  await setMaterialRequestStatus(doc.id, "CANCELLED", {
    cancelledAt: new Date(),
  });
};

export const deleteMaterialRequest = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedRequest(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(MR_NOT_DRAFT);
  await deleteDraftMaterialRequest(doc.id);
};

export const getMaterialRequest = async (
  ctx: StockContext,
  id: string,
): Promise<MaterialRequestDTO> =>
  mapMaterialRequest(await loadOwnedRequest(ctx.restaurantId, id));

export const listMaterialRequests = async (
  ctx: StockContext,
): Promise<MaterialRequestListItemDTO[]> => {
  const now = Date.now();
  return (await findMaterialRequests(ctx.restaurantId)).map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    transactionDate: r.transactionDate.toISOString(),
    requiredBy: iso(r.requiredBy),
    itemCount: r.items.length,
    isLate:
      r.requiredBy !== null &&
      r.requiredBy.getTime() < now &&
      !["RECEIVED", "CANCELLED", "STOPPED", "DRAFT"].includes(r.status),
  }));
};

// --------------------------------------------------------- stock entry ---

const mapStockEntry = (e: StockEntryWithDetail): StockEntryDTO => ({
  id: e.id,
  number: e.number,
  purpose: e.purpose,
  status: e.status,
  postingDate: e.postingDate.toISOString(),
  totalValue: num(e.totalValue),
  reason: e.reason,
  notes: e.notes,
  isEditable: e.status === "DRAFT",
  items: e.items.map((i) => ({
    id: i.id,
    stockItemId: i.stockItemId,
    stockItemName: i.stockItem.name,
    unit: i.stockItem.unit as StockUnit,
    fromWarehouseId: i.fromWarehouseId,
    fromWarehouseName: i.fromWarehouse?.name ?? null,
    toWarehouseId: i.toWarehouseId,
    toWarehouseName: i.toWarehouse?.name ?? null,
    quantity: num(i.quantity),
    valuationRate: num(i.valuationRate),
    amount: num(i.amount),
    batchNo: i.batchNo,
  })),
});

const loadOwnedEntry = async (
  restaurantId: string,
  id: string,
): Promise<StockEntryWithDetail> => {
  const doc = await findStockEntryById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(SE_NOT_FOUND);
  return doc;
};

export const createStockEntry = async (
  ctx: StockContext,
  input: CreateStockEntryInput,
): Promise<StockEntryDTO> => {
  const lines = input.items.map((i, index) => ({
    stockItemId: i.stockItemId,
    fromWarehouseId: i.fromWarehouseId ?? null,
    toWarehouseId: i.toWarehouseId ?? null,
    quantity: i.quantity,
    valuationRate: i.valuationRate,
    amount: Math.round(i.quantity * i.valuationRate * 100) / 100,
    batchNo: i.batchNo ?? null,
    sortOrder: index,
  }));
  const totalValue =
    Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;

  return mapStockEntry(
    await createStockEntryRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        purpose: input.purpose,
        postingDate: input.postingDate ?? new Date(),
        totalValue,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
      },
      lines,
    ),
  );
};

export const submitStockEntry = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedEntry(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SE_NOT_DRAFT);
  await submitStockEntryRepo(doc.id, ctx.userId);
};

export const cancelStockEntry = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedEntry(ctx.restaurantId, input.id);
  if (doc.status !== "SUBMITTED") throw new Error(SE_NOT_SUBMITTED);
  await cancelStockEntryRepo(doc.id, ctx.userId);
};

export const deleteStockEntry = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedEntry(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SE_NOT_DRAFT);
  await deleteDraftStockEntry(doc.id);
};

export const getStockEntry = async (
  ctx: StockContext,
  id: string,
): Promise<StockEntryDTO> =>
  mapStockEntry(await loadOwnedEntry(ctx.restaurantId, id));

export const listStockEntries = async (
  ctx: StockContext,
): Promise<StockEntryListItemDTO[]> =>
  (await findStockEntries(ctx.restaurantId)).map((e) => ({
    id: e.id,
    number: e.number,
    purpose: e.purpose,
    status: e.status,
    postingDate: e.postingDate.toISOString(),
    totalValue: num(e.totalValue),
    itemCount: e.items.length,
  }));

// ------------------------------------------------ stock reconciliation ---

const mapReconciliation = (
  r: ReconciliationWithDetail,
): StockReconciliationDTO => ({
  id: r.id,
  number: r.number,
  status: r.status,
  postingDate: r.postingDate.toISOString(),
  differenceValue: num(r.differenceValue),
  reason: r.reason,
  notes: r.notes,
  isEditable: r.status === "DRAFT",
  items: r.items.map((i) => {
    const differenceQty = num(i.differenceQty);
    const valuationRate = num(i.valuationRate);
    return {
      id: i.id,
      stockItemId: i.stockItemId,
      stockItemName: i.stockItem.name,
      unit: i.stockItem.unit as StockUnit,
      warehouseId: i.warehouseId,
      warehouseName: i.warehouse?.name ?? null,
      currentQty: num(i.currentQty),
      countedQty: num(i.countedQty),
      differenceQty,
      valuationRate,
      differenceValue: Math.round(differenceQty * valuationRate * 100) / 100,
    };
  }),
});

const loadOwnedReconciliation = async (
  restaurantId: string,
  id: string,
): Promise<ReconciliationWithDetail> => {
  const doc = await findStockReconciliationById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(RECO_NOT_FOUND);
  return doc;
};

export const createStockReconciliation = async (
  ctx: StockContext,
  input: CreateStockReconciliationInput,
): Promise<StockReconciliationDTO> =>
  mapReconciliation(
    await createStockReconciliationRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        postingDate: input.postingDate ?? new Date(),
        differenceValue: 0,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
      },
      input.items.map((i, index) => ({
        stockItemId: i.stockItemId,
        warehouseId: i.warehouseId ?? null,
        currentQty: 0,
        countedQty: i.countedQty,
        valuationRate: i.valuationRate ?? 0,
        differenceQty: 0,
        sortOrder: index,
      })),
    ),
  );

export const submitStockReconciliation = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedReconciliation(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(RECO_NOT_DRAFT);
  await submitStockReconciliationRepo(doc.id, ctx.userId);
};

export const deleteStockReconciliation = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedReconciliation(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(RECO_NOT_DRAFT);
  await deleteDraftStockReconciliation(doc.id);
};

export const getStockReconciliation = async (
  ctx: StockContext,
  id: string,
): Promise<StockReconciliationDTO> =>
  mapReconciliation(await loadOwnedReconciliation(ctx.restaurantId, id));

export const listStockReconciliations = async (
  ctx: StockContext,
): Promise<StockReconciliationListItemDTO[]> =>
  (await findStockReconciliations(ctx.restaurantId)).map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    postingDate: r.postingDate.toISOString(),
    differenceValue: num(r.differenceValue),
    itemCount: r.items.length,
  }));
