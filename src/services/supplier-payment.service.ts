import type {
  CreateSupplierPaymentInput,
  SupplierPaymentIdInput,
} from "@/lib/validators/purchasing";
import {
  createSupplierPayment as createRepo,
  deleteSupplierPayment,
  findSupplierPaymentById,
  findSupplierPayments,
} from "@/repositories/supplier-payment.repository";
import { findPurchaseInvoiceById } from "@/repositories/purchase-invoice.repository";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type { SupplierPaymentDTO } from "@/types/purchasing";

export const PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND";
export const PAYMENT_ALLOCATION_INVALID = "PAYMENT_ALLOCATION_INVALID";

const num = (value: unknown): number => Number(value);
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

const mapPayment = (payment: NonNullable<Awaited<ReturnType<typeof findSupplierPaymentById>>>): SupplierPaymentDTO => ({
  id: payment.id,
  number: payment.number,
  supplierId: payment.supplierId,
  supplierName: payment.supplier.name,
  paymentDate: payment.paymentDate.toISOString(),
  mode: payment.mode,
  amount: num(payment.amount),
  unallocatedAmount: num(payment.unallocatedAmount),
  referenceNo: payment.referenceNo,
  referenceDate: iso(payment.referenceDate),
  notes: payment.notes,
  allocations: payment.allocations.map((allocation) => ({
    id: allocation.id,
    supplierPaymentId: payment.id,
    paymentNumber: payment.number,
    purchaseInvoiceId: allocation.purchaseInvoiceId,
    invoiceNumber: allocation.purchaseInvoice.number,
    amount: num(allocation.amount),
    paymentDate: payment.paymentDate.toISOString(),
    mode: payment.mode,
  })),
});

export const createSupplierPayment = async (
  ctx: PurchasingContext,
  input: CreateSupplierPaymentInput,
): Promise<SupplierPaymentDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "PAYMENTS");
  const allocated = input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  for (const allocation of input.allocations) {
    const invoice = await findPurchaseInvoiceById(allocation.purchaseInvoiceId);
    if (!invoice || invoice.restaurantId !== ctx.restaurantId || invoice.supplierId !== supplier.id || invoice.status === "DRAFT" || invoice.status === "CANCELLED" || allocation.amount > num(invoice.outstandingAmount) + 0.01) {
      throw new Error(PAYMENT_ALLOCATION_INVALID);
    }
  }

  return mapPayment(await createRepo(ctx.restaurantId, ctx.userId, {
    supplierId: supplier.id,
    paymentDate: input.paymentDate ?? new Date(),
    mode: input.mode,
    amount: input.amount,
    unallocatedAmount: Math.max(0, input.amount - allocated),
    referenceNo: input.referenceNo ?? null,
    referenceDate: input.referenceDate ?? null,
    notes: input.notes ?? null,
  }, input.allocations, new Date()));
};

export const listSupplierPayments = async (
  ctx: PurchasingContext,
  supplierId?: string,
): Promise<SupplierPaymentDTO[]> =>
  (await findSupplierPayments(ctx.restaurantId, { supplierId })).map(mapPayment);

export const removeSupplierPayment = async (
  ctx: PurchasingContext,
  input: SupplierPaymentIdInput,
): Promise<void> => {
  const payment = await findSupplierPaymentById(input.id);
  if (!payment || payment.restaurantId !== ctx.restaurantId) throw new Error(PAYMENT_NOT_FOUND);
  await deleteSupplierPayment(payment.id, new Date());
};
