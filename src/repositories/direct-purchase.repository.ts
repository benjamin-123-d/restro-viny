import type { PurchasingMode } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExpenseLineWriteData } from "@/repositories/purchase-invoice.repository";

// ------------------------------------------------------------- settings ---

export const findPurchasingMode = async (restaurantId: string): Promise<PurchasingMode> =>
  (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { purchasingMode: true } }))
    ?.purchasingMode ?? "FULL";

export const updatePurchasingMode = (restaurantId: string, mode: PurchasingMode) =>
  prisma.restaurant.update({ where: { id: restaurantId }, data: { purchasingMode: mode }, select: { purchasingMode: true } });

// ------------------------------------------------------------ suppliers ---

/** A shop typed by hand is found whatever its capitals. */
export const findSupplierByNameInsensitive = (restaurantId: string, name: string) =>
  prisma.supplier.findFirst({
    where: { restaurantId, deletedAt: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });

// ------------------------------------------------------ direct purchases ---

export const findDirectPurchases = (restaurantId: string, take = 200) =>
  prisma.purchaseInvoice.findMany({
    where: { restaurantId, isDirectPurchase: true },
    orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      number: true,
      status: true,
      supplierInvoiceNo: true,
      postingDate: true,
      grandTotal: true,
      subtotal: true,
      outstandingAmount: true,
      paymentMode: true,
      supplier: { select: { name: true } },
      expenseLines: { select: { category: true, amountHT: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { documents: true, ingredientPurchases: true } },
    },
  });

export const findInvoiceExpenseLines = (purchaseInvoiceId: string) =>
  prisma.purchaseExpenseLine.findMany({ where: { purchaseInvoiceId }, orderBy: { sortOrder: "asc" } });

export const findIngredientPurchasesOfInvoice = (purchaseInvoiceId: string) =>
  prisma.ingredientPurchase.findMany({
    where: { purchaseInvoiceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quantity: true,
      amount: true,
      usageQuantity: true,
      stockItem: { select: { name: true, unit: true, purchaseUnit: true } },
    },
  });

/** Replaces the whole breakdown of one invoice. */
export const replaceExpenseLines = (
  restaurantId: string,
  purchaseInvoiceId: string,
  lines: readonly ExpenseLineWriteData[],
) =>
  prisma.$transaction([
    prisma.purchaseExpenseLine.deleteMany({ where: { purchaseInvoiceId } }),
    prisma.purchaseExpenseLine.createMany({
      data: lines.map((line, sortOrder) => ({ ...line, restaurantId, purchaseInvoiceId, sortOrder })),
    }),
  ]);

// -------------------------------------------------------------- spending ---

/** Every submitted invoice of the period, with its breakdown when it has one. */
export const findSpendingInPeriod = (restaurantId: string, from: Date, to: Date) =>
  prisma.purchaseInvoice.findMany({
    where: {
      restaurantId,
      isReturn: false,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      postingDate: { gte: from, lt: to },
    },
    select: {
      id: true,
      subtotal: true,
      summaryOnly: true,
      isDirectPurchase: true,
      expenseLines: { select: { category: true, amountHT: true } },
    },
  });
