/**
 * Data access for the accountant's desk: the pieces waiting to be encoded, the
 * rules learned about them, and the trail of what was done to each.
 *
 * What the existing accounting repository already does well is imported rather
 * than rewritten — posting an entry, mirroring it on cancellation, bulk-creating
 * a chart. Only what encoding needs on top of it lives here.
 */

import type {
  Account,
  AccountingPiece,
  AccountingPieceKind,
  AccountingPieceStatus,
  AccountingRule,
  JournalEntry,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------- plan comptable ---

export const findAccountByCode = (restaurantId: string, code: string): Promise<Account | null> =>
  prisma.account.findFirst({ where: { restaurantId, code, deletedAt: null } });

/** The accountant renames a label in place, without leaving the entry. */
export const renameAccount = (id: string, name: string): Promise<Account> =>
  prisma.account.update({ where: { id }, data: { name } });

// ------------------------------------------------------------------ pièces ---

const pieceInclude = {
  document: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
  journalEntry: {
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  },
} satisfies Prisma.AccountingPieceInclude;

export type PieceWithRelations = Prisma.AccountingPieceGetPayload<{ include: typeof pieceInclude }>;

export const findPieceById = (id: string): Promise<PieceWithRelations | null> =>
  prisma.accountingPiece.findUnique({ where: { id }, include: pieceInclude });

export interface PieceFilter {
  readonly kind?: AccountingPieceKind;
  readonly status?: AccountingPieceStatus;
  readonly search?: string;
}

const pieceWhere = (restaurantId: string, filter: PieceFilter): Prisma.AccountingPieceWhereInput => ({
  restaurantId,
  ...(filter.kind ? { kind: filter.kind } : {}),
  ...(filter.status ? { status: filter.status } : {}),
  ...(filter.search
    ? {
        OR: [
          { thirdPartyName: { contains: filter.search, mode: "insensitive" } },
          { invoiceNumber: { contains: filter.search, mode: "insensitive" } },
        ],
      }
    : {}),
});

/**
 * The bannette, oldest invoice first: what has waited longest is what should be
 * encoded first, and a late invoice is what gets a supplier on the phone.
 */
export const findPieces = (restaurantId: string, filter: PieceFilter = {}): Promise<PieceWithRelations[]> =>
  prisma.accountingPiece.findMany({
    where: pieceWhere(restaurantId, filter),
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    include: pieceInclude,
    take: 300,
  });

/** Just the ids, in the same order: what « ‹ › » walks through. */
export const findPieceQueue = (restaurantId: string, filter: PieceFilter = {}) =>
  prisma.accountingPiece.findMany({
    where: pieceWhere(restaurantId, filter),
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: { id: true },
    take: 300,
  });

export const createPiece = (data: Prisma.AccountingPieceUncheckedCreateInput): Promise<AccountingPiece> =>
  prisma.accountingPiece.create({ data });

export const updatePiece = (
  id: string,
  data: Prisma.AccountingPieceUncheckedUpdateInput,
): Promise<AccountingPiece> => prisma.accountingPiece.update({ where: { id }, data });

// ---------------------------------------------------- l'écriture en brouillon ---

export interface EncodingLineData {
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  auxiliaryCode: string | null;
  auxiliaryName: string | null;
  sortOrder: number;
}

/**
 * The draft entry and its lines, rewritten whole inside one transaction.
 *
 * Replacing every line rather than patching them is what keeps a ventilation
 * consistent: it is only ever correct as a set, so it is saved as a set.
 */
export const saveDraftEntry = async (
  restaurantId: string,
  entryId: string | null,
  header: {
    number: string;
    postingDate: Date;
    voucherType: Prisma.JournalEntryUncheckedCreateInput["voucherType"];
    reference: string | null;
    narration: string | null;
  },
  lines: readonly EncodingLineData[],
  createdById: string | null,
): Promise<JournalEntry> => {
  const rows = lines.map((line) => ({ ...line }));
  const totalDebit = rows.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = rows.reduce((sum, line) => sum + line.credit, 0);

  if (entryId) {
    const [, entry] = await prisma.$transaction([
      prisma.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } }),
      prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          postingDate: header.postingDate,
          reference: header.reference,
          narration: header.narration,
          totalDebit,
          totalCredit,
          lines: { create: rows },
        },
      }),
    ]);
    return entry;
  }

  return prisma.journalEntry.create({
    data: {
      restaurantId,
      number: header.number,
      postingDate: header.postingDate,
      voucherType: header.voucherType,
      reference: header.reference,
      narration: header.narration,
      totalDebit,
      totalCredit,
      createdById,
      lines: { create: rows },
    },
  });
};

/** Stamping the final number, the moment before the entry is posted. */
export const numberEntry = (entryId: string, number: string): Promise<JournalEntry> =>
  prisma.journalEntry.update({ where: { id: entryId }, data: { number } });

/**
 * How many entries this month already carry a number. Drafts hold none, so an
 * abandoned one leaves no hole — which is the whole reason the number is
 * handed out at posting rather than at opening.
 */
export const countNumberedInMonth = (restaurantId: string, prefix: string): Promise<number> =>
  prisma.journalEntry.count({
    where: { restaurantId, status: { not: "DRAFT" }, number: { startsWith: prefix } },
  });

export const findFiscalYearFor = (restaurantId: string, date: Date) =>
  prisma.fiscalYear.findFirst({
    where: { restaurantId, startDate: { lte: date }, endDate: { gte: date } },
  });

// ------------------------------------------------------------------ règles ---

export const findRules = (
  restaurantId: string,
  kind: AccountingPieceKind,
  keys: readonly string[],
): Promise<AccountingRule[]> =>
  keys.length === 0
    ? Promise.resolve([])
    : prisma.accountingRule.findMany({ where: { restaurantId, kind, key: { in: [...keys] } } });

export const upsertRule = (
  restaurantId: string,
  kind: AccountingPieceKind,
  key: string,
  accountCode: string,
  auxiliaryCode: string | null,
): Promise<AccountingRule> =>
  prisma.accountingRule.upsert({
    where: { restaurantId_kind_key: { restaurantId, kind, key } },
    create: { restaurantId, kind, key, accountCode, auxiliaryCode },
    update: {
      accountCode,
      ...(auxiliaryCode ? { auxiliaryCode } : {}),
      uses: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

// --------------------------------------------------------------- historique ---

export const addEvent = (
  pieceId: string,
  kind: string,
  detail: string | null,
  actorId: string | null,
  actorName: string | null,
) => prisma.accountingPieceEvent.create({ data: { pieceId, kind, detail, actorId, actorName } });

export const findEvents = (pieceId: string) =>
  prisma.accountingPieceEvent.findMany({ where: { pieceId }, orderBy: { createdAt: "desc" }, take: 100 });

// ------------------------------------------------- ce qui reste à encoder ---

/** Supplier invoices that carry a document and that no piece covers yet. */
export const findUnencodedPurchaseInvoices = (restaurantId: string) =>
  prisma.purchaseInvoice.findMany({
    where: {
      restaurantId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      documents: { some: {} },
      accountingPieces: { none: {} },
    },
    select: {
      id: true,
      number: true,
      supplierInvoiceNo: true,
      postingDate: true,
      dueDate: true,
      subtotal: true,
      taxTotal: true,
      grandTotal: true,
      outstandingAmount: true,
      paymentMode: true,
      supplier: { select: { id: true, name: true, accountingCode: true } },
      documents: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { postingDate: "asc" },
    take: 200,
  });

/** Customer invoices that no piece covers yet. */
export const findUnencodedSalesInvoices = (restaurantId: string) =>
  prisma.salesInvoice.findMany({
    where: {
      restaurantId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      accountingPieces: { none: {} },
    },
    select: {
      id: true,
      number: true,
      postingDate: true,
      dueDate: true,
      subtotal: true,
      taxTotal: true,
      grandTotal: true,
      outstandingAmount: true,
      customer: { select: { id: true, name: true, accountingCode: true } },
    },
    orderBy: { postingDate: "asc" },
    take: 200,
  });

export const setSupplierAccountingCode = (id: string, accountingCode: string) =>
  prisma.supplier.update({ where: { id }, data: { accountingCode } });

export const setCustomerAccountingCode = (id: string, accountingCode: string) =>
  prisma.customer.update({ where: { id }, data: { accountingCode } });
