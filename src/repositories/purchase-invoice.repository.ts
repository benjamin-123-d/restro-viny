import type {
  Prisma,
  PurchaseInvoice,
  PurchaseInvoiceStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";
import {
  bumpOrderLineBilled,
  recalcPurchaseOrderProgress,
} from "@/repositories/purchase-order.repository";
import {
  bumpReceiptLineBilled,
  recalcReceiptBilled,
} from "@/repositories/purchase-receipt.repository";
import { applyMovementInTx } from "@/repositories/stock.repository";

export interface PurchaseInvoiceLineWriteData {
  stockItemId: string;
  purchaseOrderItemId: string | null;
  purchaseReceiptItemId: string | null;
  description: string | null;
  quantity: number;
  rate: number;
  discountPercent: number | null;
  taxRate: number;
  amount: number;
  sortOrder: number;
}

export interface PurchaseScheduleWriteData {
  dueDate: Date;
  invoicePortion: number;
  amount: number;
  sortOrder: number;
}

export interface PurchaseInvoiceWriteData {
  supplierId: string;
  supplierInvoiceNo: string | null;
  purchaseOrderId: string | null;
  purchaseReceiptId: string | null;
  postingDate: Date;
  dueDate: Date;
  currency: string | null;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  outstandingAmount: number;
  updateStock: boolean;
  isReturn: boolean;
  returnAgainstId: string | null;
  notes: string | null;
  termsText: string | null;
}

const detail = {
  supplier: { select: { id: true, name: true } },
  purchaseOrder: { select: { id: true, number: true } },
  purchaseReceipt: { select: { id: true, number: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  },
  schedule: { orderBy: { sortOrder: "asc" } },
  allocations: {
    include: {
      supplierPayment: {
        select: {
          id: true,
          number: true,
          paymentDate: true,
          mode: true,
        },
      },
    },
  },
} satisfies Prisma.PurchaseInvoiceInclude;

export type PurchaseInvoiceWithDetail = Prisma.PurchaseInvoiceGetPayload<{
  include: typeof detail;
}>;

const listSelect = {
  id: true,
  number: true,
  supplierInvoiceNo: true,
  status: true,
  postingDate: true,
  dueDate: true,
  grandTotal: true,
  outstandingAmount: true,
  supplier: { select: { name: true } },
} satisfies Prisma.PurchaseInvoiceSelect;

export type PurchaseInvoiceListRow = Prisma.PurchaseInvoiceGetPayload<{
  select: typeof listSelect;
}>;

export const createPurchaseInvoice = (
  restaurantId: string,
  createdById: string,
  data: PurchaseInvoiceWriteData,
  lines: readonly PurchaseInvoiceLineWriteData[],
  schedule: readonly PurchaseScheduleWriteData[],
): Promise<PurchaseInvoiceWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "PINV", tx);
    return tx.purchaseInvoice.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
        schedule: { create: schedule.map((row) => ({ ...row })) },
      },
      include: detail,
    });
  });

export const findPurchaseInvoiceById = (
  id: string,
): Promise<PurchaseInvoiceWithDetail | null> =>
  prisma.purchaseInvoice.findUnique({ where: { id }, include: detail });

export interface PurchaseInvoiceFilter {
  readonly status?: readonly PurchaseInvoiceStatus[];
  readonly supplierId?: string;
  readonly overdueOn?: Date;
  readonly take?: number;
}

export const findPurchaseInvoices = (
  restaurantId: string,
  filter: PurchaseInvoiceFilter = {},
): Promise<PurchaseInvoiceListRow[]> =>
  prisma.purchaseInvoice.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.overdueOn
        ? {
            dueDate: { lt: filter.overdueOn },
            status: { in: ["UNPAID", "PARTLY_PAID", "OVERDUE"] },
          }
        : {}),
    },
    select: listSelect,
    orderBy: [{ dueDate: "asc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

/** Unsettled bills for a supplier, oldest first — the payment allocation list. */
export const findPayableInvoices = (
  restaurantId: string,
  supplierId: string,
): Promise<PurchaseInvoiceListRow[]> =>
  prisma.purchaseInvoice.findMany({
    where: {
      restaurantId,
      supplierId,
      isReturn: false,
      status: { in: ["UNPAID", "PARTLY_PAID", "OVERDUE"] },
      outstandingAmount: { gt: 0 },
    },
    select: listSelect,
    orderBy: [{ dueDate: "asc" }],
  });

export const deleteDraftPurchaseInvoice = (id: string): Promise<void> =>
  prisma.purchaseInvoice.delete({ where: { id } }).then(() => undefined);

/**
 * Submit a supplier bill: advance the order and receipt it bills, optionally
 * move stock when there was no receipt, and open the payable.
 */
export const submitPurchaseInvoice = (
  invoiceId: string,
  createdById: string,
): Promise<PurchaseInvoice> =>
  prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: true },
    });

    const touchedReceipts = new Set<string>();

    for (const item of invoice.items) {
      const qty = Number(item.quantity);
      const delta = invoice.isReturn ? -qty : qty;

      if (item.purchaseOrderItemId) {
        await bumpOrderLineBilled(tx, item.purchaseOrderItemId, delta);
      }
      if (item.purchaseReceiptItemId) {
        await bumpReceiptLineBilled(tx, item.purchaseReceiptItemId, delta);
        const line = await tx.purchaseReceiptItem.findUniqueOrThrow({
          where: { id: item.purchaseReceiptItemId },
          select: { purchaseReceiptId: true },
        });
        touchedReceipts.add(line.purchaseReceiptId);
      }

      // No receipt in the chain: the bill itself is what brings stock in.
      if (invoice.updateStock && qty > 0) {
        await applyMovementInTx(tx, {
          restaurantId: invoice.restaurantId,
          stockItemId: item.stockItemId,
          type: "RECEIVE",
          delta,
          reason: invoice.isReturn ? "Purchase return" : "Purchase invoice",
          note: invoice.number,
          orderId: null,
          purchaseReceiptItemId: null,
          createdById,
        });
        if (!invoice.isReturn && Number(item.rate) > 0) {
          await tx.stockItem.update({
            where: { id: item.stockItemId },
            data: { costPerUnit: item.rate },
          });
        }
      }
    }

    for (const receiptId of touchedReceipts) {
      await recalcReceiptBilled(tx, receiptId);
    }
    if (invoice.purchaseOrderId) {
      await recalcPurchaseOrderProgress(tx, invoice.purchaseOrderId);
    }

    return tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        status: invoice.isReturn ? "RETURN" : "UNPAID",
        outstandingAmount: invoice.grandTotal,
        submittedAt: new Date(),
      },
    });
  });

/** Reverse everything a submitted bill did, without deleting its history. */
export const cancelPurchaseInvoice = (
  invoiceId: string,
  createdById: string,
): Promise<PurchaseInvoice> =>
  prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: true },
    });

    const touchedReceipts = new Set<string>();

    for (const item of invoice.items) {
      const qty = Number(item.quantity);
      const reversal = invoice.isReturn ? qty : -qty;

      if (item.purchaseOrderItemId) {
        await bumpOrderLineBilled(tx, item.purchaseOrderItemId, reversal);
      }
      if (item.purchaseReceiptItemId) {
        await bumpReceiptLineBilled(tx, item.purchaseReceiptItemId, reversal);
        const line = await tx.purchaseReceiptItem.findUniqueOrThrow({
          where: { id: item.purchaseReceiptItemId },
          select: { purchaseReceiptId: true },
        });
        touchedReceipts.add(line.purchaseReceiptId);
      }

      if (invoice.updateStock && qty > 0) {
        await applyMovementInTx(tx, {
          restaurantId: invoice.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: reversal,
          reason: "Purchase invoice cancelled",
          note: invoice.number,
          orderId: null,
          purchaseReceiptItemId: null,
          createdById,
        });
      }
    }

    for (const receiptId of touchedReceipts) {
      await recalcReceiptBilled(tx, receiptId);
    }
    if (invoice.purchaseOrderId) {
      await recalcPurchaseOrderProgress(tx, invoice.purchaseOrderId);
    }

    return tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        outstandingAmount: 0,
        cancelledAt: new Date(),
      },
    });
  });

/** Re-stamp status and outstanding for invoices whose due date has passed. */
export const markOverdueInvoices = (
  restaurantId: string,
  now: Date,
): Promise<{ count: number }> =>
  prisma.purchaseInvoice.updateMany({
    where: {
      restaurantId,
      status: { in: ["UNPAID", "PARTLY_PAID"] },
      dueDate: { lt: now },
      outstandingAmount: { gt: 0 },
    },
    data: { status: "OVERDUE" },
  });
