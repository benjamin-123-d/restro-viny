"use server";

/**
 * What the kitchen and the room send from their phones, and what the manager
 * does with it. Every staff action checks the screen the person is allowed to
 * open — hiding a tab is not a permission, refusing the action is.
 */

import { withPermission, withStaffValidation } from "@/actions/helpers";
import { getStaffContextOrNull } from "@/lib/staff-auth";
import { canUseScreen, type StaffScreen } from "@/lib/staff-screens";
import { recordLossSchema, recordProductionSchema } from "@/lib/validators/food-cost";
import {
  breakageSchema,
  stockCheckRefSchema,
  stockCheckSchema,
} from "@/lib/validators/staff-declarations";
import { findStaffById } from "@/repositories/staff.repository";
import { recordLoss, recordProduction } from "@/services/food-cost.service";
import { applyStockCheck, dismissStockCheck, recordBreakage, submitStockCheck } from "@/services/staff-declarations.service";
import { failure, type ActionResult } from "@/types";

/** The signed-in staff member, if their role and their ticked screens allow it. */
const staffForScreen = async (screen: StaffScreen) => {
  const ctx = await getStaffContextOrNull();
  if (!ctx) return null;
  const staff = await findStaffById(ctx.staffId);
  if (!staff || !canUseScreen({ role: staff.role, screens: staff.screens }, screen)) return null;
  return ctx;
};

const guard = <TInput, TOutput>(
  screen: StaffScreen,
  run: (data: TInput, ctx: NonNullable<Awaited<ReturnType<typeof staffForScreen>>>) => Promise<TOutput>,
) =>
  async (data: TInput): Promise<ActionResult<TOutput> | TOutput> => {
    const ctx = await staffForScreen(screen);
    if (!ctx) return failure<TOutput>("STAFF_FORBIDDEN");
    return run(data, ctx);
  };

/** The kitchen sends what it saw on the shelves; nothing moves yet. */
export const submitStockCheckAction = withStaffValidation(
  stockCheckSchema,
  guard("STOCK", (data, ctx) => submitStockCheck(ctx, data)),
  { role: "KITCHEN" },
);

/** A loss declared from the staff app, valued like any other. */
export const declareStaffLossAction = withStaffValidation(
  recordLossSchema,
  guard("PERTES", (data, ctx) =>
    recordLoss({ restaurantId: ctx.restaurantId, userId: ctx.staffId }, data, { staffId: ctx.staffId }),
  ),
);

/** A glass or a plate broken in the room — kept out of the food cost. */
export const declareBreakageAction = withStaffValidation(
  breakageSchema,
  guard("CASSE", (data, ctx) => recordBreakage({ restaurantId: ctx.restaurantId, staffId: ctx.staffId }, data)),
);

/** The kitchen declares a batch of a base it produced. */
export const declareProductionAction = withStaffValidation(
  recordProductionSchema,
  guard("BASES", (data, ctx) => recordProduction({ restaurantId: ctx.restaurantId, userId: ctx.staffId }, data)),
  { role: "KITCHEN" },
);

// ------------------------------------------------------- manager's answer ---

export const applyStockCheckAction = withPermission("INVENTORY", "EDIT", stockCheckRefSchema, (data, ctx) =>
  applyStockCheck(ctx, data.id),
);

export const dismissStockCheckAction = withPermission("INVENTORY", "EDIT", stockCheckRefSchema, (data, ctx) =>
  dismissStockCheck(ctx, data.id),
);

/** The manager can record a breakage too, from the register. */
export const recordBreakageAction = withPermission("INVENTORY", "EDIT", breakageSchema, (data, ctx) =>
  recordBreakage({ restaurantId: ctx.restaurantId }, data),
);
