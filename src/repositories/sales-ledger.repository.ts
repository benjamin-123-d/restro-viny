import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ORDER_INCLUDE, type OrderWithRelations } from "@/repositories/order.repository";

export interface SaleTicketFilter {
  readonly restaurantId: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly service?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  readonly minTotal?: number;
  readonly maxTotal?: number;
  readonly discountedOnly?: boolean;
  /** Safety net on a restaurant with years of tickets. */
  readonly take?: number;
}

/** Settled tickets of a period, newest first, filtered where the database can. */
export const findSaleTickets = (filter: SaleTicketFilter): Promise<OrderWithRelations[]> => {
  const where: Prisma.OrderWhereInput = {
    restaurantId: filter.restaurantId,
    status: "COMPLETED",
    deletedAt: null,
    ...(filter.from || filter.to
      ? { settledAt: { ...(filter.from && { gte: filter.from }), ...(filter.to && { lt: filter.to }) } }
      : { settledAt: { not: null } }),
    ...(filter.service && { orderType: filter.service }),
    ...(filter.minTotal != null || filter.maxTotal != null
      ? { grandTotal: { ...(filter.minTotal != null && { gte: filter.minTotal }), ...(filter.maxTotal != null && { lte: filter.maxTotal }) } }
      : {}),
    ...(filter.discountedOnly && { discountTotal: { gt: 0 } }),
  };
  return prisma.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: { settledAt: "desc" },
    take: filter.take ?? 2000,
  });
};
