import type { Prisma, Warehouse } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface WarehouseWriteData {
  name: string;
  code: string | null;
  parentId: string | null;
  isGroup: boolean;
  isDefault: boolean;
  addressLine1: string | null;
  city: string | null;
  disabled: boolean;
  notes: string | null;
}

const withParent = {
  parent: { select: { id: true, name: true } },
} satisfies Prisma.WarehouseInclude;

export type WarehouseWithParent = Prisma.WarehouseGetPayload<{
  include: typeof withParent;
}>;

export const createWarehouse = (
  restaurantId: string,
  data: WarehouseWriteData,
): Promise<WarehouseWithParent> =>
  prisma.warehouse.create({
    data: { restaurantId, ...data },
    include: withParent,
  });

export const updateWarehouse = (
  id: string,
  data: WarehouseWriteData,
): Promise<WarehouseWithParent> =>
  prisma.warehouse.update({ where: { id }, data, include: withParent });

export const softDeleteWarehouse = (id: string): Promise<Warehouse> =>
  prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date(), disabled: true },
  });

export const findWarehouseById = (
  id: string,
): Promise<WarehouseWithParent | null> =>
  prisma.warehouse.findUnique({ where: { id }, include: withParent });

export const findWarehouses = (
  restaurantId: string,
  opts: { includeDisabled?: boolean } = {},
): Promise<WarehouseWithParent[]> =>
  prisma.warehouse.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      ...(opts.includeDisabled ? {} : { disabled: false }),
    },
    include: withParent,
    orderBy: [{ isGroup: "desc" }, { name: "asc" }],
  });

export const findDefaultWarehouse = (
  restaurantId: string,
): Promise<Warehouse | null> =>
  prisma.warehouse.findFirst({
    where: { restaurantId, deletedAt: null, isDefault: true, isGroup: false },
  });

/** Only one warehouse can be the default; clear the rest when setting a new one. */
export const clearDefaultWarehouses = (
  restaurantId: string,
  exceptId: string,
): Promise<unknown> =>
  prisma.warehouse.updateMany({
    where: { restaurantId, isDefault: true, id: { not: exceptId } },
    data: { isDefault: false },
  });

export const countStockInWarehouse = (
  warehouseId: string,
): Promise<number> =>
  prisma.bin.count({ where: { warehouseId, actualQty: { not: 0 } } });

/** Per-warehouse roll-up for the warehouse list. */
export const findWarehouseTotals = async (
  restaurantId: string,
): Promise<Map<string, { itemCount: number; stockValue: number }>> => {
  const rows = await prisma.bin.groupBy({
    by: ["warehouseId"],
    where: { restaurantId, actualQty: { not: 0 } },
    _count: { _all: true },
    _sum: { stockValue: true },
  });
  return new Map(
    rows.map((r) => [
      r.warehouseId,
      {
        itemCount: r._count._all,
        stockValue: Number(r._sum.stockValue ?? 0),
      },
    ]),
  );
};

// ------------------------------------------------------------------ bin ---

const binDetail = {
  stockItem: { select: { id: true, name: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.BinInclude;

export type BinWithDetail = Prisma.BinGetPayload<{ include: typeof binDetail }>;

export const findBins = (
  restaurantId: string,
  filter: { warehouseId?: string; stockItemId?: string } = {},
): Promise<BinWithDetail[]> =>
  prisma.bin.findMany({
    where: {
      restaurantId,
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.stockItemId ? { stockItemId: filter.stockItemId } : {}),
    },
    include: binDetail,
    orderBy: [{ warehouse: { name: "asc" } }, { stockItem: { name: "asc" } }],
  });

/**
 * Move a bin's actual quantity by a signed delta, creating the bin on first
 * use. `projectedQty` and `stockValue` are kept in step so nothing has to
 * recompute them at read time.
 */
export const bumpBin = async (
  tx: Prisma.TransactionClient,
  input: {
    restaurantId: string;
    stockItemId: string;
    warehouseId: string;
    delta: number;
    valuationRate?: number;
  },
): Promise<void> => {
  const existing = await tx.bin.findUnique({
    where: {
      stockItemId_warehouseId: {
        stockItemId: input.stockItemId,
        warehouseId: input.warehouseId,
      },
    },
  });

  const rate = input.valuationRate ?? Number(existing?.valuationRate ?? 0);
  const actualQty = Number(existing?.actualQty ?? 0) + input.delta;
  const reserved = Number(existing?.reservedQty ?? 0);
  const ordered = Number(existing?.orderedQty ?? 0);
  const projectedQty = actualQty + ordered - reserved;
  const stockValue = Math.round(actualQty * rate * 100) / 100;

  if (existing) {
    await tx.bin.update({
      where: { id: existing.id },
      data: { actualQty, projectedQty, valuationRate: rate, stockValue },
    });
    return;
  }

  await tx.bin.create({
    data: {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      warehouseId: input.warehouseId,
      actualQty,
      projectedQty,
      valuationRate: rate,
      stockValue,
    },
  });
};

/** What is physically on hand for one item in one warehouse. */
export const binQuantity = async (
  tx: Prisma.TransactionClient,
  stockItemId: string,
  warehouseId: string,
): Promise<number> => {
  const bin = await tx.bin.findUnique({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
    select: { actualQty: true },
  });
  return Number(bin?.actualQty ?? 0);
};

// ---------------------------------------------------------------- batch ---

const batchDetail = {
  stockItem: { select: { id: true, name: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.BatchInclude;

export type BatchWithDetail = Prisma.BatchGetPayload<{
  include: typeof batchDetail;
}>;

export interface BatchWriteData {
  stockItemId: string;
  warehouseId: string | null;
  batchNo: string;
  expiryDate: Date | null;
  manufactureDate: Date | null;
  quantity: number;
  notes: string | null;
}

export const createBatch = (
  restaurantId: string,
  data: BatchWriteData,
): Promise<BatchWithDetail> =>
  prisma.batch.create({
    data: { restaurantId, ...data },
    include: batchDetail,
  });

export const updateBatch = (
  id: string,
  data: BatchWriteData,
): Promise<BatchWithDetail> =>
  prisma.batch.update({ where: { id }, data, include: batchDetail });

export const findBatchById = (id: string): Promise<BatchWithDetail | null> =>
  prisma.batch.findUnique({ where: { id }, include: batchDetail });

export const findBatches = (
  restaurantId: string,
  filter: { stockItemId?: string; expiringBefore?: Date } = {},
): Promise<BatchWithDetail[]> =>
  prisma.batch.findMany({
    where: {
      restaurantId,
      ...(filter.stockItemId ? { stockItemId: filter.stockItemId } : {}),
      ...(filter.expiringBefore
        ? { expiryDate: { not: null, lte: filter.expiringBefore } }
        : {}),
    },
    include: batchDetail,
    orderBy: [{ expiryDate: "asc" }, { batchNo: "asc" }],
  });

export const deleteBatch = (id: string): Promise<void> =>
  prisma.batch.delete({ where: { id } }).then(() => undefined);
