import sharp from "sharp";

import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  buildQuoteRequest,
  checkDocumentFile,
  mailtoLink,
  splitDocumentTotal,
} from "@/lib/supplier-documents";
import type {
  QuickInvoiceInput,
  QuickQuotationInput,
  QuoteRequestInput,
} from "@/lib/validators/purchasing";
import {
  createPurchaseDocument,
  deletePurchaseDocument,
  findPurchaseDocumentById,
  findPurchaseDocumentMetaById,
} from "@/repositories/purchase-document.repository";
import {
  createPurchaseInvoice,
  findPurchaseInvoiceById,
} from "@/repositories/purchase-invoice.repository";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { createQuotation, findQuotationById } from "@/repositories/rfq.repository";
import {
  createSupplierMessage,
  findSupplierMessages,
} from "@/repositories/supplier-message.repository";
import { toDocumentDTO } from "@/services/purchase-document.mapper";
import {
  assertSupplierAccepts,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type {
  PurchaseDocumentDTO,
  PurchaseDocumentKind,
  PurchaseDocumentSource,
  QuoteRequestResultDTO,
  SupplierMessageDTO,
} from "@/types/purchasing";

export const DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND";
export const DOCUMENT_PARENT_NOT_FOUND = "DOCUMENT_PARENT_NOT_FOUND";

const DAY_MS = 86_400_000;

// ------------------------------------------------ recording from a document ---

/**
 * A supplier's quote typed from its PDF or photo: supplier, dates and the
 * totals printed on it. No item lines — the document itself is the detail.
 */
export const recordQuotationFromDocument = async (
  ctx: PurchasingContext,
  input: QuickQuotationInput,
): Promise<{ id: string; number: string }> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "RFQ");
  const totals = splitDocumentTotal(input);
  const quotation = await createQuotation(
    ctx.restaurantId,
    ctx.userId,
    {
      supplierId: supplier.id,
      rfqId: null,
      supplierReference: input.supplierReference ?? null,
      summaryOnly: true,
      transactionDate: input.transactionDate ?? new Date(),
      validUntil: input.validUntil ?? null,
      currency: supplier.currency,
      subtotal: totals.ht,
      discountAmount: 0,
      taxTotal: totals.vat,
      grandTotal: totals.ttc,
      notes: input.notes ?? null,
      termsText: null,
    },
    [],
  );
  return { id: quotation.id, number: quotation.number };
};

/**
 * A supplier's invoice recorded with just its total: it becomes a debt to
 * pay like any other, without typing every line. Stock is not touched.
 */
export const recordInvoiceFromDocument = async (
  ctx: PurchasingContext,
  input: QuickInvoiceInput,
): Promise<{ id: string; number: string }> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  assertSupplierAccepts(supplier, "INVOICES");
  const totals = splitDocumentTotal(input);
  const postingDate = input.postingDate ?? new Date();
  const dueDate =
    input.dueDate ?? new Date(postingDate.getTime() + (supplier.paymentTermsDays ?? 0) * DAY_MS);

  const invoice = await createPurchaseInvoice(
    ctx.restaurantId,
    ctx.userId,
    {
      summaryOnly: true,
      supplierId: supplier.id,
      supplierInvoiceNo: input.supplierInvoiceNo ?? null,
      purchaseOrderId: null,
      purchaseReceiptId: null,
      postingDate,
      dueDate,
      currency: supplier.currency,
      subtotal: totals.ht,
      discountAmount: 0,
      taxTotal: totals.vat,
      roundOff: 0,
      grandTotal: totals.ttc,
      outstandingAmount: totals.ttc,
      updateStock: false,
      isReturn: false,
      returnAgainstId: null,
      notes: input.notes ?? null,
      termsText: null,
    },
    [],
    [{ dueDate, invoicePortion: 100, amount: totals.ttc, sortOrder: 0 }],
  );
  return { id: invoice.id, number: invoice.number };
};

// ------------------------------------------------------------- documents ---

export interface IncomingDocument {
  readonly buffer: Buffer;
  readonly type: string;
  readonly size: number;
  readonly name: string;
}

/** Formats sharp can re-encode; HEIC and PDF are kept exactly as sent. */
const SHRINKABLE = new Set(["image/jpeg", "image/png", "image/webp"]);
const SHRINK_ABOVE_BYTES = 600_000;

const cleanFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 120) || "document";

/**
 * A phone photo of an invoice is several megabytes; shrunk to a sharp
 * 2 200-pixel JPEG it stays perfectly legible at a tenth of the size.
 */
const prepare = async (file: IncomingDocument) => {
  const fileName = cleanFileName(file.name);
  if (SHRINKABLE.has(file.type) && file.size > SHRINK_ABOVE_BYTES) {
    const content = await sharp(file.buffer)
      .rotate()
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { content, mimeType: "image/jpeg", fileName: fileName.replace(/\.[^.]+$/, "") + ".jpg" };
  }
  return { content: file.buffer, mimeType: file.type, fileName };
};

const assertParentOwned = async (
  restaurantId: string,
  kind: PurchaseDocumentKind,
  parentId: string,
): Promise<void> => {
  const parent =
    kind === "QUOTATION"
      ? await findQuotationById(parentId)
      : await findPurchaseInvoiceById(parentId);
  if (!parent || parent.restaurantId !== restaurantId) {
    throw new Error(DOCUMENT_PARENT_NOT_FOUND);
  }
};

export const attachPurchaseDocument = async (
  ctx: PurchasingContext,
  input: {
    readonly kind: PurchaseDocumentKind;
    readonly parentId: string;
    readonly source: PurchaseDocumentSource;
    readonly file: IncomingDocument;
  },
): Promise<PurchaseDocumentDTO> => {
  const problem = checkDocumentFile(input.file);
  if (problem) throw new Error(problem);
  await assertParentOwned(ctx.restaurantId, input.kind, input.parentId);
  const prepared = await prepare(input.file);
  return toDocumentDTO(
    await createPurchaseDocument({
      restaurantId: ctx.restaurantId,
      kind: input.kind,
      source: input.source,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      content: prepared.content,
      quotationId: input.kind === "QUOTATION" ? input.parentId : null,
      invoiceId: input.kind === "INVOICE" ? input.parentId : null,
      uploadedById: ctx.userId,
    }),
  );
};

export const getPurchaseDocumentFile = async (
  ctx: PurchasingContext,
  id: string,
): Promise<{ fileName: string; mimeType: string; content: Buffer }> => {
  const document = await findPurchaseDocumentById(id);
  if (!document || document.restaurantId !== ctx.restaurantId) {
    throw new Error(DOCUMENT_NOT_FOUND);
  }
  return {
    fileName: document.fileName,
    mimeType: document.mimeType,
    content: Buffer.from(document.content),
  };
};

export const removePurchaseDocument = async (ctx: PurchasingContext, id: string): Promise<void> => {
  const document = await findPurchaseDocumentMetaById(id);
  if (!document || document.restaurantId !== ctx.restaurantId) {
    throw new Error(DOCUMENT_NOT_FOUND);
  }
  await deletePurchaseDocument(document.id);
};

// ------------------------------------------------------ quote requests ---

/**
 * Ask suppliers for a price. Each supplier with an address gets the email from
 * the app's mail service; without one configured (or if it refuses), the same
 * message comes back as a mailto link for the owner's own mail app. Every
 * attempt is logged against the supplier.
 */
export const sendQuoteRequests = async (
  ctx: PurchasingContext,
  input: QuoteRequestInput,
): Promise<QuoteRequestResultDTO[]> => {
  const restaurant = await findRestaurantById(ctx.restaurantId);
  const configured = isEmailConfigured();
  const results: QuoteRequestResultDTO[] = [];

  for (const supplierId of input.supplierIds) {
    const supplier = await loadOwnedSupplier(ctx.restaurantId, supplierId);
    assertSupplierAccepts(supplier, "RFQ");
    if (!supplier.email) {
      results.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        toEmail: null,
        status: "NO_EMAIL",
        error: null,
        mailto: null,
      });
      continue;
    }

    const { subject, body } = buildQuoteRequest({
      restaurantName: restaurant?.name ?? "",
      senderName: null,
      senderPhone: restaurant?.phone ?? null,
      supplierName: supplier.name,
      contactPerson: supplier.contactPerson,
      lines: input.lines,
      message: input.message ?? null,
      neededBy: input.neededBy ?? null,
    });
    const mailto = mailtoLink({ to: supplier.email, subject, body });

    const sent = configured
      ? await sendEmail({ to: supplier.email, subject, text: body, replyTo: restaurant?.email ?? null })
      : null;
    const status = sent === null ? "MAILTO" : sent.ok ? "SENT" : "FAILED";
    const error = sent && !sent.ok ? sent.error : null;

    await createSupplierMessage({
      restaurantId: ctx.restaurantId,
      supplierId: supplier.id,
      rfqId: input.rfqId ?? null,
      toEmail: supplier.email,
      subject,
      body,
      status,
      providerId: sent && sent.ok ? sent.id : null,
      error,
      sentById: ctx.userId,
    });

    results.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      toEmail: supplier.email,
      status,
      error,
      mailto,
    });
  }
  return results;
};

export const listSupplierMessages = async (
  ctx: PurchasingContext,
  filter: { supplierId?: string; take?: number } = {},
): Promise<SupplierMessageDTO[]> =>
  (await findSupplierMessages(ctx.restaurantId, filter)).map((m) => ({
    id: m.id,
    supplierId: m.supplierId,
    supplierName: m.supplier.name,
    toEmail: m.toEmail,
    subject: m.subject,
    status: m.status,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  }));
