"use server";

/**
 * Accounting: the chart of accounts and manual journals. Reports are read
 * straight from the server components, so only the mutations live here.
 */

import { withPermission } from "@/actions/helpers";
import {
  accountingIdSchema,
  createAccountSchema,
  createJournalSchema,
  updateAccountSchema,
  updateJournalSchema,
} from "@/lib/validators/accounting";
import {
  cancelJournal,
  createAccount,
  createJournal,
  deleteAccount,
  deleteJournal,
  postJournal,
  updateAccount,
  updateJournal,
} from "@/services/accounting.service";

export const createAccountAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  createAccountSchema,
  (data, ctx) => createAccount(ctx, data),
);

export const updateAccountAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  updateAccountSchema,
  (data, ctx) => updateAccount(ctx, data),
);

export const deleteAccountAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  accountingIdSchema,
  (data, ctx) => deleteAccount(ctx, data),
);

export const createJournalAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  createJournalSchema,
  (data, ctx) => createJournal(ctx, data),
);

export const updateJournalAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  updateJournalSchema,
  (data, ctx) => updateJournal(ctx, data),
);

/** Posting is what writes the ledger; a posted journal can only be reversed. */
export const postJournalAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  accountingIdSchema,
  (data, ctx) => postJournal(ctx, data),
);

export const cancelJournalAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  accountingIdSchema,
  (data, ctx) => cancelJournal(ctx, data),
);

export const deleteJournalAction = withPermission(
  "ACCOUNTING",
  "EDIT",
  accountingIdSchema,
  (data, ctx) => deleteJournal(ctx, data),
);
