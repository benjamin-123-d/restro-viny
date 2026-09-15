import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

export const reorderSchema = z.object({
  lines: z
    .array(
      z.object({
        stockItemId: idSchema,
        quantity: z.coerce.number().positive("Quantité à commander manquante.").max(1_000_000),
      }),
    )
    .min(1, "Cochez au moins un article à commander."),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const itemSupplierSchema = z.object({
  stockItemId: idSchema,
  supplierId: idSchema.nullable(),
});
