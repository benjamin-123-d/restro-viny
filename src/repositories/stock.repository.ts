import type {
  Prisma,
  StockItem,
  StockMovement,
  StockMovementType,
  StockUnit,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface StockItemWriteData {
  name: string;
  unit: StockUnit;
  category: string | null;
  reorderLevel: number | null;
  parLevel: number | null;
  costPerUnit: number | null;
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
}

export const createStockItem = (
  restaurantId: string,
  data: StockItemWriteData,
  openingOnHand: number,
): Promise<StockItem> =>
  prisma.stockItem.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      onHand: openingOnHand,
      ...data,
    },
  });

export const updateStockItem = (
  id: string,
  data: StockItemWriteData,
): Promise<StockItem> =>
  prisma.stockItem.update({ where: { id }, data });

export const reviveStockItem = (
  id: string,
  data: StockItemWriteData,
): Promise<StockItem> =>
  prisma.stockItem.update({
    where: { id },
    data: { ...data, deletedAt: null },
  });

export const softDeleteStockItem = (id: string): Promise<StockItem> =>
  prisma.stockItem.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

export const findStockItemById = (id: string): Promise<StockItem | null> =>
  prisma.stockItem.findUnique({ where: { id } });

export const findStockItemByName = (
  restaurantId: string,
  name: string,
): Promise<StockItem | null> =>
  prisma.stockItem.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findStockItemsByRestaurant = (
  restaurantId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<StockItem[]> =>
  prisma.stockItem.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

export const findMovements = (
  stockItemId: string,
  limit = 50,
): Promise<StockMovement[]> =>
  prisma.stockMovement.findMany({
    where: { stockItemId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

export interface MovementInput {
  restaurantId: string;
  stockItemId: string;
  type: StockMovementType;
  delta: number;
  reason: string | null;
  note: string | null;
  orderId: string | null;
  /// Where the stock moved, once warehouses are in use.
  warehouseId?: string | null;
  /// Set when the movement comes from submitting a purchasing, selling or
  /// stock document — exactly one of these is populated.
  purchaseReceiptItemId?: string | null;
  deliveryNoteItemId?: string | null;
  stockEntryItemId?: string | null;
  stockReconciliationItemId?: string | null;
  createdById: string | null;
}

const writeMovement = (
  tx: Prisma.TransactionClient,
  input: MovementInput,
  resultingOnHand: Prisma.Decimal,
) =>
  tx.stockMovement.create({
    data: {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      type: input.type,
      quantity: input.delta,
      resultingOnHand,
      reason: input.reason,
      note: input.note,
      orderId: input.orderId,
      warehouseId: input.warehouseId ?? null,
      purchaseReceiptItemId: input.purchaseReceiptItemId ?? null,
      deliveryNoteItemId: input.deliveryNoteItemId ?? null,
      stockEntryItemId: input.stockEntryItemId ?? null,
      stockReconciliationItemId: input.stockReconciliationItemId ?? null,
      createdById: input.createdById,
    },
  });

/**
 * Increment on-hand and record the movement inside a caller-supplied
 * transaction. Purchasing calls this so a goods receipt and the stock ledger
 * commit together — there is exactly one implementation of "move stock".
 */
export const applyMovementInTx = async (
  tx: Prisma.TransactionClient,
  input: MovementInput,
): Promise<StockMovement> => {
  const item = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { onHand: { increment: input.delta } },
    select: { onHand: true },
  });
  return writeMovement(tx, input, item.onHand);
};

/** Atomically increment on-hand by a signed delta + record the movement. */
export const applyMovement = (input: MovementInput): Promise<StockMovement> =>
  prisma.$transaction((tx) => applyMovementInTx(tx, input));

/** Apply many signed-delta movements in one transaction (bulk receive / depletion). */
export const applyMovements = (inputs: MovementInput[]): Promise<void> =>
  prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      await applyMovementInTx(tx, input);
    }
  });

export interface CountInput {
  restaurantId: string;
  stockItemId: string;
  countedOnHand: number;
  note: string | null;
  createdById: string;
}

const countInTx = async (
  tx: Prisma.TransactionClient,
  input: CountInput,
): Promise<void> => {
  const before = await tx.stockItem.findUniqueOrThrow({
    where: { id: input.stockItemId },
    select: { onHand: true },
  });
  const delta = input.countedOnHand - Number(before.onHand);
  const item = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { onHand: input.countedOnHand },
    select: { onHand: true },
  });
  await writeMovement(
    tx,
    {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      type: "CORRECTION",
      delta,
      reason: "Physical count",
      note: input.note,
      orderId: null,
      createdById: input.createdById,
    },
    item.onHand,
  );
};

/** Set on-hand for many items to counted values in one transaction. */
export const applyCounts = (inputs: CountInput[]): Promise<void> =>
  prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      await countInTx(tx, input);
    }
  });
