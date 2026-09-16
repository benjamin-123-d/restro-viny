import { z } from "zod";

import {
  BREAKDOWN_TOLERANCE,
  PURCHASE_CATEGORIES,
  breakdownGap,
  breakdownTotals,
  type PurchaseCategory,
} from "@/lib/purchase-categories";
import { idSchema } from "@/lib/validators/shared";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const money = (message: string) => z.coerce.number({ error: message }).min(0, message).max(1_000_000);

const euros = (n: number): string => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const purchaseCategorySchema = z.enum(PURCHASE_CATEGORIES as [PurchaseCategory, ...PurchaseCategory[]]);

export const expenseLineSchema = z.object({
  category: purchaseCategorySchema,
  label: text(120),
  amountHT: money("Indiquez le montant HT."),
  vatRate: z.coerce.number().min(0, "Taux de TVA invalide.").max(30, "Taux de TVA invalide."),
  vatAmount: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
});
export type ExpenseLineFormInput = z.infer<typeof expenseLineSchema>;

const ingredientLineSchema = z.object({
  stockItemId: idSchema,
  quantity: z.coerce.number({ error: "Indiquez la quantité." }).positive("Indiquez la quantité.").max(1_000_000),
  amount: z.coerce.number({ error: "Indiquez le montant HT." }).positive("Indiquez le montant HT.").max(1_000_000),
});

/** Payment modes offered for a purchase paid on the spot. */
export const directPaymentModeSchema = z.enum(["CARD", "CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"]);

/**
 * A purchase bought and paid on the spot. The ticket total must be fully
 * shared out between categories; the ingredient lines detail the food part
 * and cannot exceed it.
 */
export const directPurchaseSchema = z
  .object({
    supplierId: idSchema.optional(),
    supplierName: text(140),
    purchasedAt: z.coerce.date().optional(),
    ticketNumber: text(80),
    paymentMode: directPaymentModeSchema.default("CARD"),
    alreadyPaid: z.boolean().default(true),
    totalTTC: z.coerce
      .number({ error: "Indiquez le total payé TTC." })
      .positive("Indiquez le total payé TTC.")
      .max(1_000_000),
    expenseLines: z.array(expenseLineSchema).min(1, "Indiquez au moins une catégorie.").max(30),
    ingredientLines: z.array(ingredientLineSchema).max(80).default([]),
    notes: text(400),
    source: z.enum(["FILE", "PHOTO"]).optional(),
    /** What the owner decided line by line, so the next ticket classes itself. */
    learnLines: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(160),
          code: text(40),
          category: purchaseCategorySchema,
          stockItemId: idSchema.optional(),
        }),
      )
      .max(200)
      .optional(),
  })
  .refine((v) => Boolean(v.supplierId || v.supplierName), {
    message: "Indiquez le magasin ou le fournisseur.",
    path: ["supplierName"],
  })
  .superRefine((v, ctx) => {
    const gap = breakdownGap(v.expenseLines, v.totalTTC);
    if (Math.abs(gap) > BREAKDOWN_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        path: ["expenseLines"],
        message:
          gap > 0
            ? `Il manque ${euros(gap)} TTC dans la répartition pour arriver au total du ticket.`
            : `La répartition dépasse le total du ticket de ${euros(-gap)} TTC.`,
      });
    }
    const food = breakdownTotals(v.expenseLines).foodHT;
    const detailed = v.ingredientLines.reduce((sum, line) => sum + line.amount, 0);
    if (detailed > food + BREAKDOWN_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        path: ["ingredientLines"],
        message: `Les ingrédients détaillés (${euros(detailed)} HT) dépassent les denrées et boissons du ticket (${euros(food)} HT).`,
      });
    }
  });
export type DirectPurchaseInput = z.infer<typeof directPurchaseSchema>;

export const purchasingModeSchema = z.object({ mode: z.enum(["DIRECT", "FULL"]) });

/** Share out an existing supplier invoice after the fact. */
export const invoiceBreakdownSchema = z.object({
  purchaseInvoiceId: idSchema,
  expenseLines: z.array(expenseLineSchema).max(30),
});
export type InvoiceBreakdownInput = z.infer<typeof invoiceBreakdownSchema>;
