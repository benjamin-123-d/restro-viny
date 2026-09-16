import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

export const shiftKindSchema = z.enum(["TRAVAIL", "FORMATION", "REPOS", "CONGE", "MALADIE", "ABSENCE"]);

/** « YYYY-MM-DD ». The rota speaks in calendar days, not in instants. */
export const daySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)), "Date invalide.");

/** Minutes after midnight, so 18:30 travels as 1110. */
const minuteSchema = z.coerce.number().int().min(0, "Heure invalide.").max(1439, "Heure invalide.");

export const saveShiftSchema = z
  .object({
    id: idSchema.optional(),
    staffId: idSchema,
    day: daySchema,
    kind: shiftKindSchema,
    startMinute: minuteSchema.nullish(),
    endMinute: minuteSchema.nullish(),
    breakMinutes: z.coerce.number().int().min(0).max(480, "Pause trop longue.").default(0),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((shift, ctx) => {
    const worked = shift.kind === "TRAVAIL" || shift.kind === "FORMATION";
    if (worked && (shift.startMinute == null || shift.endMinute == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["startMinute"],
        message: "Indiquez l'heure de début et l'heure de fin.",
      });
    }
    // 18:30 → 01:00 is legitimate (the service runs past midnight); the same
    // hour twice is not — it would be a shift of exactly zero or of a full day.
    if (worked && shift.startMinute != null && shift.endMinute != null && shift.startMinute === shift.endMinute) {
      ctx.addIssue({
        code: "custom",
        path: ["endMinute"],
        message: "La fin ne peut pas être égale au début.",
      });
    }
  });
export type SaveShiftInput = z.infer<typeof saveShiftSchema>;

export const deleteShiftSchema = z.object({ id: idSchema });
export type DeleteShiftInput = z.infer<typeof deleteShiftSchema>;

/** Copy one week's rota onto another — the week that writes itself. */
export const copyWeekSchema = z.object({
  fromMonday: daySchema,
  toMonday: daySchema,
});
export type CopyWeekInput = z.infer<typeof copyWeekSchema>;

export const clearWeekSchema = z.object({ monday: daySchema });
export type ClearWeekInput = z.infer<typeof clearWeekSchema>;
