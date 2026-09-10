import type {
  Prisma,
  Supplier,
  SupplierGroup,
  SupplierHoldType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// -------------------------------------------------------- supplier group ---

export interface SupplierGroupWriteData {
  name: string;
  defaultPaymentTermsDays: number | null;
  notes: string | null;
}

export type SupplierGroupWithCount = SupplierGroup & {
  _count: { suppliers: number };
};

export const createSupplierGroup = (
  restaurantId: string,
  data: SupplierGroupWriteData,
): Promise<SupplierGroup> =>
  prisma.supplierGroup.create({ data: { restaurantId, ...data } });

export const updateSupplierGroup = (
  id: string,
  data: SupplierGroupWriteData,
): Promise<SupplierGroup> =>
  prisma.supplierGroup.update({ where: { id }, data });

export const reviveSupplierGroup = (
  id: string,
  data: SupplierGroupWriteData,
): Promise<SupplierGroup> =>
  prisma.supplierGroup.update({
    where: { id },
    data: { ...data, deletedAt: null },
  });

export const softDeleteSupplierGroup = (id: string): Promise<SupplierGroup> =>
  prisma.supplierGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

export const findSupplierGroupById = (
  id: string,
): Promise<SupplierGroup | null> =>
  prisma.supplierGroup.findUnique({ where: { id } });

export const findSupplierGroupByName = (
  restaurantId: string,
  name: string,
): Promise<SupplierGroup | null> =>
  prisma.supplierGroup.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findSupplierGroups = (
  restaurantId: string,
): Promise<SupplierGroupWithCount[]> =>
  prisma.supplierGroup.findMany({
    where: { restaurantId, deletedAt: null },
    include: { _count: { select: { suppliers: true } } },
    orderBy: { name: "asc" },
  });

/** How many live suppliers still point at a group — blocks its deletion. */
export const countSuppliersInGroup = (groupId: string): Promise<number> =>
  prisma.supplier.count({ where: { supplierGroupId: groupId, deletedAt: null } });

// -------------------------------------------------------------- supplier ---

export interface SupplierWriteData {
  name: string;
  supplierGroupId: string | null;
  taxId: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  currency: string | null;
  paymentTermsDays: number | null;
  preventRfq: boolean;
  preventPo: boolean;
  disabled: boolean;
  notes: string | null;
}

export type SupplierWithGroup = Supplier & {
  supplierGroup: SupplierGroup | null;
};

const withGroup = { supplierGroup: true } satisfies Prisma.SupplierInclude;

export const createSupplier = (
  restaurantId: string,
  code: string,
  data: SupplierWriteData,
): Promise<SupplierWithGroup> =>
  prisma.supplier.create({
    data: { restaurantId, code, ...data },
    include: withGroup,
  });

export const updateSupplier = (
  id: string,
  data: SupplierWriteData,
): Promise<SupplierWithGroup> =>
  prisma.supplier.update({ where: { id }, data, include: withGroup });

export const reviveSupplier = (
  id: string,
  data: SupplierWriteData,
): Promise<SupplierWithGroup> =>
  prisma.supplier.update({
    where: { id },
    data: { ...data, deletedAt: null },
    include: withGroup,
  });

export const softDeleteSupplier = (id: string): Promise<Supplier> =>
  prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date(), disabled: true },
  });

export const setSupplierHold = (
  id: string,
  hold: {
    onHold: boolean;
    holdType: SupplierHoldType | null;
    releaseDate: Date | null;
  },
): Promise<SupplierWithGroup> =>
  prisma.supplier.update({ where: { id }, data: hold, include: withGroup });

export const findSupplierById = (
  id: string,
): Promise<SupplierWithGroup | null> =>
  prisma.supplier.findUnique({ where: { id }, include: withGroup });

export const findSupplierByName = (
  restaurantId: string,
  name: string,
): Promise<Supplier | null> =>
  prisma.supplier.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findSuppliersByRestaurant = (
  restaurantId: string,
  opts: { includeDisabled?: boolean; search?: string } = {},
): Promise<SupplierWithGroup[]> =>
  prisma.supplier.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      ...(opts.includeDisabled ? {} : { disabled: false }),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: "insensitive" } },
              { code: { contains: opts.search, mode: "insensitive" } },
              { phone: { contains: opts.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: withGroup,
    orderBy: { name: "asc" },
  });

/** Highest numeric suffix already issued, so codes stay gap-free per restaurant. */
export const maxSupplierCode = async (
  restaurantId: string,
): Promise<number> => {
  const rows = await prisma.supplier.findMany({
    where: { restaurantId },
    select: { code: true },
  });
  return rows.reduce((max, row) => {
    const n = Number(row.code.replace(/\D/g, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
};

/** Link a stock item to its usual supplier (or clear the link). */
export const setStockItemDefaultSupplier = (
  stockItemId: string,
  supplierId: string | null,
): Promise<void> =>
  prisma.stockItem
    .update({ where: { id: stockItemId }, data: { defaultSupplierId: supplierId } })
    .then(() => undefined);

// ------------------------------------------------------------- reporting ---

export interface SupplierMoneyRow {
  supplierId: string;
  openOrderCount: number;
  outstandingAmount: number;
  overdueAmount: number;
  totalPurchased: number;
  lastOrderDate: Date | null;
}

const OPEN_ORDER_STATUSES = [
  "TO_RECEIVE_AND_BILL",
  "TO_RECEIVE",
  "TO_BILL",
  "ON_HOLD",
] as const;

const UNSETTLED_INVOICE_STATUSES = [
  "UNPAID",
  "PARTLY_PAID",
  "OVERDUE",
] as const;

/**
 * One pass over orders and invoices to build every supplier's money view.
 * Grouped in the database rather than per supplier, so the suppliers list stays
 * a fixed number of queries however many vendors exist.
 */
export const findSupplierMoneyRows = async (
  restaurantId: string,
  now: Date,
): Promise<SupplierMoneyRow[]> => {
  const [openOrders, lastOrders, purchased, outstanding, overdue] =
    await Promise.all([
      prisma.purchaseOrder.groupBy({
        by: ["supplierId"],
        where: { restaurantId, status: { in: [...OPEN_ORDER_STATUSES] } },
        _count: { _all: true },
      }),
      prisma.purchaseOrder.groupBy({
        by: ["supplierId"],
        where: { restaurantId, status: { not: "CANCELLED" } },
        _max: { transactionDate: true },
      }),
      prisma.purchaseInvoice.groupBy({
        by: ["supplierId"],
        where: {
          restaurantId,
          status: { notIn: ["DRAFT", "CANCELLED"] },
          isReturn: false,
        },
        _sum: { grandTotal: true },
      }),
      prisma.purchaseInvoice.groupBy({
        by: ["supplierId"],
        where: {
          restaurantId,
          status: { in: [...UNSETTLED_INVOICE_STATUSES] },
        },
        _sum: { outstandingAmount: true },
      }),
      prisma.purchaseInvoice.groupBy({
        by: ["supplierId"],
        where: {
          restaurantId,
          status: { in: [...UNSETTLED_INVOICE_STATUSES] },
          dueDate: { lt: now },
        },
        _sum: { outstandingAmount: true },
      }),
    ]);

  const rows = new Map<string, SupplierMoneyRow>();
  const row = (supplierId: string): SupplierMoneyRow => {
    const existing = rows.get(supplierId);
    if (existing) return existing;
    const fresh: SupplierMoneyRow = {
      supplierId,
      openOrderCount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      totalPurchased: 0,
      lastOrderDate: null,
    };
    rows.set(supplierId, fresh);
    return fresh;
  };

  for (const o of openOrders) row(o.supplierId).openOrderCount = o._count._all;
  for (const o of lastOrders)
    row(o.supplierId).lastOrderDate = o._max.transactionDate;
  for (const p of purchased)
    row(p.supplierId).totalPurchased = Number(p._sum.grandTotal ?? 0);
  for (const o of outstanding)
    row(o.supplierId).outstandingAmount = Number(o._sum.outstandingAmount ?? 0);
  for (const o of overdue)
    row(o.supplierId).overdueAmount = Number(o._sum.outstandingAmount ?? 0);

  return [...rows.values()];
};
