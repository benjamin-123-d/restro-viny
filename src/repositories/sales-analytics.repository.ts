import type { VatCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ORDER_INCLUDE,
  type OrderWithRelations,
} from "@/repositories/order.repository";

/** Settled POS orders — the tickets actually handed to customers — in a window. */
export const findSettledOrders = (
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<OrderWithRelations[]> =>
  prisma.order.findMany({
    where: {
      restaurantId,
      status: "COMPLETED",
      deletedAt: null,
      settledAt: { gte: from, lt: to },
    },
    include: ORDER_INCLUDE,
    orderBy: { settledAt: "asc" },
  });

/**
 * VAT category of every menu item, for lines sold before categories were
 * snapshotted on the line. The item's own category wins over its section's.
 */
export const findMenuVatCategories = async (
  restaurantId: string,
): Promise<Map<string, VatCategory>> => {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    select: {
      id: true,
      vatCategory: true,
      category: { select: { vatCategory: true } },
    },
  });
  return new Map(
    items.map((item) => [item.id, item.vatCategory ?? item.category.vatCategory]),
  );
};

export const findRestaurantSalesProfile = (restaurantId: string) =>
  prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      name: true,
      vatTerritory: true,
      serviceDineIn: true,
      serviceTakeaway: true,
      serviceDelivery: true,
    },
  });
