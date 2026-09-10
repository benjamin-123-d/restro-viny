import type {
  CreateOrderFromQuotationInput,
  CreateRfqInput,
  CreateSupplierQuotationInput,
  MarkRfqSentInput,
  UpdateRfqInput,
  UpdateSupplierQuotationInput,
} from "@/lib/validators/purchasing";
import {
  createQuotation as createQuotationRepo,
  createRfq as createRfqRepo,
  deleteDraftQuotation,
  deleteDraftRfq,
  findQuotationById,
  findQuotations,
  findQuotationsForRfq,
  findRfqById,
  findRfqs,
  markRfqSupplierSent,
  setQuotationStatus,
  setRfqStatus,
  updateQuotation as updateQuotationRepo,
  updateRfq as updateRfqRepo,
  type QuotationLineWriteData,
  type QuotationWithDetail,
  type RfqLineWriteData,
  type RfqWithDetail,
} from "@/repositories/rfq.repository";
import { createPurchaseOrder } from "@/services/purchase-order.service";
import {
  computePurchaseTotals,
  type PurchaseLineInput,
} from "@/services/purchase-totals";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type { StockUnit } from "@/types/inventory";
import type {
  PurchaseOrderDTO,
  QuoteComparisonCellDTO,
  QuoteComparisonDTO,
  QuoteComparisonRowDTO,
  RfqDTO,
  RfqListItemDTO,
  SupplierQuotationDTO,
  SupplierQuotationListItemDTO,
} from "@/types/purchasing";

export const RFQ_NOT_FOUND = "RFQ_NOT_FOUND";
export const RFQ_NOT_DRAFT = "RFQ_NOT_DRAFT";
export const RFQ_NOT_SUBMITTED = "RFQ_NOT_SUBMITTED";
export const QUOTATION_NOT_FOUND = "QUOTATION_NOT_FOUND";
export const QUOTATION_NOT_DRAFT = "QUOTATION_NOT_DRAFT";
export const QUOTATION_NOT_SUBMITTED = "QUOTATION_NOT_SUBMITTED";
export const QUOTATION_NO_LINES = "QUOTATION_NO_LINES";

const num = (v: unknown): number => Number(v);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

// ------------------------------------------------------------------- rfq ---

export const mapRfq = (r: RfqWithDetail): RfqDTO => {
  const quotationBySupplier = new Map(
    r.quotations.map((q) => [q.supplierId, q.id]),
  );
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    transactionDate: r.transactionDate.toISOString(),
    requiredBy: iso(r.requiredBy),
    message: r.message,
    termsText: r.termsText,
    quotationCount: r.quotations.length,
    items: r.items.map((i) => ({
      id: i.id,
      stockItemId: i.stockItemId,
      stockItemName: i.stockItem.name,
      unit: i.stockItem.unit as StockUnit,
      description: i.description,
      quantity: num(i.quantity),
      requiredBy: iso(i.requiredBy),
    })),
    suppliers: r.suppliers.map((s) => ({
      id: s.id,
      supplierId: s.supplierId,
      supplierName: s.supplier.name,
      emailSentAt: iso(s.emailSentAt),
      respondedAt: iso(s.respondedAt),
      quotationId: quotationBySupplier.get(s.supplierId) ?? null,
    })),
  };
};

const loadOwnedRfq = async (
  restaurantId: string,
  id: string,
): Promise<RfqWithDetail> => {
  const rfq = await findRfqById(id);
  if (!rfq || rfq.restaurantId !== restaurantId) {
    throw new Error(RFQ_NOT_FOUND);
  }
  return rfq;
};

const toRfqLines = (
  input: CreateRfqInput | UpdateRfqInput,
): RfqLineWriteData[] =>
  input.items.map((i, index) => ({
    stockItemId: i.stockItemId,
    description: i.description ?? null,
    quantity: i.quantity,
    requiredBy: i.requiredBy ?? null,
    sortOrder: index,
  }));

/** Every invited supplier must actually accept RFQs before the doc is created. */
const assertSuppliersAcceptRfq = async (
  restaurantId: string,
  supplierIds: readonly string[],
): Promise<void> => {
  for (const supplierId of supplierIds) {
    const supplier = await loadOwnedSupplier(restaurantId, supplierId);
    assertSupplierAccepts(supplier, "RFQ");
  }
};

export const createRfq = async (
  ctx: PurchasingContext,
  input: CreateRfqInput,
): Promise<RfqDTO> => {
  await assertSuppliersAcceptRfq(ctx.restaurantId, input.supplierIds);
  return mapRfq(
    await createRfqRepo(
      ctx.restaurantId,
      ctx.userId,
      {
        transactionDate: input.transactionDate ?? new Date(),
        requiredBy: input.requiredBy ?? null,
        message: input.message ?? null,
        termsText: input.termsText ?? null,
      },
      toRfqLines(input),
      input.supplierIds,
    ),
  );
};

export const updateRfq = async (
  ctx: PurchasingContext,
  input: UpdateRfqInput,
): Promise<RfqDTO> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, input.id);
  if (rfq.status !== "DRAFT") {
    throw new Error(RFQ_NOT_DRAFT);
  }
  await assertSuppliersAcceptRfq(ctx.restaurantId, input.supplierIds);
  return mapRfq(
    await updateRfqRepo(
      rfq.id,
      {
        transactionDate: input.transactionDate ?? rfq.transactionDate,
        requiredBy: input.requiredBy ?? null,
        message: input.message ?? null,
        termsText: input.termsText ?? null,
      },
      toRfqLines(input),
      input.supplierIds,
    ),
  );
};

export const submitRfq = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, input.id);
  if (rfq.status !== "DRAFT") {
    throw new Error(RFQ_NOT_DRAFT);
  }
  await setRfqStatus(rfq.id, "SUBMITTED", { submittedAt: new Date() });
};

export const cancelRfq = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, input.id);
  if (rfq.status !== "SUBMITTED") {
    throw new Error(RFQ_NOT_SUBMITTED);
  }
  await setRfqStatus(rfq.id, "CANCELLED", { cancelledAt: new Date() });
};

export const deleteRfq = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, input.id);
  if (rfq.status !== "DRAFT") {
    throw new Error(RFQ_NOT_DRAFT);
  }
  await deleteDraftRfq(rfq.id);
};

/** Record that the request actually went out to one supplier. */
export const markRfqSent = async (
  ctx: PurchasingContext,
  input: MarkRfqSentInput,
): Promise<void> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, input.rfqId);
  if (rfq.status !== "SUBMITTED") {
    throw new Error(RFQ_NOT_SUBMITTED);
  }
  await markRfqSupplierSent(rfq.id, input.supplierId);
};

export const getRfq = async (
  ctx: PurchasingContext,
  id: string,
): Promise<RfqDTO> => mapRfq(await loadOwnedRfq(ctx.restaurantId, id));

export const listRfqs = async (
  ctx: PurchasingContext,
): Promise<RfqListItemDTO[]> =>
  (await findRfqs(ctx.restaurantId)).map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    transactionDate: r.transactionDate.toISOString(),
    requiredBy: iso(r.requiredBy),
    itemCount: r._count.items,
    supplierCount: r._count.suppliers,
    quotationCount: r._count.quotations,
  }));

// ------------------------------------------------------- supplier quotation ---

const isExpired = (validUntil: Date | null, now: Date): boolean =>
  validUntil !== null && validUntil.getTime() < now.getTime();

export const mapQuotation = (
  q: QuotationWithDetail,
  now: Date = new Date(),
): SupplierQuotationDTO => ({
  id: q.id,
  number: q.number,
  status: q.status,
  supplierId: q.supplierId,
  supplierName: q.supplier.name,
  rfqId: q.rfqId,
  rfqNumber: q.rfq?.number ?? null,
  transactionDate: q.transactionDate.toISOString(),
  validUntil: iso(q.validUntil),
  subtotal: num(q.subtotal),
  discountAmount: num(q.discountAmount),
  taxTotal: num(q.taxTotal),
  roundOff: 0,
  grandTotal: num(q.grandTotal),
  notes: q.notes,
  termsText: q.termsText,
  isExpired: isExpired(q.validUntil, now),
  items: q.items.map((i) => ({
    id: i.id,
    stockItemId: i.stockItemId,
    stockItemName: i.stockItem.name,
    unit: i.stockItem.unit as StockUnit,
    description: i.description,
    quantity: num(i.quantity),
    rate: num(i.rate),
    discountPercent: i.discountPercent != null ? num(i.discountPercent) : null,
    taxRate: num(i.taxRate),
    amount: num(i.amount),
  })),
});

const loadOwnedQuotation = async (
  restaurantId: string,
  id: string,
): Promise<QuotationWithDetail> => {
  const quotation = await findQuotationById(id);
  if (!quotation || quotation.restaurantId !== restaurantId) {
    throw new Error(QUOTATION_NOT_FOUND);
  }
  return quotation;
};

const pricedQuotation = (
  input: CreateSupplierQuotationInput | UpdateSupplierQuotationInput,
  currency: string | null,
) => {
  const lineInputs: PurchaseLineInput[] = input.items.map((i) => ({
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
  }));
  const totals = computePurchaseTotals(lineInputs, {
    documentDiscount: input.discountAmount,
  });
  const lines: QuotationLineWriteData[] = input.items.map((i, index) => ({
    stockItemId: i.stockItemId,
    rfqItemId: i.rfqItemId ?? null,
    description: i.description ?? null,
    quantity: i.quantity,
    rate: i.rate,
    discountPercent: i.discountPercent ?? null,
    taxRate: i.taxRate,
    amount: totals.lines[index].net,
    leadTimeDays: i.leadTimeDays ?? null,
    sortOrder: index,
  }));
  return {
    data: {
      supplierId: input.supplierId,
      rfqId: input.rfqId ?? null,
      transactionDate: input.transactionDate ?? new Date(),
      validUntil: input.validUntil ?? null,
      currency,
      subtotal: totals.subtotal,
      discountAmount: totals.documentDiscount,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      notes: input.notes ?? null,
      termsText: input.termsText ?? null,
    },
    lines,
  };
};

export const createSupplierQuotation = async (
  ctx: PurchasingContext,
  input: CreateSupplierQuotationInput,
): Promise<SupplierQuotationDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "RFQ");
  const { data, lines } = pricedQuotation(input, supplier.currency);
  return mapQuotation(
    await createQuotationRepo(ctx.restaurantId, ctx.userId, data, lines),
  );
};

export const updateSupplierQuotation = async (
  ctx: PurchasingContext,
  input: UpdateSupplierQuotationInput,
): Promise<SupplierQuotationDTO> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (quotation.status !== "DRAFT") {
    throw new Error(QUOTATION_NOT_DRAFT);
  }
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  const { data, lines } = pricedQuotation(input, supplier.currency);
  return mapQuotation(await updateQuotationRepo(quotation.id, data, lines));
};

export const submitSupplierQuotation = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (quotation.status !== "DRAFT") {
    throw new Error(QUOTATION_NOT_DRAFT);
  }
  await setQuotationStatus(quotation.id, "SUBMITTED", {
    submittedAt: new Date(),
  });
};

export const cancelSupplierQuotation = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (quotation.status === "DRAFT" || quotation.status === "CANCELLED") {
    throw new Error(QUOTATION_NOT_SUBMITTED);
  }
  await setQuotationStatus(quotation.id, "CANCELLED", {
    cancelledAt: new Date(),
  });
};

export const deleteSupplierQuotation = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.id);
  if (quotation.status !== "DRAFT") {
    throw new Error(QUOTATION_NOT_DRAFT);
  }
  await deleteDraftQuotation(quotation.id);
};

export const getSupplierQuotation = async (
  ctx: PurchasingContext,
  id: string,
): Promise<SupplierQuotationDTO> =>
  mapQuotation(await loadOwnedQuotation(ctx.restaurantId, id));

export const listSupplierQuotations = async (
  ctx: PurchasingContext,
  filter: { rfqId?: string; supplierId?: string } = {},
): Promise<SupplierQuotationListItemDTO[]> => {
  const now = new Date();
  return (await findQuotations(ctx.restaurantId, filter)).map((q) => ({
    id: q.id,
    number: q.number,
    status: q.status,
    supplierName: q.supplier.name,
    transactionDate: q.transactionDate.toISOString(),
    validUntil: iso(q.validUntil),
    grandTotal: num(q.grandTotal),
    isExpired: isExpired(q.validUntil, now),
  }));
};

/**
 * Line-by-line comparison of every quote against one RFQ. Each row flags the
 * cheapest rate, which is the whole point of running an RFQ — the answer should
 * be visible without arithmetic.
 */
export const compareQuotations = async (
  ctx: PurchasingContext,
  rfqId: string,
): Promise<QuoteComparisonDTO> => {
  const rfq = await loadOwnedRfq(ctx.restaurantId, rfqId);
  const quotations = await findQuotationsForRfq(rfq.id);

  const rows: QuoteComparisonRowDTO[] = rfq.items.map((item) => {
    const cells: Record<string, QuoteComparisonCellDTO> = {};
    let bestRate = Number.POSITIVE_INFINITY;

    for (const quotation of quotations) {
      const line = quotation.items.find((l) => l.rfqItemId === item.id);
      if (!line) continue;
      const rate = num(line.rate);
      if (rate < bestRate) bestRate = rate;
      cells[quotation.supplierId] = {
        quotationId: quotation.id,
        quotationItemId: line.id,
        rate,
        amount: num(line.amount),
        leadTimeDays: line.leadTimeDays,
        isBest: false,
      };
    }

    for (const key of Object.keys(cells)) {
      cells[key] = { ...cells[key], isBest: cells[key].rate === bestRate };
    }

    return {
      rfqItemId: item.id,
      stockItemId: item.stockItemId,
      stockItemName: item.stockItem.name,
      unit: item.stockItem.unit as StockUnit,
      quantity: num(item.quantity),
      cells,
    };
  });

  return {
    rfqId: rfq.id,
    rfqNumber: rfq.number,
    suppliers: quotations.map((q) => ({
      supplierId: q.supplierId,
      supplierName: q.supplier.name,
      quotationId: q.id,
      grandTotal: num(q.grandTotal),
      validUntil: iso(q.validUntil),
    })),
    rows,
  };
};

/**
 * Turn an accepted quote into a purchase order, carrying the agreed prices
 * across and marking the quotation ordered (or partly ordered when only some
 * lines were taken).
 */
export const createOrderFromQuotation = async (
  ctx: PurchasingContext,
  input: CreateOrderFromQuotationInput,
): Promise<PurchaseOrderDTO> => {
  const quotation = await loadOwnedQuotation(ctx.restaurantId, input.quotationId);
  if (quotation.status === "DRAFT" || quotation.status === "CANCELLED") {
    throw new Error(QUOTATION_NOT_SUBMITTED);
  }

  const picked = input.quotationItemIds?.length
    ? quotation.items.filter((i) => input.quotationItemIds?.includes(i.id))
    : quotation.items;
  if (picked.length === 0) {
    throw new Error(QUOTATION_NO_LINES);
  }

  const order = await createPurchaseOrder(ctx, {
    supplierId: quotation.supplierId,
    supplierQuotationId: quotation.id,
    scheduleDate: input.scheduleDate,
    discountAmount: 0,
    roundTotal: false,
    notes: `From quotation ${quotation.number}`,
    termsText: quotation.termsText ?? undefined,
    items: picked.map((i) => ({
      stockItemId: i.stockItemId,
      supplierQuotationItemId: i.id,
      description: i.description ?? undefined,
      quantity: num(i.quantity),
      rate: num(i.rate),
      discountPercent:
        i.discountPercent != null ? num(i.discountPercent) : undefined,
      taxRate: num(i.taxRate),
      scheduleDate: input.scheduleDate,
    })),
  });

  await setQuotationStatus(
    quotation.id,
    picked.length === quotation.items.length ? "ORDERED" : "PARTIALLY_ORDERED",
  );

  return order;
};
