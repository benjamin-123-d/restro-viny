import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

const day = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const optionalDay = z
  .union([z.literal(""), day])
  .optional()
  .transform((value) => (value ? value : undefined));

const money = (message: string) =>
  z.coerce.number({ error: message }).min(0, message).max(100_000_000);

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const accountCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{3,8}$/, "Un numéro de compte fait de trois à huit chiffres.");

export const ventilationLineSchema = z.object({
  accountCode: accountCodeSchema,
  accountName: text(120),
  auxiliaryCode: text(20),
  auxiliaryName: text(140),
  label: text(160),
  side: z.enum(["D", "C"]),
  amount: money("Indiquez le montant de la ligne."),
});

/**
 * What the encoding screen sends back. Deliberately permissive on the balance:
 * a draft is saved as it stands, and the screen says what is missing. Refusing
 * to save an unbalanced draft would mean losing the accountant's typing every
 * time they are interrupted mid-entry.
 */
export const savePieceSchema = z.object({
  id: idSchema,
  thirdPartyName: z.string().trim().min(1, "Indiquez le tiers.").max(140),
  auxiliaryCode: text(20),
  invoiceNumber: text(80),
  invoiceDate: day,
  dueDate: optionalDay,
  entryDate: day,
  amountTTC: money("Indiquez le montant TTC."),
  amountHT: money("Indiquez le montant HT."),
  vatRate: z.coerce.number().min(0).max(100).nullish(),
  amountVAT: money("Indiquez le montant de TVA."),
  label: text(160),
  isCca: z.boolean().default(false),
  isPaid: z.boolean().default(false),
  paymentMode: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "UPI", "OTHER"]).nullish(),
  paidOn: optionalDay,
  lines: z.array(ventilationLineSchema).max(40),
});
export type SavePieceFormInput = z.infer<typeof savePieceSchema>;

export const pieceIdSchema = z.object({ id: idSchema });

export const upsertAccountSchema = z.object({
  code: accountCodeSchema,
  name: z.string().trim().max(120).default(""),
});

export const inboxFilterSchema = z.object({
  kind: z.enum(["ACHAT", "VENTE"]).optional(),
  status: z.enum(["A_TRAITER", "ENREGISTREE", "COMPTABILISEE"]).optional(),
  search: text(80),
});
