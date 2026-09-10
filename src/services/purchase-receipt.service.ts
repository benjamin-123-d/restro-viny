import type { PurchaseReceiptStatus } from "@/generated/prisma/client";
import type {
  CreatePurchaseReceiptInput,
  PurchaseReceiptIdInput,
} from "@/lib/validators/purchasing";
import {
  cancelPurchaseReceipt as cancelRepo,
  createPurchaseReceipt as createRepo,
  deleteDraftPurchaseReceipt,
  findPurchaseReceiptById,
  findPurchaseReceipts,
  submitPurchaseReceipt as submitRepo,
  type PurchaseReceiptFilter,
  type PurchaseReceiptWithDetail,
} from "@/repositories/purchase-receipt.repository";
import { computePurchaseTotals } from "@/services/purchase-totals";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type {
  PurchaseReceiptDTO,
  PurchaseReceiptListItemDTO,
} from "@/types/purchasing";
import type { StockUnit } from "@/types/inventory";

export const RECEIPT_NOT_FOUND = "RECEIPT_NOT_FOUND";
export const RECEIPT_NOT_DRAFT = "RECEIPT_NOT_DRAFT";
export const RECEIPT_NOT_SUBMITTED = "RECEIPT_NOT_SUBMITTED";

const num = (value: unknown): number => Number(value);
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

const mapReceipt = (receipt: PurchaseReceiptWithDetail): PurchaseReceiptDTO => ({
  id: receipt.id,
  number: receipt.number,
  status: receipt.status,
  supplierId: receipt.supplierId,
  supplierName: receipt.supplier.name,
  purchaseOrderId: receipt.purchaseOrderId,
  purchaseOrderNumber: receipt.purchaseOrder?.number ?? null,
  postingDate: receipt.postingDate.toISOString(),
  supplierDeliveryNote: receipt.supplierDeliveryNote,
  subtotal: num(receipt.subtotal),
  taxTotal: num(receipt.taxTotal),
  grandTotal: num(receipt.grandTotal),
  billedPercent: num(receipt.billedPercent),
  isReturn: receipt.isReturn,
  notes: receipt.notes,
  isEditable: receipt.status === "DRAFT",
  items: receipt.items.map((item) => ({
    id: item.id,
    stockItemId: item.stockItemId,
    stockItemName: item.stockItem.name,
    unit: item.stockItem.unit as StockUnit,
    description: item.description,
    quantity: num(item.quantity),
    rejectedQuantity: num(item.rejectedQuantity),
    rate: num(item.rate),
    discountPercent: null,
    taxRate: num(item.taxRate),
    amount: num(item.amount),
    batchNo: item.batchNo,
    expiryDate: iso(item.expiryDate),
    purchaseOrderItemId: item.purchaseOrderItemId,
    billedQty: num(item.billedQty),
  })),
});

const loadOwnedReceipt = async (
  restaurantId: string,
  id: string,
): Promise<PurchaseReceiptWithDetail> => {
  const receipt = await findPurchaseReceiptById(id);
  if (!receipt || receipt.restaurantId !== restaurantId) {
    throw new Error(RECEIPT_NOT_FOUND);
  }
  return receipt;
};

export const createPurchaseReceipt = async (
  ctx: PurchasingContext,
  input: CreatePurchaseReceiptInput,
): Promise<PurchaseReceiptDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "ORDERS");
  const totals = computePurchaseTotals(
    input.items.map((item) => ({
      quantity: item.quantity,
      rate: item.rate,
      discountPercent: null,
      taxRate: item.taxRate,
    })),
    { documentDiscount: 0, roundTotal: false },
  );
  const receipt = await createRepo(
    ctx.restaurantId,
    ctx.userId,
    {
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      postingDate: input.postingDate ?? new Date(),
      supplierDeliveryNote: input.supplierDeliveryNote ?? null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      isReturn: false,
      returnAgainstId: null,
      notes: input.notes ?? null,
    },
    input.items.map((item, sortOrder) => ({
      stockItemId: item.stockItemId,
      purchaseOrderItemId: item.purchaseOrderItemId ?? null,
      description: item.description ?? null,
      quantity: item.quantity,
      rejectedQuantity: item.rejectedQuantity,
      rate: item.rate,
      taxRate: item.taxRate,
      amount: totals.lines[sortOrder].net,
      batchNo: item.batchNo ?? null,
      expiryDate: item.expiryDate ?? null,
      sortOrder,
    })),
  );
  return mapReceipt(receipt);
};

export const submitPurchaseReceipt = async (
  ctx: PurchasingContext,
  input: PurchaseReceiptIdInput,
): Promise<void> => {
  const receipt = await loadOwnedReceipt(ctx.restaurantId, input.id);
  if (receipt.status !== "DRAFT") throw new Error(RECEIPT_NOT_DRAFT);
  await submitRepo(receipt.id, ctx.userId);
};

export const cancelPurchaseReceipt = async (
  ctx: PurchasingContext,
  input: PurchaseReceiptIdInput,
): Promise<void> => {
  const receipt = await loadOwnedReceipt(ctx.restaurantId, input.id);
  if (!["TO_BILL", "PARTLY_BILLED", "COMPLETED", "RETURN"].includes(receipt.status)) {
    throw new Error(RECEIPT_NOT_SUBMITTED);
  }
  await cancelRepo(receipt.id, ctx.userId);
};

export const deletePurchaseReceipt = async (
  ctx: PurchasingContext,
  input: PurchaseReceiptIdInput,
): Promise<void> => {
  const receipt = await loadOwnedReceipt(ctx.restaurantId, input.id);
  if (receipt.status !== "DRAFT") throw new Error(RECEIPT_NOT_DRAFT);
  await deleteDraftPurchaseReceipt(receipt.id);
};

export const getPurchaseReceipt = async (
  ctx: PurchasingContext,
  id: string,
): Promise<PurchaseReceiptDTO> => mapReceipt(await loadOwnedReceipt(ctx.restaurantId, id));

export const listPurchaseReceipts = async (
  ctx: PurchasingContext,
  filter: PurchaseReceiptFilter = {},
): Promise<PurchaseReceiptListItemDTO[]> =>
  (await findPurchaseReceipts(ctx.restaurantId, filter)).map((receipt) => ({
    id: receipt.id,
    number: receipt.number,
    status: receipt.status as PurchaseReceiptStatus,
    supplierName: receipt.supplier.name,
    postingDate: receipt.postingDate.toISOString(),
    grandTotal: num(receipt.grandTotal),
    billedPercent: num(receipt.billedPercent),
    isReturn: receipt.isReturn,
  }));
