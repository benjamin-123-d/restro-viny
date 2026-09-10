import type { PurchaseOrderStatus } from "@/generated/prisma/client";
import type {
  CreatePurchaseOrderInput,
  HoldPurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "@/lib/validators/purchasing";
import {
  createPurchaseOrder as createRepo,
  deleteDraftPurchaseOrder,
  findPurchaseOrderById,
  findPurchaseOrders,
  setPurchaseOrderStatus,
  updatePurchaseOrder as updateRepo,
  type PurchaseOrderFilter,
  type PurchaseOrderLineWriteData,
  type PurchaseOrderWithDetail,
} from "@/repositories/purchase-order.repository";
import {
  computePurchaseTotals,
  derivePurchaseOrderStatus,
  type PurchaseLineInput,
} from "@/services/purchase-totals";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type {
  PurchaseOrderDTO,
  PurchaseOrderListItemDTO,
} from "@/types/purchasing";
import type { StockUnit } from "@/types/inventory";

export const PO_NOT_FOUND = "PO_NOT_FOUND";
export const PO_NOT_DRAFT = "PO_NOT_DRAFT";
export const PO_ALREADY_SUBMITTED = "PO_ALREADY_SUBMITTED";
export const PO_NOT_SUBMITTED = "PO_NOT_SUBMITTED";
export const PO_HAS_RECEIPTS = "PO_HAS_RECEIPTS";

const num = (v: unknown): number => Number(v);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

/** Statuses a live (submitted, not closed/cancelled) order can be in. */
const LIVE_STATUSES: readonly PurchaseOrderStatus[] = [
  "TO_RECEIVE_AND_BILL",
  "TO_RECEIVE",
  "TO_BILL",
  "ON_HOLD",
];

export const mapPurchaseOrder = (
  o: PurchaseOrderWithDetail,
): PurchaseOrderDTO => ({
  id: o.id,
  number: o.number,
  status: o.status,
  supplierId: o.supplierId,
  supplierName: o.supplier.name,
  supplierQuotationId: o.supplierQuotationId,
  transactionDate: o.transactionDate.toISOString(),
  scheduleDate: iso(o.scheduleDate),
  subtotal: num(o.subtotal),
  discountAmount: num(o.discountAmount),
  taxTotal: num(o.taxTotal),
  roundOff: num(o.roundOff),
  grandTotal: num(o.grandTotal),
  receivedPercent: num(o.receivedPercent),
  billedPercent: num(o.billedPercent),
  advancePaid: num(o.advancePaid),
  notes: o.notes,
  termsText: o.termsText,
  holdComment: o.holdComment,
  isEditable: o.status === "DRAFT",
  items: o.items.map((i) => {
    const quantity = num(i.quantity);
    const receivedQty = num(i.receivedQty);
    return {
      id: i.id,
      stockItemId: i.stockItemId,
      stockItemName: i.stockItem.name,
      unit: i.stockItem.unit as StockUnit,
      description: i.description,
      quantity,
      rate: num(i.rate),
      discountPercent: i.discountPercent != null ? num(i.discountPercent) : null,
      taxRate: num(i.taxRate),
      amount: num(i.amount),
      scheduleDate: iso(i.scheduleDate),
      receivedQty,
      billedQty: num(i.billedQty),
      pendingQty: Math.max(0, quantity - receivedQty),
    };
  }),
});

const toLineInputs = (
  input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput,
): PurchaseLineInput[] =>
  input.items.map((i) => ({
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
  }));

/**
 * Price the document once, then hand the repository both the header totals and
 * the per-line amounts — so what is stored is exactly what was shown.
 */
const priced = (
  input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput,
  currency: string | null,
) => {
  const totals = computePurchaseTotals(toLineInputs(input), {
    documentDiscount: input.discountAmount,
    roundTotal: input.roundTotal,
  });
  const lines: PurchaseOrderLineWriteData[] = input.items.map((i, index) => ({
    stockItemId: i.stockItemId,
    supplierQuotationItemId: i.supplierQuotationItemId ?? null,
    description: i.description ?? null,
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
    amount: totals.lines[index].net,
    scheduleDate: i.scheduleDate ?? null,
    sortOrder: index,
  }));
  return {
    data: {
      supplierId: input.supplierId,
      supplierQuotationId: input.supplierQuotationId ?? null,
      transactionDate: input.transactionDate ?? new Date(),
      scheduleDate: input.scheduleDate ?? null,
      currency,
      subtotal: totals.subtotal,
      discountAmount: totals.documentDiscount,
      taxTotal: totals.taxTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      notes: input.notes ?? null,
      termsText: input.termsText ?? null,
    },
    lines,
  };
};

export const loadOwnedOrder = async (
  restaurantId: string,
  id: string,
): Promise<PurchaseOrderWithDetail> => {
  const order = await findPurchaseOrderById(id);
  if (!order || order.restaurantId !== restaurantId) {
    throw new Error(PO_NOT_FOUND);
  }
  return order;
};

export const createPurchaseOrder = async (
  ctx: PurchasingContext,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "ORDERS");
  const { data, lines } = priced(input, supplier.currency);
  return mapPurchaseOrder(
    await createRepo(ctx.restaurantId, ctx.userId, data, lines),
  );
};

export const updatePurchaseOrder = async (
  ctx: PurchasingContext,
  input: UpdatePurchaseOrderInput,
): Promise<PurchaseOrderDTO> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (order.status !== "DRAFT") {
    throw new Error(PO_NOT_DRAFT);
  }
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "ORDERS");
  const { data, lines } = priced(input, supplier.currency);
  return mapPurchaseOrder(await updateRepo(order.id, data, lines));
};

export const submitPurchaseOrder = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (order.status !== "DRAFT") {
    throw new Error(PO_ALREADY_SUBMITTED);
  }
  await setPurchaseOrderStatus(order.id, "TO_RECEIVE_AND_BILL", {
    submittedAt: new Date(),
  });
};

/**
 * Hold and release. Releasing recomputes the status from received/billed
 * progress rather than assuming the order is back at square one.
 */
export const holdPurchaseOrder = async (
  ctx: PurchasingContext,
  input: HoldPurchaseOrderInput,
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (!LIVE_STATUSES.includes(order.status)) {
    throw new Error(PO_NOT_SUBMITTED);
  }
  if (input.onHold) {
    await setPurchaseOrderStatus(order.id, "ON_HOLD", {
      holdComment: input.comment ?? null,
    });
    return;
  }
  const status = derivePurchaseOrderStatus({
    state: "SUBMITTED",
    receivedPercent: num(order.receivedPercent),
    billedPercent: num(order.billedPercent),
  });
  await setPurchaseOrderStatus(order.id, status, { holdComment: null });
};

/** Close an order that will never be completed, keeping what already happened. */
export const closePurchaseOrder = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (!LIVE_STATUSES.includes(order.status)) {
    throw new Error(PO_NOT_SUBMITTED);
  }
  await setPurchaseOrderStatus(order.id, "CLOSED", { closedAt: new Date() });
};

export const reopenPurchaseOrder = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (order.status !== "CLOSED") {
    throw new Error(PO_NOT_SUBMITTED);
  }
  const status = derivePurchaseOrderStatus({
    state: "SUBMITTED",
    receivedPercent: num(order.receivedPercent),
    billedPercent: num(order.billedPercent),
  });
  await setPurchaseOrderStatus(order.id, status, { closedAt: null });
};

/**
 * Cancelling is only honest while nothing has arrived — once stock has moved
 * against the order, the right move is a return, then close.
 */
export const cancelPurchaseOrder = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (num(order.receivedPercent) > 0 || num(order.billedPercent) > 0) {
    throw new Error(PO_HAS_RECEIPTS);
  }
  await setPurchaseOrderStatus(order.id, "CANCELLED", {
    cancelledAt: new Date(),
  });
};

export const deletePurchaseOrder = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.id);
  if (order.status !== "DRAFT") {
    throw new Error(PO_NOT_DRAFT);
  }
  await deleteDraftPurchaseOrder(order.id);
};

export const getPurchaseOrder = async (
  ctx: PurchasingContext,
  id: string,
): Promise<PurchaseOrderDTO> =>
  mapPurchaseOrder(await loadOwnedOrder(ctx.restaurantId, id));

export const listPurchaseOrders = async (
  ctx: PurchasingContext,
  filter: PurchaseOrderFilter = {},
): Promise<PurchaseOrderListItemDTO[]> => {
  const now = Date.now();
  return (await findPurchaseOrders(ctx.restaurantId, filter)).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    supplierName: o.supplier.name,
    transactionDate: o.transactionDate.toISOString(),
    scheduleDate: iso(o.scheduleDate),
    grandTotal: num(o.grandTotal),
    receivedPercent: num(o.receivedPercent),
    billedPercent: num(o.billedPercent),
    isLate:
      o.scheduleDate !== null &&
      o.scheduleDate.getTime() < now &&
      num(o.receivedPercent) < 100 &&
      LIVE_STATUSES.includes(o.status),
  }));
};
