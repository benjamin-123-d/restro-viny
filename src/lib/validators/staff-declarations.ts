import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** What the kitchen saw on the shelves this morning. */
export const stockCheckSchema = z.object({
  note: text(200),
  lines: z
    .array(
      z.object({
        stockItemId: idSchema,
        countedQty: z.coerce.number().min(0, "Une quantité ne peut pas être négative.").max(10_000_000),
      }),
    )
    .min(1, "Signalez au moins un article.")
    .max(200),
});
export type StockCheckInput = z.infer<typeof stockCheckSchema>;

export const stockCheckRefSchema = z.object({ id: idSchema });

/** A glass, a plate, a piece of equipment broken in the room. */
export const breakageSchema = z.object({
  label: z.string().trim().min(1, "Dites ce qui a été cassé.").max(80),
  quantity: z.coerce.number({ error: "Indiquez combien." }).positive("Indiquez combien.").max(10_000),
  unitValue: z.coerce.number().min(0).max(100_000).optional(),
  reason: text(80),
  note: text(200),
});
export type BreakageInput = z.infer<typeof breakageSchema>;
