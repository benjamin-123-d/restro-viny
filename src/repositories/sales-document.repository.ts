import type {
  DeliveryNote,
  DeliveryNoteStatus,
  Prisma,
  QuotationStatus,
  SalesInvoice,
  SalesInvoiceStatus,
  SalesOrder,
  SalesOrderStatus,
  SalesQuotation,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";
import { applyMovementInTx } from "@/repositories/stock.repository";
import { binQuantity, bumpBin } from "@/repositories/warehouse.repository";
import { INSUFFICIENT_STOCK } from "@/repositories/stock-document.repository";

const lineItem = {
  stockItem: { select: { id: true, name: true, unit: true } },
  menuItem: { select: { id: true, name: true } },
};

// ------------------------------------------------------------ quotation ---

export interface SalesLineWriteData {
  menuItemId: string | null;
  stockItemId: string | null;
  itemName: string;
  description: string | null;
  quantity: number;
  rate: number;
  discountPercent: number | null;
  taxRate: number;
  amount: number;
  sortOrder: number;
}

export interface SalesQuotationWriteData {
  customerId: string;
  transactionDate: Date;
  validUntil: Date | null;
  currency: string | null;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  notes: string | null;
  termsText: string | null;
}

const quotationDetail = {
  customer: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" }, include: lineItem },
} satisfies Prisma.SalesQuotationInclude;

export type SalesQuotationWithDetail = Prisma.SalesQuotationGetPayload<{
  include: typeof quotationDetail;
}>;

export const createSalesQuotation = (
  restaurantId: string,
  createdById: string,
  data: SalesQuotationWriteData,
  lines: readonly SalesLineWriteData[],
): Promise<SalesQuotationWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "SQTE", tx);
    return tx.salesQuotation.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((l) => ({ ...l })) },
      },
      include: quotationDetail,
    });
  });

export const updateSalesQuotation = (
  id: string,
  data: SalesQuotationWriteData,
  lines: readonly SalesLineWriteData[],
): Promise<SalesQuotationWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.salesQuotationItem.deleteMany({ where: { quotationId: id } });
    return tx.salesQuotation.update({
      where: { id },
      data: { ...data, items: { create: lines.map((l) => ({ ...l })) } },
      include: quotationDetail,
    });
  });

export const setQuotationStatus = (
  id: string,
  status: QuotationStatus,
  stamps: { submittedAt?: Date; cancelledAt?: Date; lostReason?: string } = {},
): Promise<SalesQuotation> =>
  prisma.salesQuotation.update({ where: { id }, data: { status, ...stamps } });

export const findSalesQuotationById = (
  id: string,
): Promise<SalesQuotationWithDetail | null> =>
  prisma.salesQuotation.findUnique({ where: { id }, include: quotationDetail });

export const findSalesQuotations = (
  restaurantId: string,
  filter: { status?: readonly QuotationStatus[]; customerId?: string } = {},
): Promise<SalesQuotationWithDetail[]> =>
  prisma.salesQuotation.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    include: quotationDetail,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftSalesQuotation = (id: string): Promise<void> =>
  prisma.salesQuotation.delete({ where: { id } }).then(() => undefined);

// ---------------------------------------------------------- sales order ---

export interface SalesOrderWriteData {
  customerId: string;
  quotationId: string | null;
  transactionDate: Date;
  deliveryDate: Date | null;
  poNumber: string | null;
  currency: string | null;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  notes: string | null;
  termsText: string | null;
}

export interface SalesOrderLineWriteData extends SalesLineWriteData {
  salesQuotationItemId: string | null;
  deliveryDate: Date | null;
}

const orderDetail = {
  customer: { select: { id: true, name: true } },
  quotation: { select: { id: true, number: true } },
  items: { orderBy: { sortOrder: "asc" }, include: lineItem },
} satisfies Prisma.SalesOrderInclude;

export type SalesOrderWithDetail = Prisma.SalesOrderGetPayload<{
  include: typeof orderDetail;
}>;

export const createSalesOrder = (
  restaurantId: string,
  createdById: string,
  data: SalesOrderWriteData,
  lines: readonly SalesOrderLineWriteData[],
): Promise<SalesOrderWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "SO", tx);
    return tx.salesOrder.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((l) => ({ ...l })) },
      },
      include: orderDetail,
    });
  });

export const updateSalesOrder = (
  id: string,
  data: SalesOrderWriteData,
  lines: readonly SalesOrderLineWriteData[],
): Promise<SalesOrderWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    return tx.salesOrder.update({
      where: { id },
      data: { ...data, items: { create: lines.map((l) => ({ ...l })) } },
      include: orderDetail,
    });
  });

export const setSalesOrderStatus = (
  id: string,
  status: SalesOrderStatus,
  stamps: {
    submittedAt?: Date;
    cancelledAt?: Date;
    closedAt?: Date | null;
    holdComment?: string | null;
  } = {},
): Promise<SalesOrder> =>
  prisma.salesOrder.update({ where: { id }, data: { status, ...stamps } });

export const findSalesOrderById = (
  id: string,
): Promise<SalesOrderWithDetail | null> =>
  prisma.salesOrder.findUnique({ where: { id }, include: orderDetail });

export const findSalesOrders = (
  restaurantId: string,
  filter: { status?: readonly SalesOrderStatus[]; customerId?: string } = {},
): Promise<SalesOrderWithDetail[]> =>
  prisma.salesOrder.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    include: orderDetail,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftSalesOrder = (id: string): Promise<void> =>
  prisma.salesOrder.delete({ where: { id } }).then(() => undefined);

/** Roll line delivered/billed quantities up into the order's percentages. */
export const recalcSalesOrderProgress = async (
  tx: Prisma.TransactionClient,
  salesOrderId: string,
): Promise<void> => {
  const items = await tx.salesOrderItem.findMany({
    where: { salesOrderId },
    select: { quantity: true, deliveredQty: true, billedQty: true },
  });
  const ordered = items.reduce((s, i) => s + Number(i.quantity), 0);
  const delivered = items.reduce((s, i) => s + Number(i.deliveredQty), 0);
  const billed = items.reduce((s, i) => s + Number(i.billedQty), 0);
  const pct = (done: number): number =>
    ordered <= 0
      ? 0
      : Math.round(Math.min(100, (done / ordered) * 100) * 100) / 100;
  await tx.salesOrder.update({
    where: { id: salesOrderId },
    data: { deliveredPercent: pct(delivered), billedPercent: pct(billed) },
  });
};

// -------------------------------------------------------- delivery note ---

export interface DeliveryLineWriteData {
  salesOrderItemId: string | null;
  menuItemId: string | null;
  stockItemId: string | null;
  itemName: string;
  description: string | null;
  quantity: number;
  rate: number;
  taxRate: number;
  amount: number;
  batchNo: string | null;
  sortOrder: number;
}

export interface DeliveryNoteWriteData {
  customerId: string;
  salesOrderId: string | null;
  warehouseId: string | null;
  postingDate: Date;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  isReturn: boolean;
  returnAgainstId: string | null;
  driverName: string | null;
  vehicleNo: string | null;
  notes: string | null;
}

const deliveryDetail = {
  customer: { select: { id: true, name: true } },
  salesOrder: { select: { id: true, number: true } },
  warehouse: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" }, include: lineItem },
} satisfies Prisma.DeliveryNoteInclude;

export type DeliveryNoteWithDetail = Prisma.DeliveryNoteGetPayload<{
  include: typeof deliveryDetail;
}>;

export const createDeliveryNote = (
  restaurantId: string,
  createdById: string,
  data: DeliveryNoteWriteData,
  lines: readonly DeliveryLineWriteData[],
): Promise<DeliveryNoteWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "DN", tx);
    return tx.deliveryNote.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((l) => ({ ...l })) },
      },
      include: deliveryDetail,
    });
  });

export const findDeliveryNoteById = (
  id: string,
): Promise<DeliveryNoteWithDetail | null> =>
  prisma.deliveryNote.findUnique({ where: { id }, include: deliveryDetail });

export const findDeliveryNotes = (
  restaurantId: string,
  filter: { status?: readonly DeliveryNoteStatus[]; customerId?: string } = {},
): Promise<DeliveryNoteWithDetail[]> =>
  prisma.deliveryNote.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    include: deliveryDetail,
    orderBy: [{ postingDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftDeliveryNote = (id: string): Promise<void> =>
  prisma.deliveryNote.delete({ where: { id } }).then(() => undefined);

/**
 * Submit a delivery: stock leaves the warehouse it shipped from, the order it
 * fulfils advances, and the note opens for billing — one transaction, so goods
 * never leave without the paperwork that says so.
 */
export const submitDeliveryNote = (
  noteId: string,
  createdById: string,
): Promise<DeliveryNote> =>
  prisma.$transaction(async (tx) => {
    const note = await tx.deliveryNote.findUniqueOrThrow({
      where: { id: noteId },
      include: { items: true },
    });

    for (const item of note.items) {
      const qty = Number(item.quantity);
      if (qty <= 0 || !item.stockItemId) continue;

      // A delivery issues stock; a sales return brings it back.
      const delta = note.isReturn ? qty : -qty;

      if (!note.isReturn && note.warehouseId) {
        const available = await binQuantity(tx, item.stockItemId, note.warehouseId);
        if (available < qty) {
          throw new Error(INSUFFICIENT_STOCK);
        }
      }

      await applyMovementInTx(tx, {
        restaurantId: note.restaurantId,
        stockItemId: item.stockItemId,
        type: "CORRECTION",
        delta,
        reason: note.isReturn ? "Retour client" : "Bon de livraison",
        note: note.number,
        orderId: null,
        warehouseId: note.warehouseId,
        deliveryNoteItemId: item.id,
        createdById,
      });

      if (note.warehouseId) {
        await bumpBin(tx, {
          restaurantId: note.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: note.warehouseId,
          delta,
        });
      }

      if (item.salesOrderItemId) {
        await tx.salesOrderItem.update({
          where: { id: item.salesOrderItemId },
          data: { deliveredQty: { increment: delta } },
        });
      }
    }

    if (note.salesOrderId) {
      await recalcSalesOrderProgress(tx, note.salesOrderId);
    }

    return tx.deliveryNote.update({
      where: { id: noteId },
      data: {
        status: note.isReturn ? "RETURN" : "TO_BILL",
        submittedAt: new Date(),
      },
    });
  });

export const cancelDeliveryNote = (
  noteId: string,
  createdById: string,
): Promise<DeliveryNote> =>
  prisma.$transaction(async (tx) => {
    const note = await tx.deliveryNote.findUniqueOrThrow({
      where: { id: noteId },
      include: { items: true },
    });

    for (const item of note.items) {
      const qty = Number(item.quantity);
      if (qty <= 0 || !item.stockItemId) continue;
      const reversal = note.isReturn ? -qty : qty;

      await applyMovementInTx(tx, {
        restaurantId: note.restaurantId,
        stockItemId: item.stockItemId,
        type: "CORRECTION",
        delta: reversal,
        reason: "Bon de livraison annulé",
        note: note.number,
        orderId: null,
        warehouseId: note.warehouseId,
        deliveryNoteItemId: item.id,
        createdById,
      });

      if (note.warehouseId) {
        await bumpBin(tx, {
          restaurantId: note.restaurantId,
          stockItemId: item.stockItemId,
          warehouseId: note.warehouseId,
          delta: reversal,
        });
      }

      if (item.salesOrderItemId) {
        await tx.salesOrderItem.update({
          where: { id: item.salesOrderItemId },
          data: { deliveredQty: { increment: reversal } },
        });
      }
    }

    if (note.salesOrderId) {
      await recalcSalesOrderProgress(tx, note.salesOrderId);
    }

    return tx.deliveryNote.update({
      where: { id: noteId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });

export const recalcDeliveryBilled = async (
  tx: Prisma.TransactionClient,
  deliveryNoteId: string,
): Promise<void> => {
  const items = await tx.deliveryNoteItem.findMany({
    where: { deliveryNoteId },
    select: { quantity: true, billedQty: true },
  });
  const delivered = items.reduce((s, i) => s + Number(i.quantity), 0);
  const billed = items.reduce((s, i) => s + Number(i.billedQty), 0);
  const billedPercent =
    delivered <= 0
      ? 0
      : Math.round(Math.min(100, (billed / delivered) * 100) * 100) / 100;
  const status: DeliveryNoteStatus =
    billedPercent >= 99.99
      ? "COMPLETED"
      : billedPercent > 0
        ? "PARTLY_BILLED"
        : "TO_BILL";
  await tx.deliveryNote.update({
    where: { id: deliveryNoteId },
    data: { billedPercent, status },
  });
};

// -------------------------------------------------------- sales invoice ---

export interface SalesInvoiceLineWriteData extends SalesLineWriteData {
  salesOrderItemId: string | null;
  deliveryNoteItemId: string | null;
}

export interface SalesInvoiceWriteData {
  customerId: string;
  salesOrderId: string | null;
  deliveryNoteId: string | null;
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

const invoiceDetail = {
  customer: { select: { id: true, name: true } },
  salesOrder: { select: { id: true, number: true } },
  deliveryNote: { select: { id: true, number: true } },
  items: { orderBy: { sortOrder: "asc" }, include: lineItem },
  schedule: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.SalesInvoiceInclude;

export type SalesInvoiceWithDetail = Prisma.SalesInvoiceGetPayload<{
  include: typeof invoiceDetail;
}>;

export const createSalesInvoice = (
  restaurantId: string,
  createdById: string,
  data: SalesInvoiceWriteData,
  lines: readonly SalesInvoiceLineWriteData[],
  schedule: readonly {
    dueDate: Date;
    invoicePortion: number;
    amount: number;
    sortOrder: number;
  }[],
): Promise<SalesInvoiceWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "SINV", tx);
    return tx.salesInvoice.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((l) => ({ ...l })) },
        schedule: { create: schedule.map((s) => ({ ...s })) },
      },
      include: invoiceDetail,
    });
  });

export const findSalesInvoiceById = (
  id: string,
): Promise<SalesInvoiceWithDetail | null> =>
  prisma.salesInvoice.findUnique({ where: { id }, include: invoiceDetail });

export const findSalesInvoices = (
  restaurantId: string,
  filter: { status?: readonly SalesInvoiceStatus[]; customerId?: string } = {},
): Promise<SalesInvoiceWithDetail[]> =>
  prisma.salesInvoice.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    include: invoiceDetail,
    orderBy: [{ dueDate: "asc" }, { number: "desc" }],
  });

export const findReceivableInvoices = (
  restaurantId: string,
  customerId: string,
): Promise<SalesInvoiceWithDetail[]> =>
  prisma.salesInvoice.findMany({
    where: {
      restaurantId,
      customerId,
      isReturn: false,
      status: { in: ["UNPAID", "PARTLY_PAID", "OVERDUE"] },
      outstandingAmount: { gt: 0 },
    },
    include: invoiceDetail,
    orderBy: { dueDate: "asc" },
  });

export const deleteDraftSalesInvoice = (id: string): Promise<void> =>
  prisma.salesInvoice.delete({ where: { id } }).then(() => undefined);

export const submitSalesInvoice = (
  invoiceId: string,
  createdById: string,
): Promise<SalesInvoice> =>
  prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: true },
    });

    const touchedNotes = new Set<string>();

    for (const item of invoice.items) {
      const qty = Number(item.quantity);
      const delta = invoice.isReturn ? -qty : qty;

      if (item.salesOrderItemId) {
        await tx.salesOrderItem.update({
          where: { id: item.salesOrderItemId },
          data: { billedQty: { increment: delta } },
        });
      }
      if (item.deliveryNoteItemId) {
        await tx.deliveryNoteItem.update({
          where: { id: item.deliveryNoteItemId },
          data: { billedQty: { increment: delta } },
        });
        const line = await tx.deliveryNoteItem.findUniqueOrThrow({
          where: { id: item.deliveryNoteItemId },
          select: { deliveryNoteId: true },
        });
        touchedNotes.add(line.deliveryNoteId);
      }

      // Nothing was delivered on a note: the invoice itself issues the stock.
      if (invoice.updateStock && qty > 0 && item.stockItemId) {
        await applyMovementInTx(tx, {
          restaurantId: invoice.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: invoice.isReturn ? qty : -qty,
          reason: invoice.isReturn ? "Retour client" : "Facture client",
          note: invoice.number,
          orderId: null,
          createdById,
        });
      }
    }

    for (const noteId of touchedNotes) {
      await recalcDeliveryBilled(tx, noteId);
    }
    if (invoice.salesOrderId) {
      await recalcSalesOrderProgress(tx, invoice.salesOrderId);
    }

    return tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: invoice.isReturn ? "RETURN" : "UNPAID",
        outstandingAmount: invoice.grandTotal,
        submittedAt: new Date(),
      },
    });
  });

export const cancelSalesInvoice = (
  invoiceId: string,
  createdById: string,
): Promise<SalesInvoice> =>
  prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: true },
    });

    const touchedNotes = new Set<string>();

    for (const item of invoice.items) {
      const qty = Number(item.quantity);
      const reversal = invoice.isReturn ? qty : -qty;

      if (item.salesOrderItemId) {
        await tx.salesOrderItem.update({
          where: { id: item.salesOrderItemId },
          data: { billedQty: { increment: reversal } },
        });
      }
      if (item.deliveryNoteItemId) {
        await tx.deliveryNoteItem.update({
          where: { id: item.deliveryNoteItemId },
          data: { billedQty: { increment: reversal } },
        });
        const line = await tx.deliveryNoteItem.findUniqueOrThrow({
          where: { id: item.deliveryNoteItemId },
          select: { deliveryNoteId: true },
        });
        touchedNotes.add(line.deliveryNoteId);
      }

      if (invoice.updateStock && qty > 0 && item.stockItemId) {
        await applyMovementInTx(tx, {
          restaurantId: invoice.restaurantId,
          stockItemId: item.stockItemId,
          type: "CORRECTION",
          delta: invoice.isReturn ? -qty : qty,
          reason: "Facture client annulée",
          note: invoice.number,
          orderId: null,
          createdById,
        });
      }
    }

    for (const noteId of touchedNotes) {
      await recalcDeliveryBilled(tx, noteId);
    }
    if (invoice.salesOrderId) {
      await recalcSalesOrderProgress(tx, invoice.salesOrderId);
    }

    return tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        outstandingAmount: 0,
        cancelledAt: new Date(),
      },
    });
  });

// ---------------------------------------------------- customer payment ---

const paymentDetail = {
  customer: { select: { id: true, name: true } },
  allocations: {
    include: { salesInvoice: { select: { id: true, number: true } } },
  },
} satisfies Prisma.CustomerPaymentInclude;

export type CustomerPaymentWithDetail = Prisma.CustomerPaymentGetPayload<{
  include: typeof paymentDetail;
}>;

/** Re-derive a bill's settlement from the allocations that exist right now. */
export const recalcSalesInvoiceSettlement = async (
  tx: Prisma.TransactionClient,
  salesInvoiceId: string,
  now: Date,
): Promise<void> => {
  const invoice = await tx.salesInvoice.findUniqueOrThrow({
    where: { id: salesInvoiceId },
    select: { grandTotal: true, dueDate: true, status: true },
  });
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return;

  const sum = await tx.customerPaymentAllocation.aggregate({
    where: { salesInvoiceId },
    _sum: { amount: true },
  });
  const paidAmount = Number(sum._sum.amount ?? 0);
  const outstanding =
    Math.round((Number(invoice.grandTotal) - paidAmount) * 100) / 100;

  const status: SalesInvoiceStatus =
    outstanding <= 0.01
      ? "PAID"
      : invoice.dueDate.getTime() < now.getTime()
        ? "OVERDUE"
        : paidAmount > 0.01
          ? "PARTLY_PAID"
          : "UNPAID";

  await tx.salesInvoice.update({
    where: { id: salesInvoiceId },
    data: {
      paidAmount,
      outstandingAmount: outstanding <= 0.01 ? 0 : outstanding,
      status,
    },
  });

  const rows = await tx.salesPaymentSchedule.findMany({
    where: { salesInvoiceId },
    orderBy: { sortOrder: "asc" },
  });
  let left = paidAmount;
  for (const row of rows) {
    const applied = Math.min(left, Number(row.amount));
    left = Math.max(0, left - applied);
    await tx.salesPaymentSchedule.update({
      where: { id: row.id },
      data: { paidAmount: applied },
    });
  }
};

export const createCustomerPayment = (
  restaurantId: string,
  createdById: string,
  data: {
    customerId: string;
    paymentDate: Date;
    mode: Prisma.CustomerPaymentCreateInput["mode"];
    amount: number;
    unallocatedAmount: number;
    referenceNo: string | null;
    referenceDate: Date | null;
    notes: string | null;
  },
  allocations: readonly { salesInvoiceId: string; amount: number }[],
  now: Date,
): Promise<CustomerPaymentWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "CPAY", tx);
    const payment = await tx.customerPayment.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        allocations: { create: allocations.map((a) => ({ ...a })) },
      },
      include: paymentDetail,
    });
    for (const allocation of allocations) {
      await recalcSalesInvoiceSettlement(tx, allocation.salesInvoiceId, now);
    }
    return payment;
  });

export const deleteCustomerPayment = (
  paymentId: string,
  now: Date,
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    const allocations = await tx.customerPaymentAllocation.findMany({
      where: { customerPaymentId: paymentId },
      select: { salesInvoiceId: true },
    });
    await tx.customerPayment.delete({ where: { id: paymentId } });
    for (const allocation of allocations) {
      await recalcSalesInvoiceSettlement(tx, allocation.salesInvoiceId, now);
    }
  });

export const findCustomerPaymentById = (
  id: string,
): Promise<CustomerPaymentWithDetail | null> =>
  prisma.customerPayment.findUnique({ where: { id }, include: paymentDetail });

export const findCustomerPayments = (
  restaurantId: string,
  filter: { customerId?: string } = {},
): Promise<CustomerPaymentWithDetail[]> =>
  prisma.customerPayment.findMany({
    where: {
      restaurantId,
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    include: paymentDetail,
    orderBy: [{ paymentDate: "desc" }, { number: "desc" }],
  });
