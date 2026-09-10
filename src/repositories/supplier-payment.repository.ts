import type {
  PaymentMode,
  Prisma,
  PurchaseInvoiceStatus,
  SupplierPayment,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";

export interface SupplierPaymentWriteData {
  supplierId: string;
  paymentDate: Date;
  mode: PaymentMode;
  amount: number;
  unallocatedAmount: number;
  referenceNo: string | null;
  referenceDate: Date | null;
  notes: string | null;
}

export interface PaymentAllocationWriteData {
  purchaseInvoiceId: string;
  amount: number;
}

const detail = {
  supplier: { select: { id: true, name: true } },
  allocations: {
    include: {
      purchaseInvoice: { select: { id: true, number: true } },
    },
  },
} satisfies Prisma.SupplierPaymentInclude;

export type SupplierPaymentWithDetail = Prisma.SupplierPaymentGetPayload<{
  include: typeof detail;
}>;

/** Settlement state of one bill, recomputed from its allocations. */
const settle = (
  grandTotal: number,
  paidAmount: number,
  dueDate: Date,
  now: Date,
): { status: PurchaseInvoiceStatus; outstandingAmount: number } => {
  const outstanding = Math.round((grandTotal - paidAmount) * 100) / 100;
  if (outstanding <= 0.01) {
    return { status: "PAID", outstandingAmount: 0 };
  }
  if (dueDate.getTime() < now.getTime()) {
    return { status: "OVERDUE", outstandingAmount: outstanding };
  }
  return {
    status: paidAmount > 0.01 ? "PARTLY_PAID" : "UNPAID",
    outstandingAmount: outstanding,
  };
};

/**
 * Recompute a bill's paid/outstanding from the allocations that actually exist,
 * rather than incrementing a running total. Re-deriving means a reversed or
 * edited payment can never leave the payable drifting.
 */
export const recalcInvoiceSettlement = async (
  tx: Prisma.TransactionClient,
  purchaseInvoiceId: string,
  now: Date,
): Promise<void> => {
  const invoice = await tx.purchaseInvoice.findUniqueOrThrow({
    where: { id: purchaseInvoiceId },
    select: { grandTotal: true, dueDate: true, status: true },
  });
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return;

  const sum = await tx.supplierPaymentAllocation.aggregate({
    where: { purchaseInvoiceId },
    _sum: { amount: true },
  });
  const paidAmount = Number(sum._sum.amount ?? 0);
  const { status, outstandingAmount } = settle(
    Number(invoice.grandTotal),
    paidAmount,
    invoice.dueDate,
    now,
  );

  await tx.purchaseInvoice.update({
    where: { id: purchaseInvoiceId },
    data: { paidAmount, outstandingAmount, status },
  });

  // Fill the instalment schedule oldest first, so each row shows what it owes.
  const rows = await tx.purchasePaymentSchedule.findMany({
    where: { purchaseInvoiceId },
    orderBy: { sortOrder: "asc" },
  });
  let left = paidAmount;
  for (const row of rows) {
    const applied = Math.min(left, Number(row.amount));
    left = Math.max(0, left - applied);
    await tx.purchasePaymentSchedule.update({
      where: { id: row.id },
      data: { paidAmount: applied },
    });
  }
};

export const createSupplierPayment = (
  restaurantId: string,
  createdById: string,
  data: SupplierPaymentWriteData,
  allocations: readonly PaymentAllocationWriteData[],
  now: Date,
): Promise<SupplierPaymentWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "PPAY", tx);
    const payment = await tx.supplierPayment.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        allocations: { create: allocations.map((a) => ({ ...a })) },
      },
      include: detail,
    });
    for (const allocation of allocations) {
      await recalcInvoiceSettlement(tx, allocation.purchaseInvoiceId, now);
    }
    return payment;
  });

/**
 * Delete a payment and re-settle every bill it touched. Deleting is safe here
 * because settlement is derived, never accumulated.
 */
export const deleteSupplierPayment = (
  paymentId: string,
  now: Date,
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    const allocations = await tx.supplierPaymentAllocation.findMany({
      where: { supplierPaymentId: paymentId },
      select: { purchaseInvoiceId: true },
    });
    await tx.supplierPayment.delete({ where: { id: paymentId } });
    for (const allocation of allocations) {
      await recalcInvoiceSettlement(tx, allocation.purchaseInvoiceId, now);
    }
  });

export const findSupplierPaymentById = (
  id: string,
): Promise<SupplierPaymentWithDetail | null> =>
  prisma.supplierPayment.findUnique({ where: { id }, include: detail });

export const findSupplierPayments = (
  restaurantId: string,
  filter: { supplierId?: string; take?: number } = {},
): Promise<SupplierPaymentWithDetail[]> =>
  prisma.supplierPayment.findMany({
    where: {
      restaurantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
    },
    include: detail,
    orderBy: [{ paymentDate: "desc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

/** Every allocation against one bill, for its payment history panel. */
export const findAllocationsForInvoice = (purchaseInvoiceId: string) =>
  prisma.supplierPaymentAllocation.findMany({
    where: { purchaseInvoiceId },
    include: {
      supplierPayment: {
        select: { id: true, number: true, paymentDate: true, mode: true },
      },
    },
    orderBy: { supplierPayment: { paymentDate: "asc" } },
  });
