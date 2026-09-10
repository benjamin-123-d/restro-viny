import { prisma } from "@/lib/prisma";
import type { PurchasingContext } from "@/services/supplier.service";

/**
 * Cross-module numbers. This is the one place that reads across purchasing,
 * selling and stock at once, so it queries directly rather than stacking every
 * module's list service and throwing most of the result away.
 */

export interface SeriesPoint {
  readonly label: string;
  readonly purchases: number;
  readonly sales: number;
}

export interface RankedRow {
  readonly name: string;
  readonly amount: number;
  readonly count: number;
}

export interface StatisticsDTO {
  readonly salesTotal: number;
  readonly purchaseTotal: number;
  readonly grossMargin: number;
  readonly marginPercent: number;
  readonly receivable: number;
  readonly payable: number;
  readonly overdueReceivable: number;
  readonly overduePayable: number;
  readonly stockValue: number;
  readonly lowStockCount: number;
  readonly expiringBatchCount: number;
  readonly openPurchaseOrders: number;
  readonly openSalesOrders: number;
  readonly quotationWinRate: number | null;
  readonly monthly: readonly SeriesPoint[];
  readonly topCustomers: readonly RankedRow[];
  readonly topSuppliers: readonly RankedRow[];
}

const num = (v: unknown): number => Number(v ?? 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

const MONTH_LABEL = (d: Date): string =>
  d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

const LIVE_PO = [
  "TO_RECEIVE_AND_BILL",
  "TO_RECEIVE",
  "TO_BILL",
  "ON_HOLD",
] as const;
const LIVE_SO = [
  "TO_DELIVER_AND_BILL",
  "TO_DELIVER",
  "TO_BILL",
  "ON_HOLD",
] as const;
const UNSETTLED = ["UNPAID", "PARTLY_PAID", "OVERDUE"] as const;
/** The last `months` calendar months, oldest first. */
const monthWindows = (
  months: number,
): { start: Date; end: Date; label: string }[] => {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    return { start, end, label: MONTH_LABEL(start) };
  });
};

export const getStatistics = async (
  ctx: PurchasingContext,
  opts: { months?: number } = {},
): Promise<StatisticsDTO> => {
  const rid = ctx.restaurantId;
  const now = new Date();
  const months = monthWindows(opts.months ?? 6);
  const from = months[0].start;

  const [
    salesAgg,
    purchaseAgg,
    receivableAgg,
    payableAgg,
    overdueRecvAgg,
    overduePayAgg,
    binAgg,
    stockItems,
    expiringBatches,
    openPO,
    openSO,
    quotations,
    salesByMonth,
    purchasesByMonth,
    salesByCustomer,
    purchasesBySupplier,
  ] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
      },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
      },
      _sum: { grandTotal: true },
    }),
    prisma.salesInvoice.aggregate({
      where: { restaurantId: rid, status: { in: [...UNSETTLED] } },
      _sum: { outstandingAmount: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { restaurantId: rid, status: { in: [...UNSETTLED] } },
      _sum: { outstandingAmount: true },
    }),
    prisma.salesInvoice.aggregate({
      where: {
        restaurantId: rid,
        status: { in: [...UNSETTLED] },
        dueDate: { lt: now },
      },
      _sum: { outstandingAmount: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        restaurantId: rid,
        status: { in: [...UNSETTLED] },
        dueDate: { lt: now },
      },
      _sum: { outstandingAmount: true },
    }),
    prisma.bin.aggregate({
      where: { restaurantId: rid },
      _sum: { stockValue: true },
    }),
    prisma.stockItem.findMany({
      where: { restaurantId: rid, deletedAt: null, isActive: true },
      select: { onHand: true, reorderLevel: true },
    }),
    prisma.batch.count({
      where: {
        restaurantId: rid,
        expiryDate: {
          not: null,
          lte: new Date(now.getTime() + 14 * 86_400_000),
        },
      },
    }),
    prisma.purchaseOrder.count({
      where: { restaurantId: rid, status: { in: [...LIVE_PO] } },
    }),
    prisma.salesOrder.count({
      where: { restaurantId: rid, status: { in: [...LIVE_SO] } },
    }),
    prisma.salesQuotation.groupBy({
      by: ["status"],
      where: { restaurantId: rid, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _count: { _all: true },
    }),
    prisma.salesInvoice.findMany({
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
        postingDate: { gte: from },
      },
      select: { postingDate: true, grandTotal: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
        postingDate: { gte: from },
      },
      select: { postingDate: true, grandTotal: true },
    }),
    prisma.salesInvoice.groupBy({
      by: ["customerId"],
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.purchaseInvoice.groupBy({
      by: ["supplierId"],
      where: {
        restaurantId: rid,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        isReturn: false,
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
  ]);

  // Bucket the invoices into months in one pass each.
  const monthly: SeriesPoint[] = months.map((m) => {
    const inWindow = (d: Date) => d >= m.start && d < m.end;
    return {
      label: m.label,
      sales: round2(
        salesByMonth
          .filter((r) => inWindow(r.postingDate))
          .reduce((s, r) => s + num(r.grandTotal), 0),
      ),
      purchases: round2(
        purchasesByMonth
          .filter((r) => inWindow(r.postingDate))
          .reduce((s, r) => s + num(r.grandTotal), 0),
      ),
    };
  });

  // Resolve the party names for the two leaderboards.
  const [customerNames, supplierNames] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: salesByCustomer.map((r) => r.customerId) } },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { id: { in: purchasesBySupplier.map((r) => r.supplierId) } },
      select: { id: true, name: true },
    }),
  ]);
  const customerById = new Map(customerNames.map((c) => [c.id, c.name]));
  const supplierById = new Map(supplierNames.map((s) => [s.id, s.name]));

  const rank = (
    rows: readonly {
      id: string;
      amount: number;
      count: number;
    }[],
    names: Map<string, string>,
  ): RankedRow[] =>
    rows
      .map((r) => ({
        name: names.get(r.id) ?? "Unknown",
        amount: round2(r.amount),
        count: r.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

  const salesTotal = round2(num(salesAgg._sum.grandTotal));
  const purchaseTotal = round2(num(purchaseAgg._sum.grandTotal));
  const grossMargin = round2(salesTotal - purchaseTotal);

  const ordered = quotations.reduce(
    (s, q) =>
      s +
      (q.status === "ORDERED" || q.status === "PARTIALLY_ORDERED"
        ? q._count._all
        : 0),
    0,
  );
  const decided = quotations.reduce(
    (s, q) =>
      s +
      (["ORDERED", "PARTIALLY_ORDERED", "LOST"].includes(q.status)
        ? q._count._all
        : 0),
    0,
  );

  return {
    salesTotal,
    purchaseTotal,
    grossMargin,
    marginPercent:
      salesTotal > 0 ? round2((grossMargin / salesTotal) * 100) : 0,
    receivable: round2(num(receivableAgg._sum.outstandingAmount)),
    payable: round2(num(payableAgg._sum.outstandingAmount)),
    overdueReceivable: round2(num(overdueRecvAgg._sum.outstandingAmount)),
    overduePayable: round2(num(overduePayAgg._sum.outstandingAmount)),
    stockValue: round2(num(binAgg._sum.stockValue)),
    lowStockCount: stockItems.filter(
      (i) => i.reorderLevel !== null && num(i.onHand) <= num(i.reorderLevel),
    ).length,
    expiringBatchCount: expiringBatches,
    openPurchaseOrders: openPO,
    openSalesOrders: openSO,
    // Null rather than zero when nothing has been decided yet — an unknown
    // win rate should read as unknown, not as a total failure.
    quotationWinRate: decided > 0 ? round2((ordered / decided) * 100) : null,
    monthly,
    topCustomers: rank(
      salesByCustomer.map((r) => ({
        id: r.customerId,
        amount: num(r._sum.grandTotal),
        count: r._count._all,
      })),
      customerById,
    ),
    topSuppliers: rank(
      purchasesBySupplier.map((r) => ({
        id: r.supplierId,
        amount: num(r._sum.grandTotal),
        count: r._count._all,
      })),
      supplierById,
    ),
  };
};
