import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/purchase-document.repository", () => ({
  createPurchaseDocument: vi.fn(),
  deletePurchaseDocument: vi.fn(),
  findPurchaseDocumentById: vi.fn(),
  findPurchaseDocumentMetaById: vi.fn(),
}));
vi.mock("@/repositories/rfq.repository", () => ({
  createQuotation: vi.fn(),
  findQuotationById: vi.fn(),
}));
vi.mock("@/repositories/purchase-invoice.repository", () => ({
  createPurchaseInvoice: vi.fn(),
  findPurchaseInvoiceById: vi.fn(),
}));
vi.mock("@/repositories/supplier-message.repository", () => ({
  createSupplierMessage: vi.fn(),
  findSupplierMessages: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
}));
vi.mock("@/services/supplier.service", () => ({
  loadOwnedSupplier: vi.fn(),
  assertSupplierAccepts: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
}));

import { isEmailConfigured, sendEmail } from "@/lib/email";
import { DOCUMENT_TYPE_INVALID } from "@/lib/supplier-documents";
import {
  createPurchaseDocument,
  findPurchaseDocumentById,
} from "@/repositories/purchase-document.repository";
import {
  createPurchaseInvoice,
  findPurchaseInvoiceById,
} from "@/repositories/purchase-invoice.repository";
import { createQuotation, findQuotationById } from "@/repositories/rfq.repository";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { createSupplierMessage } from "@/repositories/supplier-message.repository";
import { assertSupplierAccepts, loadOwnedSupplier } from "@/services/supplier.service";

import {
  attachPurchaseDocument,
  DOCUMENT_NOT_FOUND,
  DOCUMENT_PARENT_NOT_FOUND,
  getPurchaseDocumentFile,
  recordInvoiceFromDocument,
  recordQuotationFromDocument,
  sendQuoteRequests,
} from "./supplier-documents.service";

const ctx = { restaurantId: "r1", userId: "u1" };

const supplier = (o: Record<string, unknown> = {}) =>
  ({
    id: "s1",
    restaurantId: "r1",
    name: "Primeurs Lyonnais",
    email: "devis@primeurs.fr",
    contactPerson: "M. Martin",
    currency: null,
    paymentTermsDays: 30,
    ...o,
  }) as never;

const meta = {
  id: "d1",
  kind: "INVOICE",
  source: "PHOTO",
  fileName: "facture.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1200,
  createdAt: new Date("2026-09-15T08:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOwnedSupplier).mockResolvedValue(supplier());
});

describe("recordInvoiceFromDocument", () => {
  it("records just the totals, with the payment due after the supplier's terms", async () => {
    vi.mocked(createPurchaseInvoice).mockResolvedValue({ id: "pi1", number: "PINV-0001" } as never);

    const result = await recordInvoiceFromDocument(ctx, {
      supplierId: "s1",
      supplierInvoiceNo: "FA-2026-118",
      postingDate: new Date("2026-09-01T00:00:00Z"),
      totalTTC: 211,
      vatRate: 5.5,
      source: "PHOTO",
    });

    expect(result).toEqual({ id: "pi1", number: "PINV-0001" });
    expect(assertSupplierAccepts).toHaveBeenCalledWith(expect.anything(), "INVOICES");
    const [, , data, lines, schedule] = vi.mocked(createPurchaseInvoice).mock.calls[0];
    expect(data).toMatchObject({
      summaryOnly: true,
      supplierInvoiceNo: "FA-2026-118",
      subtotal: 200,
      taxTotal: 11,
      grandTotal: 211,
      outstandingAmount: 211,
      updateStock: false,
    });
    expect(data.dueDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(lines).toEqual([]);
    expect(schedule).toEqual([expect.objectContaining({ invoicePortion: 100, amount: 211 })]);
  });
});

describe("recordQuotationFromDocument", () => {
  it("records the quote's totals and the supplier's own reference", async () => {
    vi.mocked(createQuotation).mockResolvedValue({ id: "q1", number: "SQTN-0004" } as never);

    await recordQuotationFromDocument(ctx, {
      supplierId: "s1",
      supplierReference: "DEV-553",
      totalTTC: 120,
      vatAmount: 20,
      source: "EMAIL",
    });

    const [, , data, lines] = vi.mocked(createQuotation).mock.calls[0];
    expect(assertSupplierAccepts).toHaveBeenCalledWith(expect.anything(), "RFQ");
    expect(data).toMatchObject({ summaryOnly: true, supplierReference: "DEV-553", subtotal: 100, taxTotal: 20, grandTotal: 120 });
    expect(lines).toEqual([]);
  });
});

describe("attachPurchaseDocument", () => {
  const pdf = { buffer: Buffer.from("%PDF-1.4"), type: "application/pdf", size: 8, name: "devis.pdf" };

  it("stores a PDF against the restaurant's own quotation", async () => {
    vi.mocked(findQuotationById).mockResolvedValue({ id: "q1", restaurantId: "r1" } as never);
    vi.mocked(createPurchaseDocument).mockResolvedValue({ ...meta, kind: "QUOTATION", mimeType: "application/pdf", fileName: "devis.pdf" } as never);

    const doc = await attachPurchaseDocument(ctx, { kind: "QUOTATION", parentId: "q1", source: "EMAIL", file: pdf });

    expect(createPurchaseDocument).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "r1", quotationId: "q1", invoiceId: null, mimeType: "application/pdf", source: "EMAIL" }),
    );
    expect(doc.url).toBe("/api/purchasing/documents/d1");
    expect(doc.isImage).toBe(false);
  });

  it("will not attach to another restaurant's invoice", async () => {
    vi.mocked(findPurchaseInvoiceById).mockResolvedValue({ id: "pi9", restaurantId: "other" } as never);
    await expect(
      attachPurchaseDocument(ctx, { kind: "INVOICE", parentId: "pi9", source: "FILE", file: pdf }),
    ).rejects.toThrow(DOCUMENT_PARENT_NOT_FOUND);
    expect(createPurchaseDocument).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a document", async () => {
    await expect(
      attachPurchaseDocument(ctx, {
        kind: "INVOICE",
        parentId: "pi1",
        source: "FILE",
        file: { ...pdf, type: "application/zip", name: "x.zip" },
      }),
    ).rejects.toThrow(DOCUMENT_TYPE_INVALID);
  });
});

describe("getPurchaseDocumentFile", () => {
  it("serves only the restaurant's own documents", async () => {
    vi.mocked(findPurchaseDocumentById).mockResolvedValue({ ...meta, restaurantId: "other", content: new Uint8Array([1]) } as never);
    await expect(getPurchaseDocumentFile(ctx, "d1")).rejects.toThrow(DOCUMENT_NOT_FOUND);
  });
});

describe("sendQuoteRequests", () => {
  beforeEach(() => {
    vi.mocked(findRestaurantById).mockResolvedValue({ name: "Le Bistrot du Port", phone: "04 78 00 00 00", email: "contact@bistrot.fr" } as never);
  });

  const input = {
    supplierIds: ["s1", "s2"],
    lines: [{ name: "Tomates", quantity: 12, unit: "kg" }],
    message: undefined,
    neededBy: undefined,
    rfqId: undefined,
  };

  it("emails each supplier with an address and logs what left", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(loadOwnedSupplier)
      .mockResolvedValueOnce(supplier())
      .mockResolvedValueOnce(supplier({ id: "s2", name: "Boucherie Guillot", email: null }));
    vi.mocked(sendEmail).mockResolvedValue({ ok: true, id: "re_1" });

    const results = await sendQuoteRequests(ctx, input);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: "devis@primeurs.fr", replyTo: "contact@bistrot.fr" });
    expect(results.map((r) => r.status)).toEqual(["SENT", "NO_EMAIL"]);
    expect(createSupplierMessage).toHaveBeenCalledWith(expect.objectContaining({ supplierId: "s1", status: "SENT", providerId: "re_1" }));
  });

  it("hands over a ready-to-send link when no mail service is set up", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    const [result] = await sendQuoteRequests(ctx, { ...input, supplierIds: ["s1"] });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.status).toBe("MAILTO");
    expect(result.mailto).toMatch(/^mailto:devis@primeurs\.fr\?subject=/);
  });

  it("keeps the failure and still offers the link when sending fails", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "domain not verified" });
    const [result] = await sendQuoteRequests(ctx, { ...input, supplierIds: ["s1"] });
    expect(result).toMatchObject({ status: "FAILED", error: "domain not verified" });
    expect(result.mailto).not.toBeNull();
  });
});
