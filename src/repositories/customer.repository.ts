import type {
  Customer,
  CustomerGroup,
  Prisma,
  Territory,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// -------------------------------------------------------- customer group ---

export interface CustomerGroupWriteData {
  name: string;
  defaultPaymentTermsDays: number | null;
  defaultDiscountPercent: number | null;
  notes: string | null;
}

export type CustomerGroupWithCount = CustomerGroup & {
  _count: { customers: number };
};

export const createCustomerGroup = (
  restaurantId: string,
  data: CustomerGroupWriteData,
): Promise<CustomerGroup> =>
  prisma.customerGroup.create({ data: { restaurantId, ...data } });

export const updateCustomerGroup = (
  id: string,
  data: CustomerGroupWriteData,
): Promise<CustomerGroup> =>
  prisma.customerGroup.update({ where: { id }, data });

export const softDeleteCustomerGroup = (id: string): Promise<CustomerGroup> =>
  prisma.customerGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

export const findCustomerGroupById = (
  id: string,
): Promise<CustomerGroup | null> =>
  prisma.customerGroup.findUnique({ where: { id } });

export const findCustomerGroupByName = (
  restaurantId: string,
  name: string,
): Promise<CustomerGroup | null> =>
  prisma.customerGroup.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findCustomerGroups = (
  restaurantId: string,
): Promise<CustomerGroupWithCount[]> =>
  prisma.customerGroup.findMany({
    where: { restaurantId, deletedAt: null },
    include: { _count: { select: { customers: true } } },
    orderBy: { name: "asc" },
  });

export const countCustomersInGroup = (groupId: string): Promise<number> =>
  prisma.customer.count({
    where: { customerGroupId: groupId, deletedAt: null },
  });

// ------------------------------------------------------------- territory ---

export type TerritoryWithCount = Territory & {
  _count: { customers: number };
};

export const createTerritory = (
  restaurantId: string,
  data: { name: string; notes: string | null },
): Promise<Territory> =>
  prisma.territory.create({ data: { restaurantId, ...data } });

export const updateTerritory = (
  id: string,
  data: { name: string; notes: string | null },
): Promise<Territory> => prisma.territory.update({ where: { id }, data });

export const softDeleteTerritory = (id: string): Promise<Territory> =>
  prisma.territory.update({ where: { id }, data: { deletedAt: new Date() } });

export const findTerritoryById = (id: string): Promise<Territory | null> =>
  prisma.territory.findUnique({ where: { id } });

export const findTerritoryByName = (
  restaurantId: string,
  name: string,
): Promise<Territory | null> =>
  prisma.territory.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findTerritories = (
  restaurantId: string,
): Promise<TerritoryWithCount[]> =>
  prisma.territory.findMany({
    where: { restaurantId, deletedAt: null },
    include: { _count: { select: { customers: true } } },
    orderBy: { name: "asc" },
  });

export const countCustomersInTerritory = (
  territoryId: string,
): Promise<number> =>
  prisma.customer.count({ where: { territoryId, deletedAt: null } });

// -------------------------------------------------------------- customer ---

export interface CustomerWriteData {
  name: string;
  customerGroupId: string | null;
  territoryId: string | null;
  taxId: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  currency: string | null;
  paymentTermsDays: number | null;
  creditLimit: number | null;
  blockOnCreditLimit: boolean;
  disabled: boolean;
  notes: string | null;
}

const withRefs = {
  customerGroup: { select: { id: true, name: true } },
  territory: { select: { id: true, name: true } },
} satisfies Prisma.CustomerInclude;

export type CustomerWithRefs = Prisma.CustomerGetPayload<{
  include: typeof withRefs;
}>;

export const createCustomer = (
  restaurantId: string,
  code: string,
  data: CustomerWriteData,
): Promise<CustomerWithRefs> =>
  prisma.customer.create({
    data: { restaurantId, code, ...data },
    include: withRefs,
  });

export const updateCustomer = (
  id: string,
  data: CustomerWriteData,
): Promise<CustomerWithRefs> =>
  prisma.customer.update({ where: { id }, data, include: withRefs });

export const reviveCustomer = (
  id: string,
  data: CustomerWriteData,
): Promise<CustomerWithRefs> =>
  prisma.customer.update({
    where: { id },
    data: { ...data, deletedAt: null },
    include: withRefs,
  });

export const softDeleteCustomer = (id: string): Promise<Customer> =>
  prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), disabled: true },
  });

export const findCustomerById = (
  id: string,
): Promise<CustomerWithRefs | null> =>
  prisma.customer.findUnique({ where: { id }, include: withRefs });

export const findCustomerByName = (
  restaurantId: string,
  name: string,
): Promise<Customer | null> =>
  prisma.customer.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findCustomers = (
  restaurantId: string,
  opts: { includeDisabled?: boolean; search?: string } = {},
): Promise<CustomerWithRefs[]> =>
  prisma.customer.findMany({
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
    include: withRefs,
    orderBy: { name: "asc" },
  });

export const maxCustomerCode = async (
  restaurantId: string,
): Promise<number> => {
  const rows = await prisma.customer.findMany({
    where: { restaurantId },
    select: { code: true },
  });
  return rows.reduce((max, row) => {
    const n = Number(row.code.replace(/\D/g, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
};

// ------------------------------------------------------------- reporting ---

export interface CustomerMoneyRow {
  customerId: string;
  openOrderCount: number;
  outstandingAmount: number;
  overdueAmount: number;
  totalSold: number;
  lastOrderDate: Date | null;
}

const OPEN_ORDER_STATUSES = [
  "TO_DELIVER_AND_BILL",
  "TO_DELIVER",
  "TO_BILL",
  "ON_HOLD",
] as const;

const UNSETTLED = ["UNPAID", "PARTLY_PAID", "OVERDUE"] as const;

/** Every customer's receivables view, grouped in the database in one pass. */
export const findCustomerMoneyRows = async (
  restaurantId: string,
  now: Date,
): Promise<CustomerMoneyRow[]> => {
  const [openOrders, lastOrders, sold, outstanding, overdue] =
    await Promise.all([
      prisma.salesOrder.groupBy({
        by: ["customerId"],
        where: { restaurantId, status: { in: [...OPEN_ORDER_STATUSES] } },
        _count: { _all: true },
      }),
      prisma.salesOrder.groupBy({
        by: ["customerId"],
        where: { restaurantId, status: { not: "CANCELLED" } },
        _max: { transactionDate: true },
      }),
      prisma.salesInvoice.groupBy({
        by: ["customerId"],
        where: {
          restaurantId,
          status: { notIn: ["DRAFT", "CANCELLED"] },
          isReturn: false,
        },
        _sum: { grandTotal: true },
      }),
      prisma.salesInvoice.groupBy({
        by: ["customerId"],
        where: { restaurantId, status: { in: [...UNSETTLED] } },
        _sum: { outstandingAmount: true },
      }),
      prisma.salesInvoice.groupBy({
        by: ["customerId"],
        where: {
          restaurantId,
          status: { in: [...UNSETTLED] },
          dueDate: { lt: now },
        },
        _sum: { outstandingAmount: true },
      }),
    ]);

  const rows = new Map<string, CustomerMoneyRow>();
  const row = (customerId: string): CustomerMoneyRow => {
    const existing = rows.get(customerId);
    if (existing) return existing;
    const fresh: CustomerMoneyRow = {
      customerId,
      openOrderCount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      totalSold: 0,
      lastOrderDate: null,
    };
    rows.set(customerId, fresh);
    return fresh;
  };

  for (const o of openOrders) row(o.customerId).openOrderCount = o._count._all;
  for (const o of lastOrders)
    row(o.customerId).lastOrderDate = o._max.transactionDate;
  for (const s of sold)
    row(s.customerId).totalSold = Number(s._sum.grandTotal ?? 0);
  for (const o of outstanding)
    row(o.customerId).outstandingAmount = Number(o._sum.outstandingAmount ?? 0);
  for (const o of overdue)
    row(o.customerId).overdueAmount = Number(o._sum.outstandingAmount ?? 0);

  return [...rows.values()];
};
