"use server";

/**
 * Supplier documents arriving (a quote or invoice imported as a PDF or taken
 * as a photo) and requests for quotes leaving by email. The recording actions
 * take FormData because they carry a file alongside the typed fields.
 */

import type { ZodType } from "zod";

import { withPermission } from "@/actions/helpers";
import { humanError } from "@/lib/error-messages";
import { getManagerContextOrNull, type ManagerContext } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { checkDocumentFile } from "@/lib/supplier-documents";
import {
  documentSourceSchema,
  purchaseDocumentIdSchema,
  quickInvoiceSchema,
  quickQuotationSchema,
  quoteRequestSchema,
} from "@/lib/validators/purchasing";
import { resolveAccess } from "@/services/access.service";
import {
  attachPurchaseDocument,
  recordInvoiceFromDocument,
  recordQuotationFromDocument,
  removePurchaseDocument,
  sendQuoteRequests,
  type IncomingDocument,
} from "@/services/supplier-documents.service";
import { failure, success, type ActionResult } from "@/types";
import type { PurchaseDocumentKind } from "@/types/purchasing";

const editContext = async (): Promise<ManagerContext | string> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) return "NO_RESTAURANT";
  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access || !can(access, "PURCHASING", "EDIT")) return "FORBIDDEN";
  return ctx;
};

/** The typed fields of a form, without its files. */
const fieldsOf = (formData: FormData): Record<string, string> => {
  const fields: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && key !== "file") fields[key] = value;
  });
  return fields;
};

const fileOf = async (formData: FormData): Promise<IncomingDocument | null> => {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    type: file.type,
    size: file.size,
    name: file.name,
  };
};

const parse = <T>(schema: ZodType<T>, raw: unknown) => {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { data: parsed.data, fieldErrors: null };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    (fieldErrors[issue.path.map(String).join(".") || "form"] ??= []).push(issue.message);
  }
  return { data: null, fieldErrors };
};

const recordWithDocument = async <TInput extends { source?: "FILE" | "PHOTO" | "EMAIL" }>(
  formData: FormData,
  kind: PurchaseDocumentKind,
  schema: ZodType<TInput>,
  record: (ctx: ManagerContext, input: TInput) => Promise<{ id: string; number: string }>,
): Promise<ActionResult<{ id: string; number: string }>> => {
  const ctx = await editContext();
  if (typeof ctx === "string") return failure(ctx);

  const { data, fieldErrors } = parse(schema, fieldsOf(formData));
  if (!data) return failure("Validation failed", fieldErrors ?? undefined);

  const file = await fileOf(formData);
  // Check the file before anything is written, so a bad upload leaves nothing behind.
  const problem = file ? checkDocumentFile(file) : null;
  if (problem) return failure(humanError(problem), { file: [humanError(problem)] });

  try {
    const created = await record(ctx, data);
    if (file) {
      await attachPurchaseDocument(ctx, {
        kind,
        parentId: created.id,
        source: data.source ?? "FILE",
        file,
      });
    }
    return success(created);
  } catch (error) {
    return failure(humanError(error instanceof Error ? error.message : undefined));
  }
};

export const recordQuotationFromDocumentAction = async (formData: FormData) =>
  recordWithDocument(formData, "QUOTATION", quickQuotationSchema, recordQuotationFromDocument);

export const recordInvoiceFromDocumentAction = async (formData: FormData) =>
  recordWithDocument(formData, "INVOICE", quickInvoiceSchema, recordInvoiceFromDocument);

/** Add a document to a quotation or invoice that already exists. */
export const attachPurchaseDocumentAction = async (
  formData: FormData,
): Promise<ActionResult<{ id: string }>> => {
  const ctx = await editContext();
  if (typeof ctx === "string") return failure(ctx);
  const kind = formData.get("kind");
  const parentId = formData.get("parentId");
  const source = documentSourceSchema.safeParse(formData.get("source") ?? "FILE");
  const file = await fileOf(formData);
  if ((kind !== "QUOTATION" && kind !== "INVOICE") || typeof parentId !== "string" || !file) {
    return failure("Choisissez un fichier ou prenez une photo.");
  }
  try {
    const document = await attachPurchaseDocument(ctx, {
      kind,
      parentId,
      source: source.success ? source.data : "FILE",
      file,
    });
    return success({ id: document.id });
  } catch (error) {
    return failure(humanError(error instanceof Error ? error.message : undefined));
  }
};

export const removePurchaseDocumentAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseDocumentIdSchema,
  (data, ctx) => removePurchaseDocument(ctx, data.id),
);

export const sendQuoteRequestsAction = withPermission(
  "PURCHASING",
  "EDIT",
  quoteRequestSchema,
  (data, ctx) => sendQuoteRequests(ctx, data),
);
