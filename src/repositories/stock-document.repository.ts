import type {
  MaterialRequest,
  MaterialRequestStatus,
  Prisma,
  StockDocStatus,
  StockEntry,
  StockReconciliation,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";
import { applyMovementInTx } from "@/repositories/stock.repository";
import { binQuantity, bumpBin } from "@/repositories/warehouse.repository";

// ----------------------------------------------------- material request ---

export interface MaterialRequestLineWriteData {
  stockItemId: string;
  warehouseId: string | null;
  description: string | null;
  quantity: number;
  requiredBy: Date | null;
  sortOrder: number;
}

export interface MaterialRequestWriteData {
  type: Prisma.MaterialRequestCreateInput["type"];
  transactionDate: Date;
  requiredBy: Date | null;
  notes: string | null;
}

const requestDetail = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: {
      stockItem: { select: { id: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.MaterialRequestInclude;

export type MaterialRequestWithDetail = Prisma.MaterialRequestGetPayload<{
  include: typeof requestDetail;
}>;

export const createMaterialRequest = (
  restaurantId: string,
  requestedById: string,
  data: MaterialRequestWriteData,
  lines: readonly MaterialRequestLineWriteData[],
): Promise<MaterialRequestWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "MREQ", tx);
    return tx.materialRequest.create({
      data: {
        restaurantId,
        requestedById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
      },
      include: requestDetail,
    });
  });

export const updateMaterialRequest = (
  id: string,
  data: MaterialRequestWriteData,
  lines: readonly MaterialRequestLineWriteData[],
): Promise<MaterialRequestWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.materialRequestItem.deleteMany({ where: { materialRequestId: id } });
    return tx.materialRequest.update({
      where: { id },
      data: { ...data, items: { create: lines.map((line) => ({ ...line })) } },
      include: requestDetail,
    });
  });

export const setMaterialRequestStatus = (
  id: string,
  status: MaterialRequestStatus,
  stamps: { submittedAt?: Date; cancelledAt?: Date } = {},
): Promise<MaterialRequest> =>
  prisma.materialRequest.update({ where: { id }, data: { status, ...stamps } });

export const findMaterialRequestById = (
  id: string,
): Promise<MaterialRequestWithDetail | null> =>
  prisma.materialRequest.findUnique({ where: { id }, include: requestDetail });

export const findMaterialRequests = (
  restaurantId: string,
  filter: { status?: readonly MaterialRequestStatus[] } = {},
): Promise<MaterialRequestWithDetail[]> =>
  prisma.materialRequest.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
    },
    include: requestDetail,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftMaterialRequest = (id: string): Promise<void> =>
  prisma.materialRequest.delete({ where: { id } }).then(() => undefined);

// --------------------------------------------------------- stock entry ---

export interface StockEntryLineWriteData {
  stockItemId: string;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  quantity: number;
  valuationRate: number;
  amount: number;
  batchNo: string | null;
  sortOrder: number;
}

export interface StockEntryWriteData {
  purpose: Prisma.StockEntryCreateInput["purpose"];
  postingDate: Date;
  totalValue: number;
  reason: string | null;
  notes: string | null;
}

const entryDetail = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: {
      stockItem: { select: { id: true, name: true, unit: true } },
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.StockEntryInclude;

export type StockEntryWithDetail = Prisma.StockEntryGetPayload<{
  include: typeof entryDetail;
}>;

export const createStockEntry = (
  restaurantId: string,
  createdById: string,
  data: StockEntryWriteData,
  lines: readonly StockEntryLineWriteData[],
): Promise<StockEntryWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "STE", tx);
    return tx.stockEntry.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
      },
      include: entryDetail,
    });
  });

export const findStockEntryById = (
  id: string,
): Promise<StockEntryWithDetail | null> =>
  prisma.stockEntry.findUnique({ where: { id }, include: entryDetail });

export const findStockEntries = (
  restaurantId: string,
  filter: { status?: readonly StockDocStatus[] } = {},
): Promise<StockEntryWithDetail[]> =>
  prisma.stockEntry.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
    },
    include: entryDetail,
    orderBy: [{ postingDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftStockEntry = (id: string): Promise<void> =>
  prisma.stockEntry.delete({ where: { id } }).then(() => undefined);

/**
 * Submit a stock entry. Each line writes ledger movements and moves the bins:
 * an issue takes stock out of its source, a receipt puts it into its target,
 * and a transfer does both — so a transfer never changes the overall on-hand,
 * only where it sits.
 */
export const submitStockEntry = (
  entryId: string,
  createdById: string,
): Promise<StockEntry> =>
  prisma.$transaction(async (tx) => {
    const entry = await tx.stockEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { items: true },
    });

    for (const item of entry.items) {
      const qty = Number(item.quantity);
      if (qty <= 0) continue;
      const rate = Number(item.valuationRate);

      if (item.fromWarehouseId) {
        await applyMovementInTx(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: -qty,
          reason: `Stock entry — ${entry.purpose}`,
          note: entry.number,
          orderId: null,
          warehouseId: item.fromWarehouseId,
          stockEntryItemId: item.id,
          createdById,
        });
        await bumpBin(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: item.fromWarehouseId,
          delta: -qty,
          valuationRate: rate > 0 ? rate : undefined,
        });
      }

      if (item.toWarehouseId) {
        await applyMovementInTx(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          type: item.fromWarehouseId ? "CORRECTION" : "RECEIVE",
          delta: qty,
          reason: `Stock entry — ${entry.purpose}`,
          note: entry.number,
          orderId: null,
          warehouseId: item.toWarehouseId,
          stockEntryItemId: item.id,
          createdById,
        });
        await bumpBin(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: item.toWarehouseId,
          delta: qty,
          valuationRate: rate > 0 ? rate : undefined,
        });
      }
    }

    return tx.stockEntry.update({
      where: { id: entryId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  });

/** Reverse a submitted entry line by line, leaving the original history intact. */
export const cancelStockEntry = (
  entryId: string,
  createdById: string,
): Promise<StockEntry> =>
  prisma.$transaction(async (tx) => {
    const entry = await tx.stockEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { items: true },
    });

    for (const item of entry.items) {
      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      if (item.fromWarehouseId) {
        await applyMovementInTx(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: qty,
          reason: "Stock entry cancelled",
          note: entry.number,
          orderId: null,
          warehouseId: item.fromWarehouseId,
          stockEntryItemId: item.id,
          createdById,
        });
        await bumpBin(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: item.fromWarehouseId,
          delta: qty,
        });
      }

      if (item.toWarehouseId) {
        await applyMovementInTx(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: -qty,
          reason: "Stock entry cancelled",
          note: entry.number,
          orderId: null,
          warehouseId: item.toWarehouseId,
          stockEntryItemId: item.id,
          createdById,
        });
        await bumpBin(tx, {
          restaurantId: entry.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: item.toWarehouseId,
          delta: -qty,
        });
      }
    }

    return tx.stockEntry.update({
      where: { id: entryId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });

// ------------------------------------------------ stock reconciliation ---

export interface ReconciliationLineWriteData {
  stockItemId: string;
  warehouseId: string | null;
  currentQty: number;
  countedQty: number;
  valuationRate: number;
  differenceQty: number;
  sortOrder: number;
}

const reconciliationDetail = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: {
      stockItem: { select: { id: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.StockReconciliationInclude;

export type ReconciliationWithDetail = Prisma.StockReconciliationGetPayload<{
  include: typeof reconciliationDetail;
}>;

export const createStockReconciliation = (
  restaurantId: string,
  createdById: string,
  data: {
    postingDate: Date;
    differenceValue: number;
    reason: string | null;
    notes: string | null;
  },
  lines: readonly ReconciliationLineWriteData[],
): Promise<ReconciliationWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "STRECO", tx);
    return tx.stockReconciliation.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
      },
      include: reconciliationDetail,
    });
  });

export const findStockReconciliationById = (
  id: string,
): Promise<ReconciliationWithDetail | null> =>
  prisma.stockReconciliation.findUnique({
    where: { id },
    include: reconciliationDetail,
  });

export const findStockReconciliations = (
  restaurantId: string,
): Promise<ReconciliationWithDetail[]> =>
  prisma.stockReconciliation.findMany({
    where: { restaurantId },
    include: reconciliationDetail,
    orderBy: [{ postingDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftStockReconciliation = (id: string): Promise<void> =>
  prisma.stockReconciliation.delete({ where: { id } }).then(() => undefined);

/**
 * Submit a count: write the difference as a CORRECTION per line and set the bin
 * to exactly what was counted. The difference is recomputed here against what
 * the bin says now, so a count entered yesterday still lands correctly.
 */
export const submitStockReconciliation = (
  reconciliationId: string,
  createdById: string,
): Promise<StockReconciliation> =>
  prisma.$transaction(async (tx) => {
    const doc = await tx.stockReconciliation.findUniqueOrThrow({
      where: { id: reconciliationId },
      include: { items: true },
    });

    let differenceValue = 0;

    for (const item of doc.items) {
      if (!item.warehouseId) continue;
      const current = await binQuantity(tx, item.stockItemId, item.warehouseId);
      const counted = Number(item.countedQty);
      const delta = counted - current;
      if (delta === 0) continue;

      const rate = Number(item.valuationRate);
      differenceValue += delta * rate;

      await applyMovementInTx(tx, {
        restaurantId: doc.restaurantId,
        stockItemId: item.stockItemId,
        type: "CORRECTION",
        delta,
        reason: "Stock reconciliation",
        note: doc.number,
        orderId: null,
        warehouseId: item.warehouseId,
        stockReconciliationItemId: item.id,
        createdById,
      });
      await bumpBin(tx, {
        restaurantId: doc.restaurantId,
        stockItemId: item.stockItemId,
        warehouseId: item.warehouseId,
        delta,
        valuationRate: rate > 0 ? rate : undefined,
      });
      await tx.stockReconciliationItem.update({
        where: { id: item.id },
        data: { currentQty: current, differenceQty: delta },
      });
    }

    return tx.stockReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        differenceValue: Math.round(differenceValue * 100) / 100,
      },
    });
  });
