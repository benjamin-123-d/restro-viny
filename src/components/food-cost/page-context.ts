import { getManagerContextOrNull, type ManagerContext } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";

/** The signed-in manager, and whether they may change food cost data. */
export const getFoodCostPageContext = async (): Promise<{
  ctx: ManagerContext;
  canEdit: boolean;
} | null> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) return null;
  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  return { ctx, canEdit: Boolean(access && can(access, "INVENTORY", "EDIT")) };
};
