import type {
  Prisma,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";

export interface PurchaseOrderLineWriteData {
  stockItemId: string;
  supplierQuotationItemId: string | null;
  description: string | null;
  quantity: number;
  rate: number;
  discountPercent: number | null;
  taxRate: number;
  amount: number;
  scheduleDate: Date | null;
  sortOrder: number;
}

export interface PurchaseOrderWriteData {
  supplierId: string;
  supplierQuotationId: string | null;
  transactionDate: Date;
  scheduleDate: Date | null;
  currency: string | null;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  notes: string | null;
  termsText: string | null;
}

const detail = {
  supplier: { select: { id: true, name: true } },
  supplierQuotation: { select: { id: true, number: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderWithDetail = Prisma.PurchaseOrderGetPayload<{
  include: typeof detail;
}>;

const listSelect = {
  id: true,
  number: true,
  status: true,
  transactionDate: true,
  scheduleDate: true,
  grandTotal: true,
  receivedPercent: true,
  billedPercent: true,
  supplier: { select: { name: true } },
} satisfies Prisma.PurchaseOrderSelect;

export type PurchaseOrderListRow = Prisma.PurchaseOrderGetPayload<{
  select: typeof listSelect;
}>;

/**
 * Create the order and its lines in one transaction, claiming the document
 * number inside it so an aborted create never burns a number.
 */
export const createPurchaseOrder = (
  restaurantId: string,
  createdById: string,
  data: PurchaseOrderWriteData,
  lines: readonly PurchaseOrderLineWriteData[],
): Promise<PurchaseOrderWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "PO", tx);
    return tx.purchaseOrder.create({
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

/** Replace an order's lines wholesale — only ever called on a draft. */
export const updatePurchaseOrder = (
  id: string,
  data: PurchaseOrderWriteData,
  lines: readonly PurchaseOrderLineWriteData[],
): Promise<PurchaseOrderWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    return tx.purchaseOrder.update({
      where: { id },
      data: { ...data, items: { create: lines.map((line) => ({ ...line })) } },
      include: detail,
    });
  });

export const setPurchaseOrderStatus = (
  id: string,
  status: PurchaseOrderStatus,
  stamps: {
    submittedAt?: Date;
    cancelledAt?: Date;
    closedAt?: Date | null;
    holdComment?: string | null;
  } = {},
): Promise<PurchaseOrder> =>
  prisma.purchaseOrder.update({ where: { id }, data: { status, ...stamps } });

export const findPurchaseOrderById = (
  id: string,
): Promise<PurchaseOrderWithDetail | null> =>
  prisma.purchaseOrder.findUnique({ where: { id }, include: detail });

export interface PurchaseOrderFilter {
  readonly status?: readonly PurchaseOrderStatus[];
  readonly supplierId?: string;
  readonly search?: string;
  readonly take?: number;
}

export const findPurchaseOrders = (
  restaurantId: string,
  filter: PurchaseOrderFilter = {},
): Promise<PurchaseOrderListRow[]> =>
  prisma.purchaseOrder.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.search
        ? {
            OR: [
              { number: { contains: filter.search, mode: "insensitive" } },
              {
                supplier: {
                  name: { contains: filter.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: listSelect,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

export const deleteDraftPurchaseOrder = (id: string): Promise<void> =>
  prisma.purchaseOrder.delete({ where: { id } }).then(() => undefined);

/**
 * Roll each line's received/billed quantity up to the order's progress
 * percentages. Called after a receipt or invoice is submitted or cancelled, in
 * that document's own transaction so the two can never disagree.
 */
export const recalcPurchaseOrderProgress = async (
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
): Promise<{ receivedPercent: number; billedPercent: number }> => {
  const items = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: { quantity: true, receivedQty: true, billedQty: true },
  });
  const ordered = items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const received = items.reduce((sum, i) => sum + Number(i.receivedQty), 0);
  const billed = items.reduce((sum, i) => sum + Number(i.billedQty), 0);
  const pct = (done: number): number =>
    ordered <= 0 ? 0 : Math.round(Math.min(100, (done / ordered) * 100) * 100) / 100;
  const receivedPercent = pct(received);
  const billedPercent = pct(billed);
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { receivedPercent, billedPercent },
  });
  return { receivedPercent, billedPercent };
};

/** Move a line's received quantity by a signed delta (receipt or its reversal). */
export const bumpOrderLineReceived = (
  tx: Prisma.TransactionClient,
  purchaseOrderItemId: string,
  delta: number,
): Promise<unknown> =>
  tx.purchaseOrderItem.update({
    where: { id: purchaseOrderItemId },
    data: { receivedQty: { increment: delta } },
  });

/** Move a line's billed quantity by a signed delta (invoice or its reversal). */
export const bumpOrderLineBilled = (
  tx: Prisma.TransactionClient,
  purchaseOrderItemId: string,
  delta: number,
): Promise<unknown> =>
  tx.purchaseOrderItem.update({
    where: { id: purchaseOrderItemId },
    data: { billedQty: { increment: delta } },
  });

export const addAdvancePaid = (
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
  delta: number,
): Promise<unknown> =>
  tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { advancePaid: { increment: delta } },
  });
