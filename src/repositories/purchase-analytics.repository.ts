import { prisma } from "@/lib/prisma";

/** Everything bought over a period, whichever way it was recorded. */

export const findInvoicesInPeriod = (restaurantId: string, from: Date, to: Date) =>
  prisma.purchaseInvoice.findMany({
    where: {
      restaurantId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      postingDate: { gte: from, lt: to },
    },
    orderBy: { postingDate: "desc" },
    select: {
      id: true,
      number: true,
      postingDate: true,
      dueDate: true,
      status: true,
      isReturn: true,
      isDirectPurchase: true,
      summaryOnly: true,
      subtotal: true,
      taxTotal: true,
      grandTotal: true,
      outstandingAmount: true,
      supplierId: true,
      supplier: { select: { name: true } },
      expenseLines: { select: { category: true, amountHT: true } },
      _count: { select: { documents: true } },
    },
  });

/** Market purchases typed ingredient by ingredient, for the price watch. */
export const findIngredientPurchasesInPeriod = (restaurantId: string, from: Date, to: Date) =>
  prisma.ingredientPurchase.findMany({
    where: { restaurantId, purchasedAt: { gte: from, lt: to } },
    orderBy: { purchasedAt: "asc" },
    select: {
      id: true,
      purchasedAt: true,
      quantity: true,
      amount: true,
      stockItemId: true,
      stockItem: { select: { name: true, purchaseUnit: true, unit: true } },
    },
  });

/** What is still owed to suppliers right now, whatever the period shown. */
export const findOutstandingInvoices = (restaurantId: string) =>
  prisma.purchaseInvoice.findMany({
    where: { restaurantId, status: { in: ["UNPAID", "PARTLY_PAID", "OVERDUE"] } },
    select: { id: true, dueDate: true, outstandingAmount: true, supplier: { select: { name: true } } },
  });
