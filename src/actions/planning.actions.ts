"use server";

/**
 * Writing the rota. Every one of these is the manager's: the staff app only
 * ever reads its own week.
 */

import { withManagerValidation } from "@/actions/helpers";
import {
  clearWeekSchema,
  copyWeekSchema,
  deleteShiftSchema,
  saveShiftSchema,
} from "@/lib/validators/planning";
import { clearWeek, copyWeek, removeShift, saveShift } from "@/services/planning.service";

export const saveShiftAction = withManagerValidation(saveShiftSchema, (data, ctx) => saveShift(ctx, data));

export const deleteShiftAction = withManagerValidation(deleteShiftSchema, (data, ctx) => removeShift(ctx, data));

export const copyWeekAction = withManagerValidation(copyWeekSchema, (data, ctx) => copyWeek(ctx, data));

export const clearWeekAction = withManagerValidation(clearWeekSchema, (data, ctx) => clearWeek(ctx, data));
