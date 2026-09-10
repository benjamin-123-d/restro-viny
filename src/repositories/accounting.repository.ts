import type {
  Account,
  AccountRootType,
  AccountSubType,
  JournalEntry,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";

// -------------------------------------------------------------- accounts ---

export interface AccountWriteData {
  code: string;
  name: string;
  rootType: AccountRootType;
  accountType: AccountSubType;
  parentId: string | null;
  isGroup: boolean;
  isFrozen: boolean;
  description: string | null;
}

const accountDetail = {
  parent: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AccountInclude;

export type AccountWithParent = Prisma.AccountGetPayload<{
  include: typeof accountDetail;
}>;

export const createAccount = (
  restaurantId: string,
  data: AccountWriteData,
): Promise<AccountWithParent> =>
  prisma.account.create({
    data: { restaurantId, ...data },
    include: accountDetail,
  });

export const updateAccount = (
  id: string,
  data: AccountWriteData,
): Promise<AccountWithParent> =>
  prisma.account.update({ where: { id }, data, include: accountDetail });

export const softDeleteAccount = (id: string): Promise<Account> =>
  prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });

export const findAccountById = (
  id: string,
): Promise<AccountWithParent | null> =>
  prisma.account.findUnique({ where: { id }, include: accountDetail });

export const findAccounts = (
  restaurantId: string,
): Promise<AccountWithParent[]> =>
  prisma.account.findMany({
    where: { restaurantId, deletedAt: null },
    include: accountDetail,
    orderBy: { code: "asc" },
  });

export const countAccounts = (restaurantId: string): Promise<number> =>
  prisma.account.count({ where: { restaurantId, deletedAt: null } });

export const countPostingsOnAccount = (accountId: string): Promise<number> =>
  prisma.gLEntry.count({ where: { accountId, isCancelled: false } });

/** Bulk-create the starter chart in one transaction, parents first. */
export const createChart = (
  restaurantId: string,
  rows: readonly (AccountWriteData & { parentCode: string | null })[],
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    const byCode = new Map<string, string>();
    for (const row of rows) {
      const { parentCode, ...data } = row;
      const created = await tx.account.create({
        data: {
          restaurantId,
          ...data,
          parentId: parentCode ? (byCode.get(parentCode) ?? null) : null,
        },
        select: { id: true, code: true },
      });
      byCode.set(created.code, created.id);
    }
  });

// -------------------------------------------------------------- journals ---

export interface JournalLineWriteData {
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  sortOrder: number;
}

export interface JournalWriteData {
  postingDate: Date;
  totalDebit: number;
  totalCredit: number;
  reference: string | null;
  narration: string | null;
}

const journalDetail = {
  lines: {
    orderBy: { sortOrder: "asc" },
    include: {
      account: { select: { id: true, code: true, name: true, rootType: true } },
    },
  },
} satisfies Prisma.JournalEntryInclude;

export type JournalWithLines = Prisma.JournalEntryGetPayload<{
  include: typeof journalDetail;
}>;

export const createJournal = (
  restaurantId: string,
  createdById: string,
  data: JournalWriteData,
  lines: readonly JournalLineWriteData[],
): Promise<JournalWithLines> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "JV", tx);
    return tx.journalEntry.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        lines: { create: lines.map((l) => ({ ...l })) },
      },
      include: journalDetail,
    });
  });

export const updateJournal = (
  id: string,
  data: JournalWriteData,
  lines: readonly JournalLineWriteData[],
): Promise<JournalWithLines> =>
  prisma.$transaction(async (tx) => {
    await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
    return tx.journalEntry.update({
      where: { id },
      data: { ...data, lines: { create: lines.map((l) => ({ ...l })) } },
      include: journalDetail,
    });
  });

export const findJournalById = (
  id: string,
): Promise<JournalWithLines | null> =>
  prisma.journalEntry.findUnique({ where: { id }, include: journalDetail });

export const findJournals = (
  restaurantId: string,
): Promise<JournalWithLines[]> =>
  prisma.journalEntry.findMany({
    where: { restaurantId },
    include: journalDetail,
    orderBy: [{ postingDate: "desc" }, { number: "desc" }],
  });

export const deleteDraftJournal = (id: string): Promise<void> =>
  prisma.journalEntry.delete({ where: { id } }).then(() => undefined);

/**
 * Post a journal: copy its lines into the general ledger and stamp it POSTED.
 * The ledger is append-only, so posting is the only way an entry gets there.
 */
export const postJournal = (journalId: string): Promise<JournalEntry> =>
  prisma.$transaction(async (tx) => {
    const journal = await tx.journalEntry.findUniqueOrThrow({
      where: { id: journalId },
      include: { lines: true },
    });

    await tx.gLEntry.createMany({
      data: journal.lines.map((line) => ({
        restaurantId: journal.restaurantId,
        accountId: line.accountId,
        journalEntryId: journal.id,
        postingDate: journal.postingDate,
        voucherType: journal.voucherType,
        voucherNumber: journal.number,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
    });

    return tx.journalEntry.update({
      where: { id: journalId },
      data: { status: "POSTED", postedAt: new Date() },
    });
  });

/**
 * Cancel a posted journal by writing the mirror image of every line, rather
 * than deleting history. The original stays readable and the ledger still ties.
 */
export const cancelJournal = (journalId: string): Promise<JournalEntry> =>
  prisma.$transaction(async (tx) => {
    const journal = await tx.journalEntry.findUniqueOrThrow({
      where: { id: journalId },
      include: { lines: true },
    });

    await tx.gLEntry.createMany({
      data: journal.lines.map((line) => ({
        restaurantId: journal.restaurantId,
        accountId: line.accountId,
        journalEntryId: journal.id,
        postingDate: new Date(),
        voucherType: journal.voucherType,
        voucherNumber: `${journal.number}-REV`,
        debit: line.credit,
        credit: line.debit,
        description: `Reversal of ${journal.number}`,
        isCancelled: true,
      })),
    });

    await tx.gLEntry.updateMany({
      where: { journalEntryId: journal.id, isCancelled: false },
      data: { isCancelled: true },
    });

    return tx.journalEntry.update({
      where: { id: journalId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });

// --------------------------------------------------------------- ledger ---

export interface LedgerTotalsRow {
  accountId: string;
  debit: number;
  credit: number;
}

/** Ledger totals per account over a window, grouped in the database. */
export const findLedgerTotals = async (
  restaurantId: string,
  window: { from?: Date; to?: Date } = {},
): Promise<LedgerTotalsRow[]> => {
  const rows = await prisma.gLEntry.groupBy({
    by: ["accountId"],
    where: {
      restaurantId,
      isCancelled: false,
      ...(window.from || window.to
        ? {
            postingDate: {
              ...(window.from ? { gte: window.from } : {}),
              ...(window.to ? { lte: window.to } : {}),
            },
          }
        : {}),
    },
    _sum: { debit: true, credit: true },
  });
  return rows.map((r) => ({
    accountId: r.accountId,
    debit: Number(r._sum.debit ?? 0),
    credit: Number(r._sum.credit ?? 0),
  }));
};

const glDetail = {
  account: { select: { id: true, code: true, name: true } },
} satisfies Prisma.GLEntryInclude;

export type GLEntryWithAccount = Prisma.GLEntryGetPayload<{
  include: typeof glDetail;
}>;

export const findGLEntries = (
  restaurantId: string,
  filter: { accountId?: string; from?: Date; to?: Date; take?: number } = {},
): Promise<GLEntryWithAccount[]> =>
  prisma.gLEntry.findMany({
    where: {
      restaurantId,
      isCancelled: false,
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.from || filter.to
        ? {
            postingDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    include: glDetail,
    orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
    take: filter.take ?? 200,
  });
