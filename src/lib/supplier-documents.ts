/**
 * Pure helpers for what arrives from suppliers and what goes out to them:
 * checking an imported document, splitting a document's total into HT and
 * VAT, and writing a request for a quote.
 */

import { formatDate } from "@/lib/format";

export const DOCUMENT_TYPE_INVALID = "DOCUMENT_TYPE_INVALID";
export const DOCUMENT_TOO_LARGE = "DOCUMENT_TOO_LARGE";
export const DOCUMENT_EMPTY = "DOCUMENT_EMPTY";
export const TOTAL_VAT_ABOVE_TOTAL = "TOTAL_VAT_ABOVE_TOTAL";

export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

/** PDFs from emails, and the formats phone cameras produce. */
export const DOCUMENT_TYPES: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "image/jpeg": "Photo",
  "image/png": "Image",
  "image/webp": "Image",
  "image/heic": "Photo",
  "image/heif": "Photo",
};

/** The `accept` attribute for file inputs. */
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES).join(",");

export const checkDocumentFile = (file: { readonly type: string; readonly size: number }): string | null => {
  if (!(file.type in DOCUMENT_TYPES)) return DOCUMENT_TYPE_INVALID;
  if (file.size <= 0) return DOCUMENT_EMPTY;
  if (file.size > DOCUMENT_MAX_BYTES) return DOCUMENT_TOO_LARGE;
  return null;
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * HT / VAT / TTC from the few figures read off a document. The VAT amount as
 * printed wins; failing that it is worked out of the total from a rate; with
 * neither, the document is taken as VAT-free. HT is always the remainder, so
 * the three figures add up to the cent.
 */
export const splitDocumentTotal = (input: {
  readonly totalTTC: number;
  readonly vatAmount?: number | null;
  readonly vatRate?: number | null;
}): { ht: number; vat: number; ttc: number } => {
  const ttc = round2(input.totalTTC);
  const vat =
    input.vatAmount != null
      ? round2(input.vatAmount)
      : input.vatRate
        ? round2(ttc - ttc / (1 + input.vatRate / 100))
        : 0;
  if (vat > ttc) throw new Error(TOTAL_VAT_ABOVE_TOTAL);
  return { ht: round2(ttc - vat), vat, ttc };
};

export interface QuoteRequestInput {
  readonly restaurantName: string;
  readonly senderName: string | null;
  readonly senderPhone: string | null;
  readonly supplierName: string;
  readonly contactPerson: string | null;
  readonly lines: readonly { readonly name: string; readonly quantity: number; readonly unit: string }[];
  readonly message: string | null;
  readonly neededBy: Date | null;
}

const quantity = (n: number): string => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** A plain, courteous request for a quote, in French. */
export const buildQuoteRequest = (input: QuoteRequestInput): { subject: string; body: string } => {
  const lines = [
    input.contactPerson ? `Bonjour ${input.contactPerson},` : "Bonjour,",
    "",
    `Pourriez-vous nous faire parvenir votre meilleur devis pour les produits suivants${
      input.neededBy ? `, avant le ${formatDate(input.neededBy.toISOString())}` : ""
    } ?`,
    "",
    ...(input.lines.length > 0
      ? input.lines.map((l) => `- ${l.name} : ${quantity(l.quantity)} ${l.unit}`.trimEnd())
      : ["(voir le détail ci-dessous)"]),
    "",
    ...(input.message ? [input.message, ""] : []),
    "Merci d'indiquer les prix HT, les taux de TVA, les délais de livraison et la durée de validité de l'offre.",
    "",
    "Bien cordialement,",
    ...(input.senderName ? [input.senderName] : []),
    input.restaurantName,
    ...(input.senderPhone ? [`Tél. ${input.senderPhone}`] : []),
  ];
  return { subject: `Demande de devis — ${input.restaurantName}`, body: lines.join("\n") };
};

export const mailtoLink = (mail: { readonly to: string; readonly subject: string; readonly body: string }): string =>
  `mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
