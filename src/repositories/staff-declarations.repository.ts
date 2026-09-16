import { prisma } from "@/lib/prisma";
import { applyMovementInTx } from "@/repositories/stock.repository";

/** Opening checks declared by the kitchen, and breakages declared by the room. */

export const createStockCheck = (input: {
  restaurantId: string;
  staffId: string;
  note: string | null;
  lines: readonly { stockItemId: string; theoreticalQty: number; countedQty: number | null; unitCost: number | null }[];
}) =>
  prisma.stockCheck.create({
    data: {
      restaurantId: input.restaurantId,
      staffId: input.staffId,
      note: input.note,
      lines: { create: input.lines.map((line) => ({ ...line })) },
    },
    select: { id: true },
  });

const checkDetail = {
  id: true,
  checkedAt: true,
  status: true,
  note: true,
  resolvedAt: true,
  staff: { select: { id: true, name: true, role: true } },
  lines: {
    select: {
      id: true,
      theoreticalQty: true,
      countedQty: true,
      unitCost: true,
      stockItem: { select: { id: true, name: true, unit: true, storageLocation: true } },
    },
  },
} as const;

export const findStockChecks = (restaurantId: string, status?: "EN_ATTENTE" | "APPLIQUE" | "REFUSE") =>
  prisma.stockCheck.findMany({
    where: { restaurantId, ...(status ? { status } : {}) },
    orderBy: { checkedAt: "desc" },
    take: 60,
    select: checkDetail,
  });

export const findStockCheckById = (id: string) =>
  prisma.stockCheck.findUnique({ where: { id }, select: { ...checkDetail, restaurantId: true } });

export const countPendingChecks = (restaurantId: string) =>
  prisma.stockCheck.count({ where: { restaurantId, status: "EN_ATTENTE" } });

/**
 * The manager accepts what the kitchen saw: each counted line becomes one
 * correction, written through the single door every stock movement goes
 * through, and the check is closed so it cannot be applied twice.
 */
export const applyStockCheckLines = (input: {
  checkId: string;
  restaurantId: string;
  userId: string;
  staffId: string;
  lines: readonly { stockItemId: string; countedQty: number; unitCost: number | null }[];
}) =>
  prisma.$transaction(async (tx) => {
    for (const line of input.lines) {
      const item = await tx.stockItem.findUniqueOrThrow({ where: { id: line.stockItemId }, select: { onHand: true } });
      const delta = Math.round((line.countedQty - Number(item.onHand)) * 1000) / 1000;
      if (delta === 0) continue;
      await applyMovementInTx(tx, {
        restaurantId: input.restaurantId,
        stockItemId: line.stockItemId,
        type: "CORRECTION",
        delta,
        reason: "Relevé d'ouverture",
        note: null,
        orderId: null,
        unitCost: line.unitCost,
        createdById: input.userId,
        createdByStaffId: input.staffId,
      });
    }
    return tx.stockCheck.update({
      where: { id: input.checkId },
      data: { status: "APPLIQUE", resolvedAt: new Date(), resolvedById: input.userId },
      select: { id: true },
    });
  });

export const dismissStockCheck = (id: string, userId: string) =>
  prisma.stockCheck.update({
    where: { id },
    data: { status: "REFUSE", resolvedAt: new Date(), resolvedById: userId },
    select: { id: true },
  });

// ------------------------------------------------------------- breakages ---

export const createBreakage = (input: {
  restaurantId: string;
  staffId: string | null;
  label: string;
  quantity: number;
  unitValue: number | null;
  value: number;
  reason: string | null;
  note: string | null;
  brokeAt: Date;
}) => prisma.equipmentBreakage.create({ data: input, select: { id: true } });

export const findBreakages = (restaurantId: string, from?: Date, to?: Date) =>
  prisma.equipmentBreakage.findMany({
    where: { restaurantId, ...(from || to ? { brokeAt: { ...(from && { gte: from }), ...(to && { lt: to }) } } : {}) },
    orderBy: { brokeAt: "desc" },
    take: 200,
    select: {
      id: true,
      brokeAt: true,
      label: true,
      quantity: true,
      unitValue: true,
      value: true,
      reason: true,
      note: true,
      staff: { select: { name: true, role: true } },
    },
  });
