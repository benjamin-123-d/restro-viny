/**
 * L'encodage — turning a document on the accountant's desk into an entry.
 *
 * The arithmetic and the refusals live in `lib/accounting-rules.ts`, which
 * knows nothing about the database; this file is the orchestration: fill the
 * bannette, open a piece with everything it needs, save, post, reverse.
 *
 * One rule shapes the whole file: a piece is only ever *proposed* to the
 * accountant. The reading fills fields, the learned rules pick accounts, but
 * nothing is posted until a person says so — prudence is not a setting.
 */

import type { AccountingPieceKind, AccountingPieceStatus, Prisma } from "@/generated/prisma/client";
import {
  ACCOUNT_BY_CATEGORY,
  auxiliaryCode as makeAuxiliaryCode,
  DEFAULT_ACCOUNTS,
  FRENCH_CHART,
  isAccountCode,
  rootTypeForCode,
  subTypeForCode,
} from "@/lib/chart-of-accounts";
import {
  blockingReasons,
  canEdit,
  defaultLabel,
  pieceNumber,
  proposeVentilation,
  reverseLines,
  type PieceHeader,
  type PieceStatus,
  type VentilationLine,
} from "@/lib/accounting-rules";
import { foldText } from "@/lib/search-text";
import { suggestCategory } from "@/lib/purchase-categories";
import {
  cancelJournal,
  countAccounts,
  createAccount,
  createChart,
  findAccounts,
  postJournal,
} from "@/repositories/accounting.repository";
import {
  addEvent,
  countNumberedInMonth,
  createPiece,
  findAccountByCode,
  findEvents,
  findFiscalYearFor,
  findPieceById,
  findPieceQueue,
  findPieces,
  findRules,
  findUnencodedPurchaseInvoices,
  findUnencodedSalesInvoices,
  numberEntry,
  renameAccount,
  saveDraftEntry,
  setCustomerAccountingCode,
  setSupplierAccountingCode,
  updatePiece,
  upsertRule,
  type EncodingLineData,
  type PieceFilter,
  type PieceWithRelations,
} from "@/repositories/accounting-encoding.repository";

export const PIECE_NOT_FOUND = "PIECE_NOT_FOUND";
export const PIECE_FORBIDDEN = "PIECE_FORBIDDEN";
export const PIECE_LOCKED = "PIECE_LOCKED";
export const ACCOUNT_CODE_INVALID = "ACCOUNT_CODE_INVALID";

export interface EncodingContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const money = (value: Prisma.Decimal | number | null | undefined): number => Number(value ?? 0);

const isoDay = (date: Date | null | undefined): string => (date ? date.toISOString().slice(0, 10) : "");

const dayOrNull = (day: string | null | undefined): Date | null =>
  day ? new Date(`${day}T00:00:00.000Z`) : null;

/** The key a learned rule is found by: the third party, folded. */
const ruleKey = (name: string): string => foldText(name).replace(/\s+/g, " ").trim().slice(0, 120);

// -------------------------------------------------------- le plan comptable ---

/**
 * A restaurant that has never done accounting starts with the French chart.
 * Seeded once, and freely rewritten afterwards — it is a starting point, not a
 * frame the accountant has to live in.
 */
export const ensureChart = async (ctx: EncodingContext): Promise<void> => {
  if ((await countAccounts(ctx.restaurantId)) > 0) return;
  await createChart(
    ctx.restaurantId,
    FRENCH_CHART.map((account) => ({
      code: account.code,
      name: account.name,
      rootType: account.rootType,
      accountType: account.accountType,
      parentId: null,
      parentCode: null,
      isGroup: false,
      isFrozen: false,
      description: null,
    })),
  );
};

export interface AccountOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export const listAccounts = async (ctx: EncodingContext): Promise<AccountOption[]> => {
  await ensureChart(ctx);
  return (await findAccounts(ctx.restaurantId)).map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));
};

/**
 * The accountant types a number that does not exist and the account is created
 * on the spot, its nature read from the number itself. Typing an existing one
 * with a new label renames it.
 */
export const upsertAccountByCode = async (
  ctx: EncodingContext,
  code: string,
  name: string,
): Promise<AccountOption> => {
  const trimmed = code.trim();
  if (!isAccountCode(trimmed)) throw new Error(ACCOUNT_CODE_INVALID);

  const existing = await findAccountByCode(ctx.restaurantId, trimmed);
  if (existing) {
    const renamed = name.trim() && name.trim() !== existing.name ? await renameAccount(existing.id, name.trim()) : existing;
    return { id: renamed.id, code: renamed.code, name: renamed.name };
  }

  // An account created without a label gets the one the French chart gives it,
  // rather than « Compte 445710 » — a ventilation nobody can read at a glance
  // is a ventilation nobody checks.
  const standard = FRENCH_CHART.find((account) => account.code === trimmed)?.name;
  const created = await createAccount(ctx.restaurantId, {
    code: trimmed,
    name: name.trim() || standard || `Compte ${trimmed}`,
    rootType: rootTypeForCode(trimmed),
    accountType: subTypeForCode(trimmed),
    parentId: null,
    isGroup: false,
    isFrozen: false,
    description: null,
  });
  return { id: created.id, code: created.code, name: created.name };
};

// ---------------------------------------------------------------- bannette ---

/**
 * Everything the application already captured but nobody has encoded lands in
 * the bannette. Run when the accountant opens their desk: what they see is the
 * restaurant's real backlog, not a list someone had to feed by hand.
 */
export const syncInbox = async (ctx: EncodingContext): Promise<{ added: number }> => {
  const [purchases, sales] = await Promise.all([
    findUnencodedPurchaseInvoices(ctx.restaurantId),
    findUnencodedSalesInvoices(ctx.restaurantId),
  ]);

  let added = 0;

  for (const invoice of purchases) {
    const name = invoice.supplier?.name ?? "Fournisseur";
    const ttc = money(invoice.grandTotal);
    const ht = money(invoice.subtotal);
    const vat = money(invoice.taxTotal);
    await createPiece({
      restaurantId: ctx.restaurantId,
      kind: "ACHAT",
      status: "A_TRAITER",
      documentId: invoice.documents[0]?.id ?? null,
      purchaseInvoiceId: invoice.id,
      supplierId: invoice.supplier?.id ?? null,
      thirdPartyName: name,
      auxiliaryCode: invoice.supplier?.accountingCode ?? makeAuxiliaryCode("F", name),
      invoiceNumber: invoice.supplierInvoiceNo ?? invoice.number,
      invoiceDate: invoice.postingDate,
      dueDate: invoice.dueDate,
      entryDate: invoice.postingDate,
      amountTTC: ttc,
      amountHT: ht,
      amountVAT: vat,
      vatRate: ht > 0 ? Math.round((vat / ht) * 1000) / 10 : null,
      label: defaultLabel(name, isoDay(invoice.postingDate)),
      isPaid: money(invoice.outstandingAmount) === 0,
      paymentMode: invoice.paymentMode,
      // Everything above came from the application rather than from a keyboard.
      readFields: ["thirdPartyName", "invoiceNumber", "invoiceDate", "dueDate", "amountTTC", "amountHT", "amountVAT"],
      createdById: ctx.userId,
    });
    added += 1;
  }

  for (const invoice of sales) {
    const name = invoice.customer?.name ?? "Client";
    await createPiece({
      restaurantId: ctx.restaurantId,
      kind: "VENTE",
      status: "A_TRAITER",
      salesInvoiceId: invoice.id,
      customerId: invoice.customer?.id ?? null,
      thirdPartyName: name,
      auxiliaryCode: invoice.customer?.accountingCode ?? makeAuxiliaryCode("C", name),
      invoiceNumber: invoice.number,
      invoiceDate: invoice.postingDate,
      dueDate: invoice.dueDate,
      entryDate: invoice.postingDate,
      amountTTC: money(invoice.grandTotal),
      amountHT: money(invoice.subtotal),
      amountVAT: money(invoice.taxTotal),
      vatRate: money(invoice.subtotal) > 0 ? Math.round((money(invoice.taxTotal) / money(invoice.subtotal)) * 1000) / 10 : null,
      label: defaultLabel(name, isoDay(invoice.postingDate)),
      isPaid: money(invoice.outstandingAmount) === 0,
      readFields: ["thirdPartyName", "invoiceNumber", "invoiceDate", "dueDate", "amountTTC", "amountHT", "amountVAT"],
      createdById: ctx.userId,
    });
    added += 1;
  }

  return { added };
};

export interface InboxRow {
  readonly id: string;
  readonly kind: AccountingPieceKind;
  readonly status: AccountingPieceStatus;
  readonly thirdPartyName: string;
  readonly invoiceNumber: string | null;
  readonly invoiceDate: string;
  readonly amountTTC: number;
  readonly hasDocument: boolean;
  readonly pieceNumber: string | null;
}

export const listInbox = async (ctx: EncodingContext, filter: PieceFilter = {}): Promise<InboxRow[]> => {
  const pieces = await findPieces(ctx.restaurantId, filter);
  return pieces.map((piece) => ({
    id: piece.id,
    kind: piece.kind,
    status: piece.status,
    thirdPartyName: piece.thirdPartyName ?? "—",
    invoiceNumber: piece.invoiceNumber,
    invoiceDate: isoDay(piece.invoiceDate),
    amountTTC: money(piece.amountTTC),
    hasDocument: piece.documentId != null || piece.salesInvoiceId != null,
    pieceNumber: piece.journalEntry?.status === "POSTED" ? piece.journalEntry.number : null,
  }));
};

// ------------------------------------------------------------ ouvrir une pièce ---

const headerOf = (piece: PieceWithRelations): PieceHeader => ({
  kind: piece.kind,
  thirdPartyName: piece.thirdPartyName ?? "",
  invoiceDate: isoDay(piece.invoiceDate),
  entryDate: isoDay(piece.entryDate ?? piece.invoiceDate),
  amountTTC: money(piece.amountTTC),
  amountHT: money(piece.amountHT),
  vatRate: piece.vatRate == null ? null : Number(piece.vatRate),
  amountVAT: money(piece.amountVAT),
  isCca: piece.isCca,
});

const linesOf = (piece: PieceWithRelations): VentilationLine[] =>
  (piece.journalEntry?.lines ?? []).map((line) => ({
    accountCode: line.account.code,
    auxiliaryCode: line.auxiliaryCode,
    auxiliaryName: line.auxiliaryName,
    label: line.description,
    side: Number(line.debit) > 0 ? ("D" as const) : ("C" as const),
    amount: Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit),
  }));

/**
 * Which charge account this third party should land on: what was decided last
 * time, failing that what the wording suggests. Permanence des méthodes is the
 * first branch, not the fallback.
 */
const suggestAccount = async (
  ctx: EncodingContext,
  kind: AccountingPieceKind,
  thirdPartyName: string,
): Promise<string> => {
  const key = ruleKey(thirdPartyName);
  const [rule] = await findRules(ctx.restaurantId, kind, [key]);
  if (rule) return rule.accountCode;
  if (kind === "VENTE") return DEFAULT_ACCOUNTS.income;
  return ACCOUNT_BY_CATEGORY[suggestCategory(thirdPartyName)] ?? DEFAULT_ACCOUNTS.expense;
};

export interface OpenedPiece {
  readonly id: string;
  readonly kind: AccountingPieceKind;
  readonly status: AccountingPieceStatus;
  readonly pieceNumber: string | null;
  readonly header: PieceHeader & {
    readonly auxiliaryCode: string | null;
    readonly invoiceNumber: string | null;
    readonly dueDate: string;
    readonly label: string;
  };
  readonly payment: { readonly isPaid: boolean; readonly mode: string | null; readonly paidOn: string };
  readonly lines: readonly VentilationLine[];
  readonly readFields: readonly string[];
  readonly document: { readonly id: string; readonly fileName: string; readonly mimeType: string } | null;
  readonly salesInvoiceId: string | null;
  readonly editable: boolean;
  readonly blocking: readonly string[];
  readonly queue: { readonly previousId: string | null; readonly nextId: string | null; readonly index: number; readonly total: number };
  readonly events: readonly { readonly id: string; readonly kind: string; readonly detail: string | null; readonly actorName: string | null; readonly at: string }[];
}

const ownedPiece = async (ctx: EncodingContext, id: string): Promise<PieceWithRelations> => {
  const piece = await findPieceById(id);
  if (!piece) throw new Error(PIECE_NOT_FOUND);
  if (piece.restaurantId !== ctx.restaurantId) throw new Error(PIECE_FORBIDDEN);
  return piece;
};

export const openPiece = async (ctx: EncodingContext, id: string): Promise<OpenedPiece> => {
  const piece = await ownedPiece(ctx, id);
  const header = headerOf(piece);

  // No ventilation yet: propose one rather than show an empty table.
  let lines = linesOf(piece);
  if (lines.length === 0 && header.amountTTC > 0) {
    const account = await suggestAccount(ctx, piece.kind, header.thirdPartyName);
    lines = proposeVentilation(header, {
      expenseAccount: account,
      incomeAccount: account,
      auxiliaryCode: piece.auxiliaryCode,
      auxiliaryName: piece.thirdPartyName,
      label: piece.label,
    });
  }

  const [queue, events, fiscalYear] = await Promise.all([
    findPieceQueue(ctx.restaurantId, { status: piece.status }),
    findEvents(piece.id),
    header.entryDate ? findFiscalYearFor(ctx.restaurantId, new Date(`${header.entryDate}T00:00:00.000Z`)) : Promise.resolve(null),
  ]);

  const index = queue.findIndex((row) => row.id === piece.id);
  const hasDocument = piece.documentId != null || piece.salesInvoiceId != null;

  return {
    id: piece.id,
    kind: piece.kind,
    status: piece.status,
    pieceNumber: piece.journalEntry?.status === "POSTED" ? piece.journalEntry.number : null,
    header: {
      ...header,
      auxiliaryCode: piece.auxiliaryCode,
      invoiceNumber: piece.invoiceNumber,
      dueDate: isoDay(piece.dueDate),
      label: piece.label ?? defaultLabel(header.thirdPartyName || "Divers", header.entryDate || header.invoiceDate),
    },
    payment: { isPaid: piece.isPaid, mode: piece.paymentMode, paidOn: isoDay(piece.paidOn) },
    lines,
    readFields: piece.readFields,
    document: piece.document
      ? { id: piece.document.id, fileName: piece.document.fileName, mimeType: piece.document.mimeType }
      : null,
    salesInvoiceId: piece.salesInvoiceId,
    editable: canEdit(piece.status as PieceStatus),
    blocking: blockingReasons({ header, lines, hasDocument, closedPeriod: fiscalYear?.isClosed === true }),
    queue: {
      previousId: index > 0 ? queue[index - 1].id : null,
      nextId: index >= 0 && index < queue.length - 1 ? queue[index + 1].id : null,
      index: index < 0 ? 0 : index + 1,
      total: queue.length,
    },
    events: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      detail: event.detail,
      actorName: event.actorName,
      at: event.createdAt.toISOString(),
    })),
  };
};

// ---------------------------------------------------------------- enregistrer ---

export interface SavePieceInput {
  readonly id: string;
  readonly thirdPartyName: string;
  readonly auxiliaryCode?: string;
  readonly invoiceNumber?: string;
  readonly invoiceDate: string;
  readonly dueDate?: string;
  readonly entryDate: string;
  readonly amountTTC: number;
  readonly amountHT: number;
  readonly vatRate?: number | null;
  readonly amountVAT: number;
  readonly label?: string;
  readonly isCca: boolean;
  readonly isPaid: boolean;
  readonly paymentMode?: string | null;
  readonly paidOn?: string | null;
  readonly lines: readonly {
    readonly accountCode: string;
    readonly accountName?: string;
    readonly auxiliaryCode?: string | null;
    readonly auxiliaryName?: string | null;
    readonly label?: string | null;
    readonly side: "D" | "C";
    readonly amount: number;
  }[];
}

/**
 * Save what the accountant has typed, ventilation included, without posting it.
 * An unbalanced draft is allowed — it is saved as it stands, and the screen says
 * what is missing. What is refused is *posting* it.
 */
export const savePiece = async (ctx: EncodingContext, input: SavePieceInput): Promise<{ id: string }> => {
  const piece = await ownedPiece(ctx, input.id);
  if (!canEdit(piece.status as PieceStatus)) throw new Error(PIECE_LOCKED);

  // Every account named has to exist before the lines can point at it.
  const accounts = new Map<string, string>();
  for (const line of input.lines) {
    if (accounts.has(line.accountCode)) continue;
    const account = await upsertAccountByCode(ctx, line.accountCode, line.accountName ?? "");
    accounts.set(line.accountCode, account.id);
  }

  const rows: EncodingLineData[] = input.lines.map((line, index) => ({
    accountId: accounts.get(line.accountCode) as string,
    debit: line.side === "D" ? line.amount : 0,
    credit: line.side === "C" ? line.amount : 0,
    description: line.label ?? input.label ?? null,
    auxiliaryCode: line.auxiliaryCode ?? null,
    auxiliaryName: line.auxiliaryName ?? null,
    sortOrder: index,
  }));

  const entryDate = dayOrNull(input.entryDate) ?? new Date();
  const entry = await saveDraftEntry(
    ctx.restaurantId,
    piece.journalEntryId,
    {
      // A draft carries a provisional number; the real one is stamped at posting.
      number: piece.journalEntry?.number ?? `BROUILLON-${piece.id.slice(-8)}`,
      postingDate: entryDate,
      voucherType: piece.kind === "ACHAT" ? "PURCHASE_INVOICE" : "SALES_INVOICE",
      reference: input.invoiceNumber ?? null,
      narration: input.label ?? null,
    },
    rows,
    ctx.userId,
  );

  await updatePiece(piece.id, {
    status: "ENREGISTREE",
    thirdPartyName: input.thirdPartyName.trim(),
    auxiliaryCode: input.auxiliaryCode?.trim() || null,
    invoiceNumber: input.invoiceNumber?.trim() || null,
    invoiceDate: dayOrNull(input.invoiceDate),
    dueDate: dayOrNull(input.dueDate ?? null),
    entryDate,
    amountTTC: input.amountTTC,
    amountHT: input.amountHT,
    amountVAT: input.amountVAT,
    vatRate: input.vatRate ?? null,
    label: input.label?.trim() || null,
    isCca: input.isCca,
    isPaid: input.isPaid,
    paymentMode: (input.paymentMode as Prisma.AccountingPieceUncheckedUpdateInput["paymentMode"]) ?? null,
    paidOn: dayOrNull(input.paidOn ?? null),
    journalEntryId: entry.id,
  });

  await addEvent(piece.id, "MODIFIEE", null, ctx.userId, null);
  return { id: piece.id };
};

// -------------------------------------------------------------- comptabiliser ---

/**
 * Post the piece. This is the irreversible step, so everything is checked one
 * last time here — the screen's own checks are a courtesy, not the guard.
 */
export const postPiece = async (ctx: EncodingContext, id: string): Promise<{ number: string }> => {
  const piece = await ownedPiece(ctx, id);
  if (!canEdit(piece.status as PieceStatus)) throw new Error(PIECE_LOCKED);
  if (!piece.journalEntryId || !piece.journalEntry) throw new Error("La pièce n'a pas encore été enregistrée.");

  const header = headerOf(piece);
  const lines = linesOf(piece);
  const fiscalYear = header.entryDate
    ? await findFiscalYearFor(ctx.restaurantId, new Date(`${header.entryDate}T00:00:00.000Z`))
    : null;

  const reasons = blockingReasons({
    header,
    lines,
    hasDocument: piece.documentId != null || piece.salesInvoiceId != null,
    closedPeriod: fiscalYear?.isClosed === true,
  });
  if (reasons.length > 0) throw new Error(reasons[0]);

  // The number is taken here and nowhere else, so the sequence has no holes.
  const prefix = `${header.entryDate.slice(0, 4)}${header.entryDate.slice(5, 7)}`;
  const rank = (await countNumberedInMonth(ctx.restaurantId, prefix)) + 1;
  const number = pieceNumber(header.entryDate, rank);

  await numberEntry(piece.journalEntryId, number);
  await postJournal(piece.journalEntryId);
  await updatePiece(piece.id, { status: "COMPTABILISEE", postedAt: new Date() });

  // Only now is the account worth learning: it is an answer a person stood behind.
  const charge = lines.find(
    (line) => !line.accountCode.startsWith("401") && !line.accountCode.startsWith("411") && !line.accountCode.startsWith("445"),
  );
  if (charge && header.thirdPartyName.trim()) {
    await upsertRule(ctx.restaurantId, piece.kind, ruleKey(header.thirdPartyName), charge.accountCode, piece.auxiliaryCode);
  }
  if (piece.auxiliaryCode && piece.supplierId) await setSupplierAccountingCode(piece.supplierId, piece.auxiliaryCode);
  if (piece.auxiliaryCode && piece.customerId) await setCustomerAccountingCode(piece.customerId, piece.auxiliaryCode);

  await addEvent(piece.id, "COMPTABILISEE", `N° ${number}`, ctx.userId, null);
  return { number };
};

/**
 * Reverse a posted piece. Nothing is deleted and nothing is edited: the mirror
 * image is written, and the two together leave the accounts as they were.
 */
export const reversePiece = async (ctx: EncodingContext, id: string): Promise<{ id: string }> => {
  const piece = await ownedPiece(ctx, id);
  if (piece.status !== "COMPTABILISEE" || !piece.journalEntryId) {
    throw new Error("Seule une pièce comptabilisée se contre-passe.");
  }
  await cancelJournal(piece.journalEntryId);
  await updatePiece(piece.id, { status: "ENREGISTREE", postedAt: null });
  await addEvent(
    piece.id,
    "CONTRE_PASSEE",
    `Écriture ${piece.journalEntry?.number ?? ""} annulée par son miroir`,
    ctx.userId,
    null,
  );
  return { id: piece.id };
};

/** What the reversal will write, so the screen can show it before it happens. */
export const previewReversal = (lines: readonly VentilationLine[]): VentilationLine[] => reverseLines(lines);
