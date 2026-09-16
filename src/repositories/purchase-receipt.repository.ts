import type {
  Prisma,
  PurchaseReceipt,
  PurchaseReceiptStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";
import {
  bumpOrderLineReceived,
  recalcPurchaseOrderProgress,
} from "@/repositories/purchase-order.repository";
import { applyMovementInTx, refreshPurchasePriceInTx } from "@/repositories/stock.repository";

export interface PurchaseReceiptLineWriteData {
  stockItemId: string;
  purchaseOrderItemId: string | null;
  description: string | null;
  quantity: number;
  rejectedQuantity: number;
  rate: number;
  taxRate: number;
  amount: number;
  batchNo: string | null;
  expiryDate: Date | null;
  sortOrder: number;
}

export interface PurchaseReceiptWriteData {
  supplierId: string;
  purchaseOrderId: string | null;
  postingDate: Date;
  supplierDeliveryNote: string | null;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  isReturn: boolean;
  returnAgainstId: string | null;
  notes: string | null;
}

const detail = {
  supplier: { select: { id: true, name: true } },
  purchaseOrder: { select: { id: true, number: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.PurchaseReceiptInclude;

export type PurchaseReceiptWithDetail = Prisma.PurchaseReceiptGetPayload<{
  include: typeof detail;
}>;

const listSelect = {
  id: true,
  number: true,
  status: true,
  postingDate: true,
  grandTotal: true,
  billedPercent: true,
  isReturn: true,
  supplier: { select: { name: true } },
} satisfies Prisma.PurchaseReceiptSelect;

export type PurchaseReceiptListRow = Prisma.PurchaseReceiptGetPayload<{
  select: typeof listSelect;
}>;

export const createPurchaseReceipt = (
  restaurantId: string,
  createdById: string,
  data: PurchaseReceiptWriteData,
  lines: readonly PurchaseReceiptLineWriteData[],
): Promise<PurchaseReceiptWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "PREC", tx);
    return tx.purchaseReceipt.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
      },
      include: detail,
    });
  });

export const findPurchaseReceiptById = (
  id: string,
): Promise<PurchaseReceiptWithDetail | null> =>
  prisma.purchaseReceipt.findUnique({ where: { id }, include: detail });

export interface PurchaseReceiptFilter {
  readonly status?: readonly PurchaseReceiptStatus[];
  readonly supplierId?: string;
  readonly purchaseOrderId?: string;
  readonly take?: number;
}

export const findPurchaseReceipts = (
  restaurantId: string,
  filter: PurchaseReceiptFilter = {},
): Promise<PurchaseReceiptListRow[]> =>
  prisma.purchaseReceipt.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.purchaseOrderId
        ? { purchaseOrderId: filter.purchaseOrderId }
        : {}),
    },
    select: listSelect,
    orderBy: [{ postingDate: "desc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

export const deleteDraftPurchaseReceipt = (id: string): Promise<void> =>
  prisma.purchaseReceipt.delete({ where: { id } }).then(() => undefined);

/**
 * Submit a goods receipt: move the stock, advance the order, stamp the status —
 * all in one transaction, so stock can never rise without the receipt that
 * justifies it (or the reverse).
 *
 * Stock moves through `applyMovementInTx`, the same primitive the manual
 * receive and count flows use, so there is one ledger and one on-hand rule.
 * `costPerUnit` is refreshed to the price actually paid, which is what the
 * inventory screens and recipe costing read.
 */
export const submitPurchaseReceipt = (
  receiptId: string,
  createdById: string,
): Promise<PurchaseReceipt> =>
  prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseReceipt.findUniqueOrThrow({
      where: { id: receiptId },
      include: { items: true },
    });

    for (const item of receipt.items) {
      const accepted = Number(item.quantity);
      if (accepted === 0) continue;

      // A return sends goods back out; a normal receipt brings them in.
      const delta = receipt.isReturn ? -accepted : accepted;
      // The price paid refreshes the item's cost before the stock comes in, so
      // the movement carries the cost it arrived at.
      const unitCost =
        !receipt.isReturn && Number(item.rate) > 0
          ? await refreshPurchasePriceInTx(tx, item.stockItemId, Number(item.rate))
          : null;

      await applyMovementInTx(tx, {
        restaurantId: receipt.restaurantId,
        stockItemId: item.stockItemId,
        type: "RECEIVE",
        delta,
        reason: receipt.isReturn ? "Retour fournisseur" : "Réception",
        note: receipt.number,
        orderId: null,
        purchaseReceiptItemId: item.id,
        unitCost,
        createdById,
      });

      if (item.purchaseOrderItemId) {
        await bumpOrderLineReceived(tx, item.purchaseOrderItemId, delta);
      }
    }

    if (receipt.purchaseOrderId) {
      await recalcPurchaseOrderProgress(tx, receipt.purchaseOrderId);
    }

    return tx.purchaseReceipt.update({
      where: { id: receiptId },
      data: {
        status: receipt.isReturn ? "RETURN" : "TO_BILL",
        submittedAt: new Date(),
      },
    });
  });

/**
 * Cancel a submitted receipt by reversing exactly what it did — a compensating
 * CORRECTION movement per line, rather than deleting ledger history.
 */
export const cancelPurchaseReceipt = (
  receiptId: string,
  createdById: string,
): Promise<PurchaseReceipt> =>
  prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseReceipt.findUniqueOrThrow({
      where: { id: receiptId },
      include: { items: true },
    });

    for (const item of receipt.items) {
      const accepted = Number(item.quantity);
      if (accepted === 0) continue;
      const reversal = receipt.isReturn ? accepted : -accepted;

      await applyMovementInTx(tx, {
        restaurantId: receipt.restaurantId,
        stockItemId: item.stockItemId,
        type: "CORRECTION",
        delta: reversal,
        reason: "Réception annulée",
        note: receipt.number,
        orderId: null,
        purchaseReceiptItemId: item.id,
        createdById,
      });

      if (item.purchaseOrderItemId) {
        await bumpOrderLineReceived(tx, item.purchaseOrderItemId, reversal);
      }
    }

    if (receipt.purchaseOrderId) {
      await recalcPurchaseOrderProgress(tx, receipt.purchaseOrderId);
    }

    return tx.purchaseReceipt.update({
      where: { id: receiptId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });

/** Recompute how much of a receipt has been billed, after an invoice moves. */
export const recalcReceiptBilled = async (
  tx: Prisma.TransactionClient,
  purchaseReceiptId: string,
): Promise<number> => {
  const items = await tx.purchaseReceiptItem.findMany({
    where: { purchaseReceiptId },
    select: { quantity: true, billedQty: true },
  });
  const received = items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const billed = items.reduce((sum, i) => sum + Number(i.billedQty), 0);
  const billedPercent =
    received <= 0
      ? 0
      : Math.round(Math.min(100, (billed / received) * 100) * 100) / 100;
  const status: PurchaseReceiptStatus =
    billedPercent >= 99.99
      ? "COMPLETED"
      : billedPercent > 0
        ? "PARTLY_BILLED"
        : "TO_BILL";
  await tx.purchaseReceipt.update({
    where: { id: purchaseReceiptId },
    data: { billedPercent, status },
  });
  return billedPercent;
};

export const bumpReceiptLineBilled = (
  tx: Prisma.TransactionClient,
  purchaseReceiptItemId: string,
  delta: number,
): Promise<unknown> =>
  tx.purchaseReceiptItem.update({
    where: { id: purchaseReceiptItemId },
    data: { billedQty: { increment: delta } },
  });

/** Lines of an order still awaiting delivery, for pre-filling a receipt. */
export const findOutstandingOrderLines = (purchaseOrderId: string) =>
  prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  });
