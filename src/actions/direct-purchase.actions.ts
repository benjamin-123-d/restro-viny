"use server";

/**
 * Purchases made the short way (shop ticket paid on the spot), the breakdown
 * of any invoice by what it was spent on, and the restaurant's purchasing
 * method.
 */

import { withPermission } from "@/actions/helpers";
import { editContext, fileOf, parseWith } from "@/actions/upload-helpers";
import { humanError } from "@/lib/error-messages";
import { checkDocumentFile } from "@/lib/supplier-documents";
import { directPurchaseSchema, invoiceBreakdownSchema, purchasingModeSchema } from "@/lib/validators/direct-purchase";
import type { ReceiptReading } from "@/lib/receipt-parser";
import { recordDirectPurchase, setInvoiceBreakdown, setPurchasingMode } from "@/services/direct-purchase.service";
import { applyMemory } from "@/services/purchase-memory.service";
import { readReceipt } from "@/services/receipt-ocr.service";
import { failure, success, type ActionResult } from "@/types";

/** FormData: `payload` (the ticket as JSON) and, optionally, `file`. */
export const recordDirectPurchaseAction = async (
  formData: FormData,
): Promise<ActionResult<{ id: string; number: string }>> => {
  const ctx = await editContext("PURCHASING");
  if (typeof ctx === "string") return failure(ctx);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return failure("Validation failed");
  }
  const { data, fieldErrors } = parseWith(directPurchaseSchema, raw);
  if (!data) return failure("Validation failed", fieldErrors ?? undefined);

  const file = await fileOf(formData);
  const problem = file ? checkDocumentFile(file) : null;
  if (problem) return failure(humanError(problem), { file: [humanError(problem)] });

  try {
    return success(await recordDirectPurchase(ctx, data, file));
  } catch (error) {
    return failure(humanError(error instanceof Error ? error.message : undefined));
  }
};

export const setInvoiceBreakdownAction = withPermission("PURCHASING", "EDIT", invoiceBreakdownSchema, (data, ctx) =>
  setInvoiceBreakdown(ctx, data),
);

export const setPurchasingModeAction = withPermission("PURCHASING", "EDIT", purchasingModeSchema, (data, ctx) =>
  setPurchasingMode(ctx, data.mode),
);

/** FormData: `file`, the ticket photo or PDF to read on this computer. */
export const readReceiptAction = async (formData: FormData): Promise<ActionResult<ReceiptReading>> => {
  const ctx = await editContext("PURCHASING");
  if (typeof ctx === "string") return failure(ctx);
  const file = await fileOf(formData);
  if (!file) return failure("Choisissez un fichier ou prenez une photo.");
  const problem = checkDocumentFile(file);
  if (problem) return failure(humanError(problem));
  try {
    const { reading } = await readReceipt(file);
    // What the restaurant already learned about these wordings comes back filled in.
    return success({ ...reading, lines: await applyMemory(ctx.restaurantId, reading.lines) });
  } catch (error) {
    return failure(humanError(error instanceof Error ? error.message : undefined));
  }
};
