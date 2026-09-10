import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const money = z.coerce.number().nonnegative().max(100_000_000);

export const accountRootTypeSchema = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
]);

export const accountSubTypeSchema = z.enum([
  "BANK",
  "CASH",
  "RECEIVABLE",
  "PAYABLE",
  "STOCK",
  "FIXED_ASSET",
  "TAX",
  "COST_OF_GOODS_SOLD",
  "DEPRECIATION",
  "EQUITY",
  "INCOME_ACCOUNT",
  "EXPENSE_ACCOUNT",
  "ROUND_OFF",
  "OTHER",
]);

export const accountingIdSchema = z.object({ id: idSchema });
export type AccountingIdInput = z.infer<typeof accountingIdSchema>;

const accountFields = {
  code: z
    .string()
    .trim()
    .min(1, "Give the account a code")
    .max(20)
    .regex(/^[A-Za-z0-9.-]+$/, "Use letters, digits, dots or dashes"),
  name: z.string().trim().min(1, "Give the account a name").max(120),
  rootType: accountRootTypeSchema,
  accountType: accountSubTypeSchema.default("OTHER"),
  parentId: idSchema.optional(),
  isGroup: z.boolean().default(false),
  isFrozen: z.boolean().default(false),
  description: optionalText(300),
};

export const createAccountSchema = z.object(accountFields);
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  ...accountFields,
  id: idSchema,
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * A journal line sits on exactly one side. The schema enforces the shape; the
 * accounting rules in `lib/accounting.ts` enforce that the two columns agree.
 */
const journalLineSchema = z
  .object({
    accountId: idSchema,
    debit: money.default(0),
    credit: money.default(0),
    description: optionalText(200),
  })
  .refine((l) => !(l.debit > 0 && l.credit > 0), {
    message: "A line cannot be both a debit and a credit",
    path: ["credit"],
  })
  .refine((l) => l.debit > 0 || l.credit > 0, {
    message: "Enter an amount",
    path: ["debit"],
  });

export const createJournalSchema = z
  .object({
    postingDate: z.coerce.date().optional(),
    reference: optionalText(80),
    narration: optionalText(600),
    lines: z.array(journalLineSchema).min(2, "A journal needs at least two lines"),
  })
  .refine(
    (v) => {
      const debit = v.lines.reduce((s, l) => s + l.debit, 0);
      const credit = v.lines.reduce((s, l) => s + l.credit, 0);
      return Math.abs(debit - credit) < 0.005;
    },
    { message: "Debits and credits must be equal", path: ["lines"] },
  );
export type CreateJournalInput = z.infer<typeof createJournalSchema>;

export const updateJournalSchema = z.intersection(
  createJournalSchema,
  z.object({ id: idSchema }),
);
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;

export const reportWindowSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ReportWindowInput = z.infer<typeof reportWindowSchema>;
