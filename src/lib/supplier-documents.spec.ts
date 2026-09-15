import { describe, expect, it } from "vitest";

import {
  buildQuoteRequest,
  checkDocumentFile,
  DOCUMENT_EMPTY,
  DOCUMENT_TOO_LARGE,
  DOCUMENT_TYPE_INVALID,
  mailtoLink,
  splitDocumentTotal,
  TOTAL_VAT_ABOVE_TOTAL,
} from "./supplier-documents";

describe("splitDocumentTotal", () => {
  it("takes the VAT as printed on the invoice", () => {
    expect(splitDocumentTotal({ totalTTC: 120, vatAmount: 20 })).toEqual({ ht: 100, vat: 20, ttc: 120 });
  });

  it("works the VAT out of the total from a rate when only the rate is known", () => {
    expect(splitDocumentTotal({ totalTTC: 105.5, vatRate: 5.5 })).toEqual({ ht: 100, vat: 5.5, ttc: 105.5 });
  });

  it("keeps the cents exact: HT plus VAT is always the total", () => {
    const { ht, vat, ttc } = splitDocumentTotal({ totalTTC: 87.63, vatRate: 20 });
    expect(Math.round((ht + vat) * 100) / 100).toBe(ttc);
  });

  it("treats a total with no VAT given as VAT-free", () => {
    expect(splitDocumentTotal({ totalTTC: 50 })).toEqual({ ht: 50, vat: 0, ttc: 50 });
  });

  it("refuses VAT larger than the total", () => {
    expect(() => splitDocumentTotal({ totalTTC: 10, vatAmount: 12 })).toThrow(TOTAL_VAT_ABOVE_TOTAL);
  });
});

describe("checkDocumentFile", () => {
  it("accepts a PDF from an email and a phone photo", () => {
    expect(checkDocumentFile({ type: "application/pdf", size: 200_000 })).toBeNull();
    expect(checkDocumentFile({ type: "image/jpeg", size: 3_000_000 })).toBeNull();
    expect(checkDocumentFile({ type: "image/heic", size: 2_000_000 })).toBeNull();
  });

  it("refuses other kinds of file", () => {
    expect(checkDocumentFile({ type: "application/zip", size: 1000 })).toBe(DOCUMENT_TYPE_INVALID);
  });

  it("refuses an empty or oversized file", () => {
    expect(checkDocumentFile({ type: "application/pdf", size: 0 })).toBe(DOCUMENT_EMPTY);
    expect(checkDocumentFile({ type: "application/pdf", size: 16 * 1024 * 1024 })).toBe(DOCUMENT_TOO_LARGE);
  });
});

describe("buildQuoteRequest", () => {
  const input = {
    restaurantName: "Le Bistrot du Port",
    senderName: "Marie Dupont",
    senderPhone: "04 78 00 00 00",
    supplierName: "Primeurs Lyonnais",
    contactPerson: "M. Martin",
    lines: [
      { name: "Tomates", quantity: 12, unit: "kg" },
      { name: "Huile d'olive", quantity: 6, unit: "L" },
    ],
    message: "Livraison le mardi matin si possible.",
    neededBy: new Date("2026-09-22T10:00:00Z"),
  };

  it("addresses the contact and lists what is wanted with quantities", () => {
    const { subject, body } = buildQuoteRequest(input);
    expect(subject).toBe("Demande de devis — Le Bistrot du Port");
    expect(body).toContain("Bonjour M. Martin,");
    expect(body).toContain("- Tomates : 12 kg");
    expect(body).toContain("- Huile d'olive : 6 L");
    expect(body).toContain("22/09/2026");
    expect(body).toContain("Livraison le mardi matin si possible.");
    expect(body).toContain("Marie Dupont");
  });

  it("stays polite without a contact name or a date", () => {
    const { body } = buildQuoteRequest({ ...input, contactPerson: null, neededBy: null, lines: [] });
    expect(body).toContain("Bonjour,");
    expect(body).not.toContain("avant le");
  });
});

describe("mailtoLink", () => {
  it("encodes the subject and body for the user's mail app", () => {
    expect(mailtoLink({ to: "a@b.fr", subject: "Devis & prix", body: "Ligne 1\nLigne 2" })).toBe(
      "mailto:a@b.fr?subject=Devis%20%26%20prix&body=Ligne%201%0ALigne%202",
    );
  });
});
