import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceIdInput,
} from "@/lib/validators/purchasing";
import {
  cancelPurchaseInvoice as cancelRepo,
  createPurchaseInvoice as createRepo,
  deleteDraftPurchaseInvoice,
  findPurchaseInvoiceById,
  findPurchaseInvoices,
  findPayableInvoices,
  markOverdueInvoices,
  submitPurchaseInvoice as submitRepo,
  type PurchaseInvoiceFilter,
  type PurchaseInvoiceWithDetail,
} from "@/repositories/purchase-invoice.repository";
import { toDocumentDTO } from "@/services/purchase-document.mapper";
import { computePurchaseTotals } from "@/services/purchase-totals";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type {
  PayableInvoiceDTO,
  PurchaseInvoiceDTO,
  PurchaseInvoiceListItemDTO,
  SupplierPaymentAllocationDTO,
} from "@/types/purchasing";
import type { StockUnit } from "@/types/inventory";

export const INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND";
export const INVOICE_NOT_DRAFT = "INVOICE_NOT_DRAFT";
export const INVOICE_NOT_SUBMITTED = "INVOICE_NOT_SUBMITTED";

const num = (value: unknown): number => Number(value);
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;
const daysLate = (due: Date, now = new Date()): number =>
  Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));

const mapInvoice = (invoice: PurchaseInvoiceWithDetail): PurchaseInvoiceDTO => ({
  id: invoice.id,
  number: invoice.number,
  supplierInvoiceNo: invoice.supplierInvoiceNo,
  status: invoice.status,
  supplierId: invoice.supplierId,
  supplierName: invoice.supplier.name,
  purchaseOrderId: invoice.purchaseOrderId,
  purchaseOrderNumber: invoice.purchaseOrder?.number ?? null,
  purchaseReceiptId: invoice.purchaseReceiptId,
  purchaseReceiptNumber: invoice.purchaseReceipt?.number ?? null,
  postingDate: invoice.postingDate.toISOString(),
  dueDate: invoice.dueDate.toISOString(),
  subtotal: num(invoice.subtotal),
  discountAmount: num(invoice.discountAmount),
  taxTotal: num(invoice.taxTotal),
  roundOff: num(invoice.roundOff),
  grandTotal: num(invoice.grandTotal),
  paidAmount: num(invoice.paidAmount),
  outstandingAmount: num(invoice.outstandingAmount),
  updateStock: invoice.updateStock,
  isReturn: invoice.isReturn,
  notes: invoice.notes,
  termsText: invoice.termsText,
  isEditable: invoice.status === "DRAFT",
  daysOverdue: ["UNPAID", "PARTLY_PAID", "OVERDUE"].includes(invoice.status)
    ? daysLate(invoice.dueDate)
    : 0,
  summaryOnly: invoice.summaryOnly,
  documents: invoice.documents.map(toDocumentDTO),
  items: invoice.items.map((item) => ({
    id: item.id,
    stockItemId: item.stockItemId,
    stockItemName: item.stockItem.name,
    unit: item.stockItem.unit as StockUnit,
    description: item.description,
    quantity: num(item.quantity),
    rate: num(item.rate),
    discountPercent: item.discountPercent == null ? null : num(item.discountPercent),
    taxRate: num(item.taxRate),
    amount: num(item.amount),
    purchaseOrderItemId: item.purchaseOrderItemId,
    purchaseReceiptItemId: item.purchaseReceiptItemId,
  })),
  schedule: invoice.schedule.map((row) => ({
    id: row.id,
    dueDate: row.dueDate.toISOString(),
    invoicePortion: num(row.invoicePortion),
    amount: num(row.amount),
    paidAmount: num(row.paidAmount),
  })),
  payments: invoice.allocations.map((row): SupplierPaymentAllocationDTO => ({
    id: row.id,
    supplierPaymentId: row.supplierPaymentId,
    paymentNumber: row.supplierPayment.number,
    purchaseInvoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amount: num(row.amount),
    paymentDate: row.supplierPayment.paymentDate.toISOString(),
    mode: row.supplierPayment.mode,
  })),
});

const loadOwnedInvoice = async (restaurantId: string, id: string) => {
  const invoice = await findPurchaseInvoiceById(id);
  if (!invoice || invoice.restaurantId !== restaurantId) throw new Error(INVOICE_NOT_FOUND);
  return invoice;
};

export const createPurchaseInvoice = async (
  ctx: PurchasingContext,
  input: CreatePurchaseInvoiceInput,
): Promise<PurchaseInvoiceDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "INVOICES");
  const totals = computePurchaseTotals(
    input.items.map((item) => ({
      quantity: item.quantity,
      rate: item.rate,
      discountPercent: item.discountPercent ?? null,
      taxRate: item.taxRate,
    })),
    { documentDiscount: input.discountAmount, roundTotal: input.roundTotal },
  );
  const postingDate = input.postingDate ?? new Date();
  const dueDate = input.dueDate ?? new Date(postingDate.getTime() + (supplier.paymentTermsDays ?? 0) * 86_400_000);
  const schedule = input.schedule?.length
    ? input.schedule
    : [{ dueDate, invoicePortion: 100, amount: totals.grandTotal }];
  return mapInvoice(await createRepo(ctx.restaurantId, ctx.userId, {
    supplierId: input.supplierId,
    supplierInvoiceNo: input.supplierInvoiceNo ?? null,
    purchaseOrderId: input.purchaseOrderId ?? null,
    purchaseReceiptId: input.purchaseReceiptId ?? null,
    postingDate,
    dueDate,
    currency: supplier.currency,
    subtotal: totals.subtotal,
    discountAmount: totals.documentDiscount,
    taxTotal: totals.taxTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    outstandingAmount: totals.grandTotal,
    updateStock: input.updateStock,
    isReturn: false,
    returnAgainstId: null,
    notes: input.notes ?? null,
    termsText: input.termsText ?? null,
  }, input.items.map((item, sortOrder) => ({
    stockItemId: item.stockItemId,
    purchaseOrderItemId: item.purchaseOrderItemId ?? null,
    purchaseReceiptItemId: item.purchaseReceiptItemId ?? null,
    description: item.description ?? null,
    quantity: item.quantity,
    rate: item.rate,
    discountPercent: item.discountPercent ?? null,
    taxRate: item.taxRate,
    amount: totals.lines[sortOrder].net,
    sortOrder,
  })), schedule.map((row, sortOrder) => ({ ...row, sortOrder }))));
};

export const submitPurchaseInvoice = async (ctx: PurchasingContext, input: PurchaseInvoiceIdInput): Promise<void> => {
  const invoice = await loadOwnedInvoice(ctx.restaurantId, input.id);
  if (invoice.status !== "DRAFT") throw new Error(INVOICE_NOT_DRAFT);
  await submitRepo(invoice.id, ctx.userId);
};

export const cancelPurchaseInvoice = async (ctx: PurchasingContext, input: PurchaseInvoiceIdInput): Promise<void> => {
  const invoice = await loadOwnedInvoice(ctx.restaurantId, input.id);
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") throw new Error(INVOICE_NOT_SUBMITTED);
  await cancelRepo(invoice.id, ctx.userId);
};

export const deletePurchaseInvoice = async (ctx: PurchasingContext, input: PurchaseInvoiceIdInput): Promise<void> => {
  const invoice = await loadOwnedInvoice(ctx.restaurantId, input.id);
  if (invoice.status !== "DRAFT") throw new Error(INVOICE_NOT_DRAFT);
  await deleteDraftPurchaseInvoice(invoice.id);
};

export const listPurchaseInvoices = async (ctx: PurchasingContext, filter: PurchaseInvoiceFilter = {}): Promise<PurchaseInvoiceListItemDTO[]> => {
  await markOverdueInvoices(ctx.restaurantId, new Date());
  return (await findPurchaseInvoices(ctx.restaurantId, filter)).map((invoice) => ({
    id: invoice.id, number: invoice.number, supplierInvoiceNo: invoice.supplierInvoiceNo,
    status: invoice.status, supplierName: invoice.supplier.name,
    postingDate: invoice.postingDate.toISOString(), dueDate: invoice.dueDate.toISOString(),
    grandTotal: num(invoice.grandTotal), outstandingAmount: num(invoice.outstandingAmount),
    daysOverdue: ["UNPAID", "PARTLY_PAID", "OVERDUE"].includes(invoice.status) ? daysLate(invoice.dueDate) : 0,
    summaryOnly: invoice.summaryOnly,
    documentCount: invoice._count.documents,
  }));
};

export const listPayableInvoices = async (ctx: PurchasingContext, supplierId: string): Promise<PayableInvoiceDTO[]> =>
  (await findPayableInvoices(ctx.restaurantId, supplierId)).map((invoice) => ({
    id: invoice.id, number: invoice.number, supplierInvoiceNo: invoice.supplierInvoiceNo,
    postingDate: invoice.postingDate.toISOString(), dueDate: invoice.dueDate.toISOString(),
    grandTotal: num(invoice.grandTotal), outstandingAmount: num(invoice.outstandingAmount),
    daysOverdue: daysLate(invoice.dueDate),
  }));

export const getPurchaseInvoice = async (ctx: PurchasingContext, id: string): Promise<PurchaseInvoiceDTO> =>
  mapInvoice(await loadOwnedInvoice(ctx.restaurantId, id));
