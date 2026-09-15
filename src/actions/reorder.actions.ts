"use server";

import { withPermission } from "@/actions/helpers";
import { itemSupplierSchema, reorderSchema } from "@/lib/validators/reorder";
import { createReorderOrders } from "@/services/reorder.service";
import { setItemDefaultSupplier } from "@/services/supplier.service";

export const createReorderOrdersAction = withPermission("PURCHASING", "EDIT", reorderSchema, (data, ctx) =>
  createReorderOrders(ctx, data),
);

export const setItemSupplierAction = withPermission("PURCHASING", "EDIT", itemSupplierSchema, (data, ctx) =>
  setItemDefaultSupplier(ctx, data),
);
