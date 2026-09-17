import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/accounting-encoding.repository", () => ({
  addEvent: vi.fn(),
  countNumberedInMonth: vi.fn(),
  createPiece: vi.fn(),
  findAccountByCode: vi.fn(),
  findEvents: vi.fn(),
  findFiscalYearFor: vi.fn(),
  findPieceById: vi.fn(),
  findPieceQueue: vi.fn(),
  findPieces: vi.fn(),
  findRules: vi.fn(),
  findUnencodedPurchaseInvoices: vi.fn(),
  findUnencodedSalesInvoices: vi.fn(),
  numberEntry: vi.fn(),
  renameAccount: vi.fn(),
  saveDraftEntry: vi.fn(),
  setCustomerAccountingCode: vi.fn(),
  setSupplierAccountingCode: vi.fn(),
  updatePiece: vi.fn(),
  upsertRule: vi.fn(),
}));
vi.mock("@/repositories/accounting.repository", () => ({
  cancelJournal: vi.fn(),
  countAccounts: vi.fn(),
  createAccount: vi.fn(),
  createChart: vi.fn(),
  findAccounts: vi.fn(),
  postJournal: vi.fn(),
}));

import type { AccountingRule } from "@/generated/prisma/client";

import {
  addEvent,
  countNumberedInMonth,
  createPiece,
  findAccountByCode,
  findEvents,
  findFiscalYearFor,
  findPieceById,
  findPieceQueue,
  findRules,
  findUnencodedPurchaseInvoices,
  findUnencodedSalesInvoices,
  numberEntry,
  saveDraftEntry,
  updatePiece,
  upsertRule,
} from "@/repositories/accounting-encoding.repository";
import { cancelJournal, countAccounts, createAccount, postJournal } from "@/repositories/accounting.repository";

import {
  openPiece,
  PIECE_FORBIDDEN,
  PIECE_LOCKED,
  postPiece,
  reversePiece,
  savePiece,
  syncInbox,
  upsertAccountByCode,
} from "./accounting-encoding.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** La facture Auchan : 66,99 TTC, 55,82 HT, 11,17 de TVA. */
const makePiece = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    restaurantId: "res_1",
    kind: "ACHAT",
    status: "A_TRAITER",
    documentId: "doc_1",
    salesInvoiceId: null,
    purchaseInvoiceId: "inv_1",
    supplierId: "sup_1",
    customerId: null,
    thirdPartyName: "Auchan",
    auxiliaryCode: "FAUCH01",
    invoiceNumber: "21951",
    invoiceDate: day("2025-12-04"),
    dueDate: day("2025-12-04"),
    entryDate: day("2025-12-04"),
    amountTTC: 66.99,
    amountHT: 55.82,
    vatRate: 20,
    amountVAT: 11.17,
    label: "Auchan - 12/25",
    isCca: false,
    isPaid: true,
    paymentMode: "CARD",
    paidOn: day("2025-12-04"),
    readFields: ["amountTTC"],
    journalEntryId: null,
    journalEntry: null,
    document: { id: "doc_1", fileName: "auchan.pdf", mimeType: "application/pdf", sizeBytes: 100 },
    events: [],
    ...over,
  }) as unknown as NonNullable<Awaited<ReturnType<typeof findPieceById>>>;

const entryWithLines = () => ({
  id: "je_1",
  number: "BROUILLON-xxxx",
  status: "DRAFT",
  lines: [
    { debit: 0, credit: 66.99, description: null, auxiliaryCode: "FAUCH01", auxiliaryName: "Auchan", account: { id: "a1", code: "401000", name: "Fournisseurs" } },
    { debit: 11.17, credit: 0, description: null, auxiliaryCode: null, auxiliaryName: null, account: { id: "a2", code: "445661", name: "TVA déductible" } },
    { debit: 55.82, credit: 0, description: null, auxiliaryCode: null, auxiliaryName: null, account: { id: "a3", code: "601000", name: "Achats" } },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(countAccounts).mockResolvedValue(30);
  vi.mocked(findRules).mockResolvedValue([]);
  vi.mocked(findPieceQueue).mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
  vi.mocked(findEvents).mockResolvedValue([]);
  vi.mocked(findFiscalYearFor).mockResolvedValue(null);
  vi.mocked(findUnencodedPurchaseInvoices).mockResolvedValue([]);
  vi.mocked(findUnencodedSalesInvoices).mockResolvedValue([]);
});

describe("la bannette", () => {
  it("reprend une facture fournisseur avec ses montants et son justificatif", async () => {
    vi.mocked(findUnencodedPurchaseInvoices).mockResolvedValue([
      {
        id: "inv_1",
        number: "PI-1",
        supplierInvoiceNo: "21951",
        postingDate: day("2025-12-04"),
        dueDate: day("2026-01-03"),
        subtotal: 55.82,
        taxTotal: 11.17,
        grandTotal: 66.99,
        outstandingAmount: 0,
        paymentMode: "CARD",
        supplier: { id: "sup_1", name: "Auchan", accountingCode: null },
        documents: [{ id: "doc_1" }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as unknown as Awaited<ReturnType<typeof findUnencodedPurchaseInvoices>>[number],
    ]);

    const { added } = await syncInbox(ctx);

    expect(added).toBe(1);
    expect(vi.mocked(createPiece).mock.calls[0][0]).toMatchObject({
      kind: "ACHAT",
      documentId: "doc_1",
      thirdPartyName: "Auchan",
      auxiliaryCode: "FAUCH01",
      amountTTC: 66.99,
      amountHT: 55.82,
      amountVAT: 11.17,
      vatRate: 20,
      isPaid: true,
      label: "Auchan - 12/25",
    });
  });

  it("ne remonte que ce que personne n'a encore encodé", async () => {
    expect((await syncInbox(ctx)).added).toBe(0);
    expect(createPiece).not.toHaveBeenCalled();
  });
});

describe("ouvrir une pièce", () => {
  it("refuse la pièce d'un autre restaurant", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece({ restaurantId: "autre" }));
    await expect(openPiece(ctx, "p1")).rejects.toThrow(PIECE_FORBIDDEN);
  });

  it("propose les trois lignes quand rien n'est encore ventilé", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece());
    const opened = await openPiece(ctx, "p1");
    expect(opened.lines.map((l) => [l.accountCode, l.side, l.amount])).toEqual([
      ["401000", "C", 66.99],
      ["445661", "D", 11.17],
      ["601000", "D", 55.82],
    ]);
  });

  it("suit le compte retenu la dernière fois pour ce fournisseur", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece());
    vi.mocked(findRules).mockResolvedValue([
      { accountCode: "606300", auxiliaryCode: "FAUCH01" } as AccountingRule,
    ]);
    const opened = await openPiece(ctx, "p1");
    expect(opened.lines[2].accountCode).toBe("606300");
  });

  it("dit ce qui bloque et donne la place dans la file", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece({ documentId: null, document: null }));
    const opened = await openPiece(ctx, "p1");
    expect(opened.blocking.some((r) => r.includes("justificatif"))).toBe(true);
    expect(opened.queue).toMatchObject({ index: 1, total: 2, nextId: "p2", previousId: null });
  });

  it("verrouille une pièce comptabilisée et montre son numéro", async () => {
    vi.mocked(findPieceById).mockResolvedValue(
      makePiece({
        status: "COMPTABILISEE",
        journalEntryId: "je_1",
        journalEntry: { ...entryWithLines(), status: "POSTED", number: "202512000001" },
      }),
    );
    const opened = await openPiece(ctx, "p1");
    expect(opened.editable).toBe(false);
    expect(opened.pieceNumber).toBe("202512000001");
  });
});

describe("enregistrer", () => {
  const input = {
    id: "p1",
    thirdPartyName: "Auchan",
    invoiceDate: "2025-12-04",
    entryDate: "2025-12-04",
    amountTTC: 66.99,
    amountHT: 55.82,
    amountVAT: 11.17,
    isCca: false,
    isPaid: true,
    lines: [
      { accountCode: "401000", side: "C" as const, amount: 66.99 },
      { accountCode: "445661", side: "D" as const, amount: 11.17 },
      { accountCode: "601000", side: "D" as const, amount: 55.82 },
    ],
  };

  it("refuse de toucher à une pièce comptabilisée", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece({ status: "COMPTABILISEE" }));
    await expect(savePiece(ctx, input)).rejects.toThrow(PIECE_LOCKED);
  });

  it("écrit les lignes au bon côté et passe la pièce en enregistrée", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findAccountByCode).mockImplementation(async (_r, code) => ({ id: `a-${code}`, code, name: code }) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(saveDraftEntry).mockResolvedValue({ id: "je_1" } as any);

    await savePiece(ctx, input);

    const rows = vi.mocked(saveDraftEntry).mock.calls[0][3];
    expect(rows.map((r) => [r.debit, r.credit])).toEqual([
      [0, 66.99],
      [11.17, 0],
      [55.82, 0],
    ]);
    expect(vi.mocked(updatePiece).mock.calls[0][1]).toMatchObject({ status: "ENREGISTREE", journalEntryId: "je_1" });
    expect(addEvent).toHaveBeenCalled();
  });
});

describe("comptabiliser", () => {
  const posted = () =>
    makePiece({ status: "ENREGISTREE", journalEntryId: "je_1", journalEntry: entryWithLines() });

  it("refuse tant qu'une raison bloque", async () => {
    vi.mocked(findPieceById).mockResolvedValue(
      makePiece({ status: "ENREGISTREE", journalEntryId: "je_1", journalEntry: entryWithLines(), documentId: null, document: null }),
    );
    await expect(postPiece(ctx, "p1")).rejects.toThrow(/justificatif/);
    expect(postJournal).not.toHaveBeenCalled();
  });

  it("refuse dans un exercice clos", async () => {
    vi.mocked(findPieceById).mockResolvedValue(posted());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findFiscalYearFor).mockResolvedValue({ isClosed: true } as any);
    await expect(postPiece(ctx, "p1")).rejects.toThrow(/clos/);
  });

  it("numérote à la comptabilisation, en continuant la série du mois", async () => {
    vi.mocked(findPieceById).mockResolvedValue(posted());
    vi.mocked(countNumberedInMonth).mockResolvedValue(41);

    const result = await postPiece(ctx, "p1");

    expect(result.number).toBe("202512000042");
    expect(vi.mocked(countNumberedInMonth).mock.calls[0][1]).toBe("202512");
    expect(numberEntry).toHaveBeenCalledWith("je_1", "202512000042");
    expect(postJournal).toHaveBeenCalledWith("je_1");
    expect(vi.mocked(updatePiece).mock.calls[0][1]).toMatchObject({ status: "COMPTABILISEE" });
  });

  it("retient le compte de charge pour la prochaine facture du même fournisseur", async () => {
    vi.mocked(findPieceById).mockResolvedValue(posted());
    vi.mocked(countNumberedInMonth).mockResolvedValue(0);

    await postPiece(ctx, "p1");

    expect(upsertRule).toHaveBeenCalledWith("res_1", "ACHAT", "auchan", "601000", "FAUCH01");
  });

  it("ne comptabilise pas deux fois", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece({ status: "COMPTABILISEE", journalEntryId: "je_1" }));
    await expect(postPiece(ctx, "p1")).rejects.toThrow(PIECE_LOCKED);
  });
});

describe("contre-passer", () => {
  it("n'accepte qu'une pièce comptabilisée", async () => {
    vi.mocked(findPieceById).mockResolvedValue(makePiece({ status: "ENREGISTREE" }));
    await expect(reversePiece(ctx, "p1")).rejects.toThrow(/comptabilisée/);
  });

  it("écrit le miroir et rend la pièce modifiable", async () => {
    vi.mocked(findPieceById).mockResolvedValue(
      makePiece({ status: "COMPTABILISEE", journalEntryId: "je_1", journalEntry: entryWithLines() }),
    );
    await reversePiece(ctx, "p1");
    expect(cancelJournal).toHaveBeenCalledWith("je_1");
    expect(vi.mocked(updatePiece).mock.calls[0][1]).toMatchObject({ status: "ENREGISTREE", postedAt: null });
  });
});

describe("le plan comptable, modifié en cours de saisie", () => {
  it("crée un compte inconnu en lisant sa nature dans son numéro", async () => {
    vi.mocked(findAccountByCode).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createAccount).mockImplementation(async (_r, data) => ({ id: "new", ...data }) as any);

    await upsertAccountByCode(ctx, "606300", "Petit équipement");

    expect(vi.mocked(createAccount).mock.calls[0][1]).toMatchObject({
      code: "606300",
      name: "Petit équipement",
      rootType: "EXPENSE",
      accountType: "EXPENSE_ACCOUNT",
    });
  });

  it("refuse un numéro qui n'en est pas un", async () => {
    await expect(upsertAccountByCode(ctx, "60A", "Bidon")).rejects.toThrow();
  });
});
