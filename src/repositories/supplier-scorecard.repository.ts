import type { Prisma, ScorecardStanding } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface ScorecardWindow {
  readonly restaurantId: string;
  readonly supplierId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface ScorecardFacts {
  readonly orders: readonly { grandTotal: Prisma.Decimal }[];
  readonly receipts: readonly {
    postingDate: Date;
    purchaseOrder: { scheduleDate: Date | null } | null;
    items: readonly {
      quantity: Prisma.Decimal;
      rejectedQuantity: Prisma.Decimal;
    }[];
  }[];
  readonly invoicedTotal: number;
}

/** Everything a scorecard is computed from, for one supplier over one window. */
export const findScorecardFacts = async (
  window: ScorecardWindow,
): Promise<ScorecardFacts> => {
  const range = { gte: window.periodStart, lte: window.periodEnd };
  const [orders, receipts, invoiceAgg] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        restaurantId: window.restaurantId,
        supplierId: window.supplierId,
        status: { not: "CANCELLED" },
        transactionDate: range,
      },
      select: { grandTotal: true },
    }),
    prisma.purchaseReceipt.findMany({
      where: {
        restaurantId: window.restaurantId,
        supplierId: window.supplierId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        postingDate: range,
      },
      select: {
        postingDate: true,
        purchaseOrder: { select: { scheduleDate: true } },
        items: { select: { quantity: true, rejectedQuantity: true } },
      },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        restaurantId: window.restaurantId,
        supplierId: window.supplierId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
        postingDate: range,
      },
      _sum: { grandTotal: true },
    }),
  ]);

  return {
    orders,
    receipts,
    invoicedTotal: Number(invoiceAgg._sum.grandTotal ?? 0),
  };
};

export interface ScorecardWriteData {
  onTimeDeliveryPercent: number;
  qualityAcceptedPercent: number;
  priceVariancePercent: number;
  totalOrders: number;
  totalReceipts: number;
  totalPurchaseAmount: number;
  score: number;
  standing: ScorecardStanding;
}

const withSupplier = {
  supplier: { select: { name: true } },
} satisfies Prisma.SupplierScorecardPeriodInclude;

export type ScorecardWithSupplier = Prisma.SupplierScorecardPeriodGetPayload<{
  include: typeof withSupplier;
}>;

/** Upsert so re-running a period corrects it instead of stacking duplicates. */
export const upsertScorecard = (
  window: ScorecardWindow,
  data: ScorecardWriteData,
): Promise<ScorecardWithSupplier> =>
  prisma.supplierScorecardPeriod.upsert({
    where: {
      supplierId_periodStart_periodEnd: {
        supplierId: window.supplierId,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
      },
    },
    create: {
      restaurantId: window.restaurantId,
      supplierId: window.supplierId,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      ...data,
    },
    update: { ...data, generatedAt: new Date() },
    include: withSupplier,
  });

export const findScorecards = (
  restaurantId: string,
  supplierId?: string,
): Promise<ScorecardWithSupplier[]> =>
  prisma.supplierScorecardPeriod.findMany({
    where: { restaurantId, ...(supplierId ? { supplierId } : {}) },
    include: withSupplier,
    orderBy: [{ periodEnd: "desc" }, { score: "desc" }],
  });
