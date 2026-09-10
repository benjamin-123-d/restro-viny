import {
  assertPostable,
  balanceOf,
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  DEFAULT_CHART,
  totalJournal,
  type AccountRootType,
  type BalanceSheet,
  type ProfitAndLoss,
  type TrialBalance,
  type TrialBalanceRow,
} from "@/lib/accounting";
import type {
  CreateAccountInput,
  CreateJournalInput,
  ReportWindowInput,
  UpdateAccountInput,
  UpdateJournalInput,
} from "@/lib/validators/accounting";
import {
  cancelJournal as cancelJournalRepo,
  countAccounts,
  countPostingsOnAccount,
  createAccount as createAccountRepo,
  createChart,
  createJournal as createJournalRepo,
  deleteDraftJournal,
  findAccountById,
  findAccounts,
  findGLEntries,
  findJournalById,
  findJournals,
  findLedgerTotals,
  postJournal as postJournalRepo,
  softDeleteAccount,
  updateAccount as updateAccountRepo,
  updateJournal as updateJournalRepo,
  type AccountWithParent,
  type JournalWithLines,
} from "@/repositories/accounting.repository";
import type { PurchasingContext } from "@/services/supplier.service";

export const ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND";
export const ACCOUNT_CODE_TAKEN = "ACCOUNT_CODE_TAKEN";
export const ACCOUNT_HAS_POSTINGS = "ACCOUNT_HAS_POSTINGS";
export const ACCOUNT_IS_GROUP = "ACCOUNT_IS_GROUP";
export const ACCOUNT_FROZEN = "ACCOUNT_FROZEN";
export const JOURNAL_NOT_FOUND = "JOURNAL_NOT_FOUND";
export const JOURNAL_NOT_DRAFT = "JOURNAL_NOT_DRAFT";
export const JOURNAL_NOT_POSTED = "JOURNAL_NOT_POSTED";
export const CHART_SEED_FAILED = "CHART_SEED_FAILED";

export type AccountingContext = PurchasingContext;

const num = (v: unknown): number => Number(v);

export interface AccountDTO {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly rootType: AccountRootType;
  readonly accountType: string;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly isGroup: boolean;
  readonly isFrozen: boolean;
  readonly description: string | null;
  readonly balance: number;
  readonly debit: number;
  readonly credit: number;
}

export interface JournalLineDTO {
  readonly id: string;
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly description: string | null;
}

export interface JournalDTO {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly postingDate: string;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly reference: string | null;
  readonly narration: string | null;
  readonly lines: readonly JournalLineDTO[];
  readonly isEditable: boolean;
}

export interface LedgerEntryDTO {
  readonly id: string;
  readonly postingDate: string;
  readonly voucherNumber: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly description: string | null;
}

const mapAccount = (
  a: AccountWithParent,
  totals: { debit: number; credit: number },
): AccountDTO => ({
  id: a.id,
  code: a.code,
  name: a.name,
  rootType: a.rootType,
  accountType: a.accountType,
  parentId: a.parentId,
  parentName: a.parent?.name ?? null,
  isGroup: a.isGroup,
  isFrozen: a.isFrozen,
  description: a.description,
  debit: totals.debit,
  credit: totals.credit,
  balance: balanceOf(a.rootType, totals),
});

const mapJournal = (j: JournalWithLines): JournalDTO => ({
  id: j.id,
  number: j.number,
  status: j.status,
  postingDate: j.postingDate.toISOString(),
  totalDebit: num(j.totalDebit),
  totalCredit: num(j.totalCredit),
  reference: j.reference,
  narration: j.narration,
  isEditable: j.status === "DRAFT",
  lines: j.lines.map((l) => ({
    id: l.id,
    accountId: l.accountId,
    accountCode: l.account.code,
    accountName: l.account.name,
    debit: num(l.debit),
    credit: num(l.credit),
    description: l.description,
  })),
});

/**
 * Seed the starter chart the first time accounting is opened. Idempotent — an
 * existing chart is never touched.
 */
export const ensureChartOfAccounts = async (
  restaurantId: string,
): Promise<void> => {
  if ((await countAccounts(restaurantId)) > 0) return;
  try {
    await seedChart(restaurantId);
  } catch {
    // Several reports can render in parallel and all find an empty chart. The
    // unique code constraint means exactly one insert wins; the losers just
    // read what the winner created, so an error here is not a failure.
    if ((await countAccounts(restaurantId)) === 0)
      throw new Error(CHART_SEED_FAILED);
  }
};

const seedChart = async (restaurantId: string): Promise<void> => {
  await createChart(
    restaurantId,
    DEFAULT_CHART.map((a) => ({
      code: a.code,
      name: a.name,
      rootType: a.rootType,
      accountType: a.accountType,
      isGroup: a.isGroup,
      isFrozen: false,
      description: null,
      parentId: null,
      parentCode: a.parent ?? null,
    })),
  );
};

/** Ledger totals keyed by account, so mapping stays a single pass. */
const totalsMap = async (
  restaurantId: string,
  window: ReportWindowInput = {},
): Promise<Map<string, { debit: number; credit: number }>> =>
  new Map(
    (await findLedgerTotals(restaurantId, window)).map((r) => [
      r.accountId,
      { debit: r.debit, credit: r.credit },
    ]),
  );

export const listAccounts = async (
  ctx: AccountingContext,
): Promise<AccountDTO[]> => {
  await ensureChartOfAccounts(ctx.restaurantId);
  const [accounts, totals] = await Promise.all([
    findAccounts(ctx.restaurantId),
    totalsMap(ctx.restaurantId),
  ]);
  return accounts.map((a) =>
    mapAccount(a, totals.get(a.id) ?? { debit: 0, credit: 0 }),
  );
};

const loadOwnedAccount = async (
  restaurantId: string,
  id: string,
): Promise<AccountWithParent> => {
  const account = await findAccountById(id);
  if (!account || account.deletedAt || account.restaurantId !== restaurantId) {
    throw new Error(ACCOUNT_NOT_FOUND);
  }
  return account;
};

export const createAccount = async (
  ctx: AccountingContext,
  input: CreateAccountInput,
): Promise<AccountDTO> => {
  const existing = await findAccounts(ctx.restaurantId);
  if (existing.some((a) => a.code === input.code)) {
    throw new Error(ACCOUNT_CODE_TAKEN);
  }
  const created = await createAccountRepo(ctx.restaurantId, {
    code: input.code,
    name: input.name,
    rootType: input.rootType,
    accountType: input.accountType,
    parentId: input.parentId ?? null,
    isGroup: input.isGroup,
    isFrozen: input.isFrozen,
    description: input.description ?? null,
  });
  return mapAccount(created, { debit: 0, credit: 0 });
};

export const updateAccount = async (
  ctx: AccountingContext,
  input: UpdateAccountInput,
): Promise<AccountDTO> => {
  const account = await loadOwnedAccount(ctx.restaurantId, input.id);
  if (input.code !== account.code) {
    const existing = await findAccounts(ctx.restaurantId);
    if (existing.some((a) => a.id !== account.id && a.code === input.code)) {
      throw new Error(ACCOUNT_CODE_TAKEN);
    }
  }
  const updated = await updateAccountRepo(account.id, {
    code: input.code,
    name: input.name,
    rootType: input.rootType,
    accountType: input.accountType,
    parentId: input.parentId ?? null,
    isGroup: input.isGroup,
    isFrozen: input.isFrozen,
    description: input.description ?? null,
  });
  const totals = await totalsMap(ctx.restaurantId);
  return mapAccount(updated, totals.get(updated.id) ?? { debit: 0, credit: 0 });
};

/** An account with history stays — deleting it would orphan the ledger. */
export const deleteAccount = async (
  ctx: AccountingContext,
  input: { id: string },
): Promise<void> => {
  const account = await loadOwnedAccount(ctx.restaurantId, input.id);
  if ((await countPostingsOnAccount(account.id)) > 0) {
    throw new Error(ACCOUNT_HAS_POSTINGS);
  }
  await softDeleteAccount(account.id);
};

// -------------------------------------------------------------- journals ---

/** Group accounts total their children; only leaves accept postings. */
const assertPostableAccounts = async (
  restaurantId: string,
  accountIds: readonly string[],
): Promise<void> => {
  const accounts = await findAccounts(restaurantId);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const id of accountIds) {
    const account = byId.get(id);
    if (!account) throw new Error(ACCOUNT_NOT_FOUND);
    if (account.isGroup) throw new Error(ACCOUNT_IS_GROUP);
    if (account.isFrozen) throw new Error(ACCOUNT_FROZEN);
  }
};

const journalWriteFrom = (input: CreateJournalInput) => {
  const lines = input.lines.map((l, index) => ({
    accountId: l.accountId,
    debit: l.debit,
    credit: l.credit,
    description: l.description ?? null,
    sortOrder: index,
  }));
  assertPostable(lines);
  const totals = totalJournal(lines);
  return {
    data: {
      postingDate: input.postingDate ?? new Date(),
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      reference: input.reference ?? null,
      narration: input.narration ?? null,
    },
    lines,
  };
};

export const createJournal = async (
  ctx: AccountingContext,
  input: CreateJournalInput,
): Promise<JournalDTO> => {
  await assertPostableAccounts(
    ctx.restaurantId,
    input.lines.map((l) => l.accountId),
  );
  const { data, lines } = journalWriteFrom(input);
  return mapJournal(
    await createJournalRepo(ctx.restaurantId, ctx.userId, data, lines),
  );
};

const loadOwnedJournal = async (
  restaurantId: string,
  id: string,
): Promise<JournalWithLines> => {
  const journal = await findJournalById(id);
  if (!journal || journal.restaurantId !== restaurantId) {
    throw new Error(JOURNAL_NOT_FOUND);
  }
  return journal;
};

export const updateJournal = async (
  ctx: AccountingContext,
  input: UpdateJournalInput,
): Promise<JournalDTO> => {
  const journal = await loadOwnedJournal(ctx.restaurantId, input.id);
  if (journal.status !== "DRAFT") throw new Error(JOURNAL_NOT_DRAFT);
  await assertPostableAccounts(
    ctx.restaurantId,
    input.lines.map((l) => l.accountId),
  );
  const { data, lines } = journalWriteFrom(input);
  return mapJournal(await updateJournalRepo(journal.id, data, lines));
};

export const postJournal = async (
  ctx: AccountingContext,
  input: { id: string },
): Promise<void> => {
  const journal = await loadOwnedJournal(ctx.restaurantId, input.id);
  if (journal.status !== "DRAFT") throw new Error(JOURNAL_NOT_DRAFT);
  assertPostable(
    journal.lines.map((l) => ({
      accountId: l.accountId,
      debit: num(l.debit),
      credit: num(l.credit),
    })),
  );
  await postJournalRepo(journal.id);
};

export const cancelJournal = async (
  ctx: AccountingContext,
  input: { id: string },
): Promise<void> => {
  const journal = await loadOwnedJournal(ctx.restaurantId, input.id);
  if (journal.status !== "POSTED") throw new Error(JOURNAL_NOT_POSTED);
  await cancelJournalRepo(journal.id);
};

export const deleteJournal = async (
  ctx: AccountingContext,
  input: { id: string },
): Promise<void> => {
  const journal = await loadOwnedJournal(ctx.restaurantId, input.id);
  if (journal.status !== "DRAFT") throw new Error(JOURNAL_NOT_DRAFT);
  await deleteDraftJournal(journal.id);
};

export const getJournal = async (
  ctx: AccountingContext,
  id: string,
): Promise<JournalDTO> =>
  mapJournal(await loadOwnedJournal(ctx.restaurantId, id));

export const listJournals = async (
  ctx: AccountingContext,
): Promise<JournalDTO[]> =>
  (await findJournals(ctx.restaurantId)).map(mapJournal);

// --------------------------------------------------------------- reports ---

/** The rows every report is built from: one per account, over one window. */
const reportRows = async (
  ctx: AccountingContext,
  window: ReportWindowInput,
): Promise<TrialBalanceRow[]> => {
  await ensureChartOfAccounts(ctx.restaurantId);
  const [accounts, totals] = await Promise.all([
    findAccounts(ctx.restaurantId),
    totalsMap(ctx.restaurantId, window),
  ]);
  return accounts
    .filter((a) => !a.isGroup)
    .map((a) => {
      const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        rootType: a.rootType,
        debit: t.debit,
        credit: t.credit,
        balance: balanceOf(a.rootType, t),
      };
    });
};

export const getTrialBalance = async (
  ctx: AccountingContext,
  window: ReportWindowInput = {},
): Promise<TrialBalance> => buildTrialBalance(await reportRows(ctx, window));

export const getProfitAndLoss = async (
  ctx: AccountingContext,
  window: ReportWindowInput = {},
): Promise<ProfitAndLoss> => buildProfitAndLoss(await reportRows(ctx, window));

export const getBalanceSheet = async (
  ctx: AccountingContext,
  window: ReportWindowInput = {},
): Promise<BalanceSheet> => buildBalanceSheet(await reportRows(ctx, window));

export const listLedger = async (
  ctx: AccountingContext,
  filter: { accountId?: string; from?: Date; to?: Date } = {},
): Promise<LedgerEntryDTO[]> =>
  (await findGLEntries(ctx.restaurantId, filter)).map((e) => ({
    id: e.id,
    postingDate: e.postingDate.toISOString(),
    voucherNumber: e.voucherNumber,
    accountCode: e.account.code,
    accountName: e.account.name,
    debit: num(e.debit),
    credit: num(e.credit),
    description: e.description,
  }));
