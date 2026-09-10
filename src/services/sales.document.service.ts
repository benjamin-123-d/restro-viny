import type { SalesOrderStatus } from "@/generated/prisma/client";
import type {
  CreateCustomerPaymentInput,
  CreateDeliveryNoteInput,
  CreateSalesInvoiceInput,
  CreateSalesOrderInput,
  CreateSalesQuotationInput,
  HoldSalesOrderInput,
  MarkQuotationLostInput,
  OrderFromQuotationInput,
  UpdateSalesOrderInput,
  UpdateSalesQuotationInput,
} from "@/lib/validators/selling";
import {
  cancelDeliveryNote as cancelDeliveryNoteRepo,
  cancelSalesInvoice as cancelSalesInvoiceRepo,
  createCustomerPayment as createCustomerPaymentRepo,
  createDeliveryNote as createDeliveryNoteRepo,
  createSalesInvoice as createSalesInvoiceRepo,
  createSalesOrder as createSalesOrderRepo,
  createSalesQuotation as createSalesQuotationRepo,
  deleteCustomerPayment,
  deleteDraftDeliveryNote,
  deleteDraftSalesInvoice,
  deleteDraftSalesOrder,
  deleteDraftSalesQuotation,
  findCustomerPayments,
  findDeliveryNoteById,
  findDeliveryNotes,
  findReceivableInvoices,
  findSalesInvoiceById,
  findSalesInvoices,
  findSalesOrderById,
  findSalesOrders,
  findSalesQuotationById,
  findSalesQuotations,
  setQuotationStatus,
  setSalesOrderStatus,
  submitDeliveryNote as submitDeliveryNoteRepo,
  submitSalesInvoice as submitSalesInvoiceRepo,
  updateSalesOrder as updateSalesOrderRepo,
  updateSalesQuotation as updateSalesQuotationRepo,
  type DeliveryLineWriteData,
  type DeliveryNoteWithDetail,
  type SalesInvoiceLineWriteData,
  type SalesInvoiceWithDetail,
  type SalesLineWriteData,
  type SalesOrderLineWriteData,
  type SalesOrderWithDetail,
  type SalesQuotationWithDetail,
} from "@/repositories/sales-document.repository";
import {
  assertCustomerCanOrder,
  loadOwnedCustomer,
  outstandingFor,
  type SellingContext,
} from "@/services/customer.service";
import {
  computePurchaseTotals,
  percentOf,
  type PurchaseLineInput,
} from "@/services/purchase-totals";
import type {
  CustomerPaymentDTO,
  DeliveryNoteDTO,
  DeliveryNoteListItemDTO,
  ReceivableInvoiceDTO,
  SalesInvoiceDTO,
  SalesInvoiceListItemDTO,
  SalesOrderDTO,
  SalesOrderListItemDTO,
  SalesQuotationDTO,
  SalesQuotationListItemDTO,
} from "@/types/selling";

export const SQ_NOT_FOUND = "SQ_NOT_FOUND";
export const SQ_NOT_DRAFT = "SQ_NOT_DRAFT";
export const SO_NOT_FOUND = "SO_NOT_FOUND";
export const SO_NOT_DRAFT = "SO_NOT_DRAFT";
export const SO_NOT_SUBMITTED = "SO_NOT_SUBMITTED";
export const SO_HAS_DELIVERIES = "SO_HAS_DELIVERIES";
export const DN_NOT_FOUND = "DN_NOT_FOUND";
export const DN_NOT_DRAFT = "DN_NOT_DRAFT";
export const DN_NOT_SUBMITTED = "DN_NOT_SUBMITTED";
export const SI_NOT_FOUND = "SI_NOT_FOUND";
export const SI_NOT_DRAFT = "SI_NOT_DRAFT";
export const SI_NOT_SUBMITTED = "SI_NOT_SUBMITTED";
export const PAYMENT_INVOICE_MISMATCH = "PAYMENT_INVOICE_MISMATCH";

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v != null ? Number(v) : null);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const DAY_MS = 86_400_000;

const daysOverdue = (dueDate: Date, outstanding: number, now: Date): number => {
  if (outstanding <= 0.01) return 0;
  const diff = now.getTime() - dueDate.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
};

/** Line pricing is document-agnostic; selling shares purchasing's money math. */
const priceLines = (
  items: readonly {
    quantity: number;
    rate: number;
    discountPercent?: number;
    taxRate: number;
  }[],
  documentDiscount: number,
  roundTotal: boolean,
) => {
  const inputs: PurchaseLineInput[] = items.map((i) => ({
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
  }));
  return computePurchaseTotals(inputs, {
    documentDiscount,
    roundTotal,
  });
};

const toSalesLines = (
  items: CreateSalesQuotationInput["items"],
  amounts: readonly { net: number }[],
): SalesLineWriteData[] =>
  items.map((i, index) => ({
    menuItemId: i.menuItemId ?? null,
    stockItemId: i.stockItemId ?? null,
    itemName: i.itemName,
    description: i.description ?? null,
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
    amount: amounts[index].net,
    sortOrder: index,
  }));

const mapLine = (i: {
  id: string;
  menuItemId: string | null;
  stockItemId: string | null;
  itemName: string;
  description: string | null;
  quantity: unknown;
  rate: unknown;
  discountPercent: unknown;
  taxRate: unknown;
  amount: unknown;
}) => ({
  id: i.id,
  menuItemId: i.menuItemId,
  stockItemId: i.stockItemId,
  itemName: i.itemName,
  description: i.description,
  quantity: num(i.quantity),
  rate: num(i.rate),
  discountPercent: numOrNull(i.discountPercent),
  taxRate: num(i.taxRate),
  amount: num(i.amount),
});

// ------------------------------------------------------------ quotation ---

export const mapSalesQuotation = (
  q: SalesQuotationWithDetail,
  now: Date = new Date(),
): SalesQuotationDTO => ({
  id: q.id,
  number: q.number,
  status: q.status,
  customerId: q.customerId,
  customerName: q.customer.name,
  transactionDate: q.transactionDate.toISOString(),
  validUntil: iso(q.validUntil),
  subtotal: num(q.subtotal),
  discountAmount: num(q.discountAmount),
  taxTotal: num(q.taxTotal),
  roundOff: num(q.roundOff),
  grandTotal: num(q.grandTotal),
  lostReason: q.lostReason,
  notes: q.notes,
  termsText: q.termsText,
  items: q.items.map(mapLine),
  isExpired:
    q.validUntil !== null && q.validUntil.getTime() < now.getTime(),
  isEditable: q.status === "DRAFT",
});

const loadOwnedQuotation = async (
  restaurantId: string,
  id: string,
): Promise<SalesQuotationWithDetail> => {
  const doc = await findSalesQuotationById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(SQ_NOT_FOUND);
  return doc;
};

export const createSalesQuotation = async (
  ctx: SellingContext,
  input: CreateSalesQuotationInput,
): Promise<SalesQuotationDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(input.items, input.discountAmount, input.roundTotal);
  return mapSalesQuotation(
    await createSalesQuotationRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        customerId: customer.id,
        transactionDate: input.transactionDate ?? new Date(),
        validUntil: input.validUntil ?? null,
        currency: customer.currency,
        subtotal: totals.subtotal,
        discountAmount: totals.documentDiscount,
        taxTotal: totals.taxTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        notes: input.notes ?? null,
        termsText: input.termsText ?? null,
      },
      toSalesLines(input.items, totals.lines),
    ),
  );
};

export const updateSalesQuotation = async (
  ctx: SellingContext,
  input: UpdateSalesQuotationInput,
): Promise<SalesQuotationDTO> => {
  const doc = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SQ_NOT_DRAFT);
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(input.items, input.discountAmount, input.roundTotal);
  return mapSalesQuotation(
    await updateSalesQuotationRepo(
      doc.id,
      {
        customerId: customer.id,
        transactionDate: input.transactionDate ?? doc.transactionDate,
        validUntil: input.validUntil ?? null,
        currency: customer.currency,
        subtotal: totals.subtotal,
        discountAmount: totals.documentDiscount,
        taxTotal: totals.taxTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        notes: input.notes ?? null,
        termsText: input.termsText ?? null,
      },
      toSalesLines(input.items, totals.lines),
    ),
  );
};

export const submitSalesQuotation = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SQ_NOT_DRAFT);
  await setQuotationStatus(doc.id, "OPEN", { submittedAt: new Date() });
};

/** ERPNext keeps why a quotation was lost — it is the useful half of the record. */
export const markQuotationLost = async (
  ctx: SellingContext,
  input: MarkQuotationLostInput,
): Promise<void> => {
  const doc = await loadOwnedQuotation(ctx.restaurantId, input.id);
  await setQuotationStatus(doc.id, "LOST", { lostReason: input.lostReason });
};

export const cancelSalesQuotation = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedQuotation(ctx.restaurantId, input.id);
  await setQuotationStatus(doc.id, "CANCELLED", { cancelledAt: new Date() });
};

export const deleteSalesQuotation = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SQ_NOT_DRAFT);
  await deleteDraftSalesQuotation(doc.id);
};

export const getSalesQuotation = async (
  ctx: SellingContext,
  id: string,
): Promise<SalesQuotationDTO> =>
  mapSalesQuotation(await loadOwnedQuotation(ctx.restaurantId, id));

export const listSalesQuotations = async (
  ctx: SellingContext,
): Promise<SalesQuotationListItemDTO[]> => {
  const now = new Date();
  return (await findSalesQuotations(ctx.restaurantId)).map((q) => ({
    id: q.id,
    number: q.number,
    status: q.status,
    customerName: q.customer.name,
    transactionDate: q.transactionDate.toISOString(),
    validUntil: iso(q.validUntil),
    grandTotal: num(q.grandTotal),
    isExpired:
      q.validUntil !== null && q.validUntil.getTime() < now.getTime(),
  }));
};

// ---------------------------------------------------------- sales order ---

const LIVE_ORDER_STATUSES: readonly SalesOrderStatus[] = [
  "TO_DELIVER_AND_BILL",
  "TO_DELIVER",
  "TO_BILL",
  "ON_HOLD",
];

export const mapSalesOrder = (o: SalesOrderWithDetail): SalesOrderDTO => ({
  id: o.id,
  number: o.number,
  status: o.status,
  customerId: o.customerId,
  customerName: o.customer.name,
  quotationId: o.quotationId,
  transactionDate: o.transactionDate.toISOString(),
  deliveryDate: iso(o.deliveryDate),
  subtotal: num(o.subtotal),
  discountAmount: num(o.discountAmount),
  taxTotal: num(o.taxTotal),
  roundOff: num(o.roundOff),
  grandTotal: num(o.grandTotal),
  deliveredPercent: num(o.deliveredPercent),
  billedPercent: num(o.billedPercent),
  advanceReceived: num(o.advanceReceived),
  poNumber: o.poNumber,
  notes: o.notes,
  termsText: o.termsText,
  holdComment: o.holdComment,
  isEditable: o.status === "DRAFT",
  items: o.items.map((i) => {
    const base = mapLine(i);
    const deliveredQty = num(i.deliveredQty);
    return {
      ...base,
      deliveryDate: iso(i.deliveryDate),
      deliveredQty,
      billedQty: num(i.billedQty),
      pendingQty: Math.max(0, base.quantity - deliveredQty),
    };
  }),
});

export const loadOwnedSalesOrder = async (
  restaurantId: string,
  id: string,
): Promise<SalesOrderWithDetail> => {
  const doc = await findSalesOrderById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(SO_NOT_FOUND);
  return doc;
};

const toOrderLines = (
  items: CreateSalesOrderInput["items"],
  amounts: readonly { net: number }[],
  deliveryDate: Date | null,
): SalesOrderLineWriteData[] =>
  toSalesLines(items, amounts).map((line) => ({
    ...line,
    salesQuotationItemId: null,
    deliveryDate,
  }));

export const createSalesOrder = async (
  ctx: SellingContext,
  input: CreateSalesOrderInput,
): Promise<SalesOrderDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(input.items, input.discountAmount, input.roundTotal);
  const outstanding = await outstandingFor(ctx.restaurantId, customer.id);
  assertCustomerCanOrder(customer, outstanding, totals.grandTotal);

  return mapSalesOrder(
    await createSalesOrderRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        customerId: customer.id,
        quotationId: input.quotationId ?? null,
        transactionDate: input.transactionDate ?? new Date(),
        deliveryDate: input.deliveryDate ?? null,
        poNumber: input.poNumber ?? null,
        currency: customer.currency,
        subtotal: totals.subtotal,
        discountAmount: totals.documentDiscount,
        taxTotal: totals.taxTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        notes: input.notes ?? null,
        termsText: input.termsText ?? null,
      },
      toOrderLines(input.items, totals.lines, input.deliveryDate ?? null),
    ),
  );
};

export const updateSalesOrder = async (
  ctx: SellingContext,
  input: UpdateSalesOrderInput,
): Promise<SalesOrderDTO> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SO_NOT_DRAFT);
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(input.items, input.discountAmount, input.roundTotal);
  return mapSalesOrder(
    await updateSalesOrderRepo(
      doc.id,
      {
        customerId: customer.id,
        quotationId: input.quotationId ?? null,
        transactionDate: input.transactionDate ?? doc.transactionDate,
        deliveryDate: input.deliveryDate ?? null,
        poNumber: input.poNumber ?? null,
        currency: customer.currency,
        subtotal: totals.subtotal,
        discountAmount: totals.documentDiscount,
        taxTotal: totals.taxTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        notes: input.notes ?? null,
        termsText: input.termsText ?? null,
      },
      toOrderLines(input.items, totals.lines, input.deliveryDate ?? null),
    ),
  );
};

export const submitSalesOrder = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SO_NOT_DRAFT);
  await setSalesOrderStatus(doc.id, "TO_DELIVER_AND_BILL", {
    submittedAt: new Date(),
  });
};

/** Status once an order is live, read off delivery and billing progress. */
export const deriveSalesOrderStatus = (input: {
  deliveredPercent: number;
  billedPercent: number;
}): SalesOrderStatus => {
  const delivered = input.deliveredPercent >= 99.99;
  const billed = input.billedPercent >= 99.99;
  if (delivered && billed) return "COMPLETED";
  if (delivered) return "TO_BILL";
  if (billed) return "TO_DELIVER";
  return "TO_DELIVER_AND_BILL";
};

export const holdSalesOrder = async (
  ctx: SellingContext,
  input: HoldSalesOrderInput,
): Promise<void> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (!LIVE_ORDER_STATUSES.includes(doc.status)) {
    throw new Error(SO_NOT_SUBMITTED);
  }
  if (input.onHold) {
    await setSalesOrderStatus(doc.id, "ON_HOLD", {
      holdComment: input.comment ?? null,
    });
    return;
  }
  await setSalesOrderStatus(
    doc.id,
    deriveSalesOrderStatus({
      deliveredPercent: num(doc.deliveredPercent),
      billedPercent: num(doc.billedPercent),
    }),
    { holdComment: null },
  );
};

export const closeSalesOrder = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (!LIVE_ORDER_STATUSES.includes(doc.status)) {
    throw new Error(SO_NOT_SUBMITTED);
  }
  await setSalesOrderStatus(doc.id, "CLOSED", { closedAt: new Date() });
};

export const cancelSalesOrder = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (num(doc.deliveredPercent) > 0 || num(doc.billedPercent) > 0) {
    throw new Error(SO_HAS_DELIVERIES);
  }
  await setSalesOrderStatus(doc.id, "CANCELLED", { cancelledAt: new Date() });
};

export const deleteSalesOrder = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesOrder(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SO_NOT_DRAFT);
  await deleteDraftSalesOrder(doc.id);
};

export const getSalesOrder = async (
  ctx: SellingContext,
  id: string,
): Promise<SalesOrderDTO> =>
  mapSalesOrder(await loadOwnedSalesOrder(ctx.restaurantId, id));

export const listSalesOrders = async (
  ctx: SellingContext,
): Promise<SalesOrderListItemDTO[]> => {
  const now = Date.now();
  return (await findSalesOrders(ctx.restaurantId)).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    customerName: o.customer.name,
    transactionDate: o.transactionDate.toISOString(),
    deliveryDate: iso(o.deliveryDate),
    grandTotal: num(o.grandTotal),
    deliveredPercent: num(o.deliveredPercent),
    billedPercent: num(o.billedPercent),
    isLate:
      o.deliveryDate !== null &&
      o.deliveryDate.getTime() < now &&
      num(o.deliveredPercent) < 100 &&
      LIVE_ORDER_STATUSES.includes(o.status),
  }));
};

/** Convert an accepted quotation into a sales order at the quoted prices. */
export const orderFromQuotation = async (
  ctx: SellingContext,
  input: OrderFromQuotationInput,
): Promise<SalesOrderDTO> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.quotationId);
  if (quotation.status === "DRAFT" || quotation.status === "CANCELLED") {
    throw new Error(SQ_NOT_DRAFT);
  }

  const order = await createSalesOrder(ctx, {
    customerId: quotation.customerId,
    quotationId: quotation.id,
    deliveryDate: input.deliveryDate,
    discountAmount: num(quotation.discountAmount),
    roundTotal: false,
    notes: `From quotation ${quotation.number}`,
    termsText: quotation.termsText ?? undefined,
    items: quotation.items.map((i) => ({
      menuItemId: i.menuItemId ?? undefined,
      stockItemId: i.stockItemId ?? undefined,
      itemName: i.itemName,
      description: i.description ?? undefined,
      quantity: num(i.quantity),
      rate: num(i.rate),
      discountPercent: numOrNull(i.discountPercent) ?? undefined,
      taxRate: num(i.taxRate),
    })),
  });

  await setQuotationStatus(quotation.id, "ORDERED");
  return order;
};

// -------------------------------------------------------- delivery note ---

export const mapDeliveryNote = (d: DeliveryNoteWithDetail): DeliveryNoteDTO => ({
  id: d.id,
  number: d.number,
  status: d.status,
  customerId: d.customerId,
  customerName: d.customer.name,
  salesOrderId: d.salesOrderId,
  salesOrderNumber: d.salesOrder?.number ?? null,
  warehouseId: d.warehouseId,
  warehouseName: d.warehouse?.name ?? null,
  postingDate: d.postingDate.toISOString(),
  subtotal: num(d.subtotal),
  taxTotal: num(d.taxTotal),
  grandTotal: num(d.grandTotal),
  billedPercent: num(d.billedPercent),
  isReturn: d.isReturn,
  driverName: d.driverName,
  vehicleNo: d.vehicleNo,
  notes: d.notes,
  isEditable: d.status === "DRAFT",
  items: d.items.map((i) => ({
    ...mapLine({ ...i, discountPercent: null }),
    salesOrderItemId: i.salesOrderItemId,
    batchNo: i.batchNo,
    billedQty: num(i.billedQty),
  })),
});

const loadOwnedDelivery = async (
  restaurantId: string,
  id: string,
): Promise<DeliveryNoteWithDetail> => {
  const doc = await findDeliveryNoteById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(DN_NOT_FOUND);
  return doc;
};

export const createDeliveryNote = async (
  ctx: SellingContext,
  input: CreateDeliveryNoteInput,
): Promise<DeliveryNoteDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(
    input.items.map((i) => ({ ...i, discountPercent: undefined })),
    0,
    false,
  );
  const lines: DeliveryLineWriteData[] = input.items.map((i, index) => ({
    salesOrderItemId: i.salesOrderItemId ?? null,
    menuItemId: i.menuItemId ?? null,
    stockItemId: i.stockItemId ?? null,
    itemName: i.itemName,
    description: i.description ?? null,
    quantity: i.quantity,
    rate: i.rate,
    taxRate: i.taxRate,
    amount: totals.lines[index].net,
    batchNo: i.batchNo ?? null,
    sortOrder: index,
  }));

  return mapDeliveryNote(
    await createDeliveryNoteRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        customerId: customer.id,
        salesOrderId: input.salesOrderId ?? null,
        warehouseId: input.warehouseId ?? null,
        postingDate: input.postingDate ?? new Date(),
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        isReturn: false,
        returnAgainstId: null,
        driverName: input.driverName ?? null,
        vehicleNo: input.vehicleNo ?? null,
        notes: input.notes ?? null,
      },
      lines,
    ),
  );
};

export const submitDeliveryNote = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedDelivery(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(DN_NOT_DRAFT);
  await submitDeliveryNoteRepo(doc.id, ctx.userId);
};

export const cancelDeliveryNote = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedDelivery(ctx.restaurantId, input.id);
  if (doc.status === "DRAFT" || doc.status === "CANCELLED") {
    throw new Error(DN_NOT_SUBMITTED);
  }
  await cancelDeliveryNoteRepo(doc.id, ctx.userId);
};

export const deleteDeliveryNote = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedDelivery(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(DN_NOT_DRAFT);
  await deleteDraftDeliveryNote(doc.id);
};

export const getDeliveryNote = async (
  ctx: SellingContext,
  id: string,
): Promise<DeliveryNoteDTO> =>
  mapDeliveryNote(await loadOwnedDelivery(ctx.restaurantId, id));

export const listDeliveryNotes = async (
  ctx: SellingContext,
): Promise<DeliveryNoteListItemDTO[]> =>
  (await findDeliveryNotes(ctx.restaurantId)).map((d) => ({
    id: d.id,
    number: d.number,
    status: d.status,
    customerName: d.customer.name,
    postingDate: d.postingDate.toISOString(),
    grandTotal: num(d.grandTotal),
    billedPercent: num(d.billedPercent),
    isReturn: d.isReturn,
  }));

// -------------------------------------------------------- sales invoice ---

export const mapSalesInvoice = (
  s: SalesInvoiceWithDetail,
  now: Date = new Date(),
): SalesInvoiceDTO => {
  const outstandingAmount = num(s.outstandingAmount);
  return {
    id: s.id,
    number: s.number,
    status: s.status,
    customerId: s.customerId,
    customerName: s.customer.name,
    salesOrderId: s.salesOrderId,
    salesOrderNumber: s.salesOrder?.number ?? null,
    deliveryNoteId: s.deliveryNoteId,
    deliveryNoteNumber: s.deliveryNote?.number ?? null,
    postingDate: s.postingDate.toISOString(),
    dueDate: s.dueDate.toISOString(),
    subtotal: num(s.subtotal),
    discountAmount: num(s.discountAmount),
    taxTotal: num(s.taxTotal),
    roundOff: num(s.roundOff),
    grandTotal: num(s.grandTotal),
    paidAmount: num(s.paidAmount),
    outstandingAmount,
    updateStock: s.updateStock,
    isReturn: s.isReturn,
    notes: s.notes,
    termsText: s.termsText,
    items: s.items.map(mapLine),
    schedule: s.schedule.map((row) => ({
      id: row.id,
      dueDate: row.dueDate.toISOString(),
      invoicePortion: num(row.invoicePortion),
      amount: num(row.amount),
      paidAmount: num(row.paidAmount),
    })),
    isEditable: s.status === "DRAFT",
    daysOverdue: daysOverdue(s.dueDate, outstandingAmount, now),
  };
};

const loadOwnedSalesInvoice = async (
  restaurantId: string,
  id: string,
): Promise<SalesInvoiceWithDetail> => {
  const doc = await findSalesInvoiceById(id);
  if (!doc || doc.restaurantId !== restaurantId) throw new Error(SI_NOT_FOUND);
  return doc;
};

export const createSalesInvoice = async (
  ctx: SellingContext,
  input: CreateSalesInvoiceInput,
): Promise<SalesInvoiceDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const totals = priceLines(input.items, input.discountAmount, input.roundTotal);

  const postingDate = input.postingDate ?? new Date();
  // No explicit due date: fall back to the customer's terms, else same day.
  const dueDate =
    input.dueDate ??
    new Date(
      postingDate.getTime() + (customer.paymentTermsDays ?? 0) * DAY_MS,
    );

  const lines: SalesInvoiceLineWriteData[] = input.items.map((i, index) => ({
    salesOrderItemId: i.salesOrderItemId ?? null,
    deliveryNoteItemId: i.deliveryNoteItemId ?? null,
    menuItemId: i.menuItemId ?? null,
    stockItemId: i.stockItemId ?? null,
    itemName: i.itemName,
    description: i.description ?? null,
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
    amount: totals.lines[index].net,
    sortOrder: index,
  }));

  const schedule = (input.schedule ?? []).map((row, index) => ({
    dueDate: row.dueDate,
    invoicePortion: row.invoicePortion,
    amount: row.amount,
    sortOrder: index,
  }));

  return mapSalesInvoice(
    await createSalesInvoiceRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        customerId: customer.id,
        salesOrderId: input.salesOrderId ?? null,
        deliveryNoteId: input.deliveryNoteId ?? null,
        postingDate,
        dueDate,
        currency: customer.currency,
        subtotal: totals.subtotal,
        discountAmount: totals.documentDiscount,
        taxTotal: totals.taxTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        outstandingAmount: 0,
        updateStock: input.updateStock,
        isReturn: false,
        returnAgainstId: null,
        notes: input.notes ?? null,
        termsText: input.termsText ?? null,
      },
      lines,
      schedule,
    ),
  );
};

export const submitSalesInvoice = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesInvoice(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SI_NOT_DRAFT);
  await submitSalesInvoiceRepo(doc.id, ctx.userId);
};

export const cancelSalesInvoice = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesInvoice(ctx.restaurantId, input.id);
  if (doc.status === "DRAFT" || doc.status === "CANCELLED") {
    throw new Error(SI_NOT_SUBMITTED);
  }
  await cancelSalesInvoiceRepo(doc.id, ctx.userId);
};

export const deleteSalesInvoice = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const doc = await loadOwnedSalesInvoice(ctx.restaurantId, input.id);
  if (doc.status !== "DRAFT") throw new Error(SI_NOT_DRAFT);
  await deleteDraftSalesInvoice(doc.id);
};

export const getSalesInvoice = async (
  ctx: SellingContext,
  id: string,
): Promise<SalesInvoiceDTO> =>
  mapSalesInvoice(await loadOwnedSalesInvoice(ctx.restaurantId, id));

export const listSalesInvoices = async (
  ctx: SellingContext,
): Promise<SalesInvoiceListItemDTO[]> => {
  const now = new Date();
  return (await findSalesInvoices(ctx.restaurantId)).map((s) => {
    const outstandingAmount = num(s.outstandingAmount);
    return {
      id: s.id,
      number: s.number,
      status: s.status,
      customerName: s.customer.name,
      postingDate: s.postingDate.toISOString(),
      dueDate: s.dueDate.toISOString(),
      grandTotal: num(s.grandTotal),
      outstandingAmount,
      daysOverdue: daysOverdue(s.dueDate, outstandingAmount, now),
    };
  });
};

export const listReceivableInvoices = async (
  ctx: SellingContext,
  customerId: string,
): Promise<ReceivableInvoiceDTO[]> => {
  const now = new Date();
  return (await findReceivableInvoices(ctx.restaurantId, customerId)).map(
    (s) => {
      const outstandingAmount = num(s.outstandingAmount);
      return {
        id: s.id,
        number: s.number,
        postingDate: s.postingDate.toISOString(),
        dueDate: s.dueDate.toISOString(),
        grandTotal: num(s.grandTotal),
        outstandingAmount,
        daysOverdue: daysOverdue(s.dueDate, outstandingAmount, now),
      };
    },
  );
};

// ---------------------------------------------------- customer payment ---

/**
 * Record a receipt. Every allocation must belong to the same customer, and the
 * remainder is held on account rather than silently dropped.
 */
export const createCustomerPayment = async (
  ctx: SellingContext,
  input: CreateCustomerPaymentInput,
): Promise<CustomerPaymentDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.customerId);
  const now = new Date();

  const payable = await findReceivableInvoices(ctx.restaurantId, customer.id);
  const payableIds = new Set(payable.map((i) => i.id));
  for (const allocation of input.allocations) {
    if (!payableIds.has(allocation.salesInvoiceId)) {
      throw new Error(PAYMENT_INVOICE_MISMATCH);
    }
  }

  const allocated = input.allocations.reduce((s, a) => s + a.amount, 0);
  const payment = await createCustomerPaymentRepo(
    ctx.restaurantId,
    ctx.userId,
    {
      customerId: customer.id,
      paymentDate: input.paymentDate ?? now,
      mode: input.mode,
      amount: input.amount,
      unallocatedAmount: Math.round((input.amount - allocated) * 100) / 100,
      referenceNo: input.referenceNo ?? null,
      referenceDate: input.referenceDate ?? null,
      notes: input.notes ?? null,
    },
    input.allocations,
    now,
  );

  return {
    id: payment.id,
    number: payment.number,
    customerId: payment.customerId,
    customerName: payment.customer.name,
    paymentDate: payment.paymentDate.toISOString(),
    mode: payment.mode,
    amount: num(payment.amount),
    unallocatedAmount: num(payment.unallocatedAmount),
    referenceNo: payment.referenceNo,
    referenceDate: iso(payment.referenceDate),
    notes: payment.notes,
    allocations: payment.allocations.map((a) => ({
      id: a.id,
      salesInvoiceId: a.salesInvoiceId,
      invoiceNumber: a.salesInvoice.number,
      amount: num(a.amount),
    })),
  };
};

export const listCustomerPayments = async (
  ctx: SellingContext,
): Promise<CustomerPaymentDTO[]> =>
  (await findCustomerPayments(ctx.restaurantId)).map((p) => ({
    id: p.id,
    number: p.number,
    customerId: p.customerId,
    customerName: p.customer.name,
    paymentDate: p.paymentDate.toISOString(),
    mode: p.mode,
    amount: num(p.amount),
    unallocatedAmount: num(p.unallocatedAmount),
    referenceNo: p.referenceNo,
    referenceDate: iso(p.referenceDate),
    notes: p.notes,
    allocations: p.allocations.map((a) => ({
      id: a.id,
      salesInvoiceId: a.salesInvoiceId,
      invoiceNumber: a.salesInvoice.number,
      amount: num(a.amount),
    })),
  }));

export const removeCustomerPayment = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const payments = await findCustomerPayments(ctx.restaurantId);
  if (!payments.some((p) => p.id === input.id)) {
    throw new Error(SI_NOT_FOUND);
  }
  await deleteCustomerPayment(input.id, new Date());
};

export { percentOf };
