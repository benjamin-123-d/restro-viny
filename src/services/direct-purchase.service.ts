/**
 * Purchases made the short way — into a shop, pay, keep the ticket — and the
 * breakdown of any purchase by what it was spent on. A direct purchase is a
 * supplier invoice born submitted and paid, so it lands in the same lists,
 * balances and reports as the long chain does.
 */

import {
  BREAKDOWN_TOLERANCE,
  breakdownGap,
  breakdownTotals,
  isFoodCategory,
  type ExpenseLineInput,
  type PurchaseCategory,
} from "@/lib/purchase-categories";
import { checkDocumentFile } from "@/lib/supplier-documents";
import type { DirectPurchaseInput, ExpenseLineFormInput, InvoiceBreakdownInput } from "@/lib/validators/direct-purchase";
import {
  findDirectPurchases,
  findIngredientPurchasesOfInvoice,
  findInvoiceExpenseLines,
  findPurchasingMode,
  findSpendingInPeriod,
  findSupplierByNameInsensitive,
  replaceExpenseLines,
  updatePurchasingMode,
} from "@/repositories/direct-purchase.repository";
import { findIngredients } from "@/repositories/food-cost.repository";
import {
  createPurchaseInvoice as createInvoiceRepo,
  findPurchaseInvoiceById,
  type ExpenseLineWriteData,
} from "@/repositories/purchase-invoice.repository";
import { recordPurchase } from "@/services/food-cost.service";
import { submitPurchaseInvoice } from "@/services/purchase-invoice.service";
import { attachPurchaseDocument, type IncomingDocument } from "@/services/supplier-documents.service";
import { createSupplierPayment } from "@/services/supplier-payment.service";
import {
  assertSupplierAccepts,
  createSupplier,
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type {
  DirectPurchaseListItemDTO,
  InvoiceBreakdownDTO,
  PurchasingMode,
  SpendingBreakdownDTO,
  SpendingBucket,
} from "@/types/direct-purchase";

export const BREAKDOWN_MISMATCH = "BREAKDOWN_MISMATCH";
export const DIRECT_PURCHASE_ITEM_INVALID = "DIRECT_PURCHASE_ITEM_INVALID";
export const INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND";

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const toWriteLines = (lines: readonly ExpenseLineFormInput[]): ExpenseLineWriteData[] =>
  breakdownTotals(lines as readonly ExpenseLineInput[]).lines.map((line, index) => ({
    category: line.category,
    label: lines[index].label ?? null,
    amountHT: round2(line.amountHT),
    vatRate: line.vatRate,
    vatAmount: line.vatAmount,
  }));

// -------------------------------------------------------------- settings ---

export const getPurchasingMode = (ctx: PurchasingContext): Promise<PurchasingMode> =>
  findPurchasingMode(ctx.restaurantId);

export const setPurchasingMode = async (ctx: PurchasingContext, mode: PurchasingMode): Promise<PurchasingMode> =>
  (await updatePurchasingMode(ctx.restaurantId, mode)).purchasingMode;

// ------------------------------------------------------ direct purchases ---

/** The shop chosen from the list, found by its name, or created from it. */
const resolveShop = async (ctx: PurchasingContext, input: DirectPurchaseInput) => {
  if (input.supplierId) return loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  const name = input.supplierName?.trim() ?? "";
  const existing = await findSupplierByNameInsensitive(ctx.restaurantId, name);
  if (existing) return loadOwnedSupplier(ctx.restaurantId, existing.id);
  const created = await createSupplier(ctx, {
    name,
    notes: "Créé depuis un achat direct.",
    preventRfq: false,
    preventPo: false,
    disabled: false,
  });
  return loadOwnedSupplier(ctx.restaurantId, created.id);
};

/**
 * Records a ticket in one go: the shop, the paid invoice with its breakdown,
 * the stock and price of each detailed ingredient, and the ticket's picture.
 * Everything that can be refused is checked before anything is written.
 */
export const recordDirectPurchase = async (
  ctx: PurchasingContext,
  input: DirectPurchaseInput,
  document: IncomingDocument | null = null,
): Promise<{ id: string; number: string }> => {
  if (document) {
    const problem = checkDocumentFile(document);
    if (problem) throw new Error(problem);
  }
  if (Math.abs(breakdownGap(input.expenseLines, input.totalTTC)) > BREAKDOWN_TOLERANCE) {
    throw new Error(BREAKDOWN_MISMATCH);
  }
  if (input.ingredientLines.length > 0) {
    const owned = new Map((await findIngredients(ctx.restaurantId)).map((i) => [i.id, i]));
    const invalid = input.ingredientLines.some((line) => {
      const item = owned.get(line.stockItemId);
      return !item || item.isPreparation;
    });
    if (invalid) throw new Error(DIRECT_PURCHASE_ITEM_INVALID);
  }

  const supplier = await resolveShop(ctx, input);
  assertSupplierAccepts(supplier, "INVOICES");

  const totals = breakdownTotals(input.expenseLines);
  const postingDate = input.purchasedAt ?? new Date();
  const invoice = await createInvoiceRepo(
    ctx.restaurantId,
    ctx.userId,
    {
      summaryOnly: true,
      isDirectPurchase: true,
      paymentMode: input.paymentMode,
      expenseLines: toWriteLines(input.expenseLines),
      supplierId: supplier.id,
      supplierInvoiceNo: input.ticketNumber ?? null,
      purchaseOrderId: null,
      purchaseReceiptId: null,
      postingDate,
      dueDate: postingDate,
      currency: supplier.currency,
      subtotal: totals.totalHT,
      discountAmount: 0,
      taxTotal: totals.totalVAT,
      roundOff: round2(input.totalTTC - totals.totalTTC),
      grandTotal: input.totalTTC,
      outstandingAmount: input.totalTTC,
      updateStock: false,
      isReturn: false,
      returnAgainstId: null,
      notes: input.notes ?? null,
      termsText: null,
    },
    [],
    [{ dueDate: postingDate, invoicePortion: 100, amount: input.totalTTC, sortOrder: 0 }],
  );

  await submitPurchaseInvoice(ctx, { id: invoice.id });

  if (input.alreadyPaid) {
    await createSupplierPayment(ctx, {
      supplierId: supplier.id,
      paymentDate: postingDate,
      mode: input.paymentMode,
      amount: input.totalTTC,
      referenceNo: input.ticketNumber,
      notes: `Achat direct ${invoice.number}`,
      allocations: [{ purchaseInvoiceId: invoice.id, amount: input.totalTTC }],
    });
  }

  for (const line of input.ingredientLines) {
    await recordPurchase(
      ctx,
      {
        stockItemId: line.stockItemId,
        quantity: line.quantity,
        amount: line.amount,
        purchasedAt: postingDate,
        note: `${supplier.name} · ${invoice.number}`,
      },
      { purchaseInvoiceId: invoice.id },
    );
  }

  if (document) {
    await attachPurchaseDocument(ctx, {
      kind: "INVOICE",
      parentId: invoice.id,
      source: input.source ?? "PHOTO",
      file: document,
    });
  }

  return { id: invoice.id, number: invoice.number };
};

export const listDirectPurchases = async (ctx: PurchasingContext): Promise<DirectPurchaseListItemDTO[]> =>
  (await findDirectPurchases(ctx.restaurantId)).map((p) => {
    const categories = new Map<PurchaseCategory, number>();
    for (const line of p.expenseLines) {
      categories.set(line.category, round2((categories.get(line.category) ?? 0) + num(line.amountHT)));
    }
    return {
      id: p.id,
      number: p.number,
      ticketNumber: p.supplierInvoiceNo,
      supplierName: p.supplier.name,
      purchasedAt: p.postingDate.toISOString(),
      totalTTC: num(p.grandTotal),
      totalHT: num(p.subtotal),
      outstandingAmount: num(p.outstandingAmount),
      paymentMode: p.paymentMode,
      categories: [...categories].map(([category, amountHT]) => ({ category, amountHT })),
      documentCount: p._count.documents,
      ingredientLineCount: p._count.ingredientPurchases,
    };
  });

// -------------------------------------------------------------- breakdown ---

const loadOwnedInvoice = async (restaurantId: string, id: string) => {
  const invoice = await findPurchaseInvoiceById(id);
  if (!invoice || invoice.restaurantId !== restaurantId) throw new Error(INVOICE_NOT_FOUND);
  return invoice;
};

export const getInvoiceBreakdown = async (ctx: PurchasingContext, purchaseInvoiceId: string): Promise<InvoiceBreakdownDTO> => {
  await loadOwnedInvoice(ctx.restaurantId, purchaseInvoiceId);
  const [lines, ingredients] = await Promise.all([
    findInvoiceExpenseLines(purchaseInvoiceId),
    findIngredientPurchasesOfInvoice(purchaseInvoiceId),
  ]);
  return {
    lines: lines.map((l) => ({
      id: l.id,
      category: l.category,
      label: l.label,
      amountHT: num(l.amountHT),
      vatRate: num(l.vatRate),
      vatAmount: num(l.vatAmount),
    })),
    ingredientLines: ingredients.map((l) => ({
      id: l.id,
      name: l.stockItem.name,
      quantity: num(l.quantity),
      purchaseUnit: l.stockItem.purchaseUnit,
      amount: num(l.amount),
    })),
  };
};

/**
 * Shares out an invoice already recorded. An empty breakdown clears it; a
 * non-empty one must add up to the invoice total, to the cent of rounding.
 */
export const setInvoiceBreakdown = async (ctx: PurchasingContext, input: InvoiceBreakdownInput): Promise<void> => {
  const invoice = await loadOwnedInvoice(ctx.restaurantId, input.purchaseInvoiceId);
  if (input.expenseLines.length > 0 && Math.abs(breakdownGap(input.expenseLines, num(invoice.grandTotal))) > BREAKDOWN_TOLERANCE) {
    throw new Error(BREAKDOWN_MISMATCH);
  }
  await replaceExpenseLines(ctx.restaurantId, invoice.id, toWriteLines(input.expenseLines));
};

/**
 * Where the purchasing money went over a period, HT. Invoices without a
 * breakdown count as goods when detailed line by line (their lines are stock
 * items), and as « non ventilé » when only their total was recorded.
 */
export const getSpendingBreakdown = async (
  ctx: PurchasingContext,
  from: Date,
  to: Date,
): Promise<SpendingBreakdownDTO> => {
  const invoices = await findSpendingInPeriod(ctx.restaurantId, from, to);
  const buckets = new Map<SpendingBucket, number>();
  let unsplit = 0;
  for (const invoice of invoices) {
    if (invoice.expenseLines.length > 0) {
      for (const line of invoice.expenseLines) {
        buckets.set(line.category, (buckets.get(line.category) ?? 0) + num(line.amountHT));
      }
    } else if (invoice.summaryOnly) {
      unsplit += 1;
      buckets.set("NON_VENTILE", (buckets.get("NON_VENTILE") ?? 0) + num(invoice.subtotal));
    } else {
      buckets.set("DENREES", (buckets.get("DENREES") ?? 0) + num(invoice.subtotal));
    }
  }
  const totalHT = round2([...buckets.values()].reduce((s, v) => s + v, 0));
  const food = [...buckets].filter(([b]) => b !== "NON_VENTILE" && isFoodCategory(b)).reduce((s, [, v]) => s + v, 0);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalHT,
    rows: [...buckets]
      .map(([bucket, amount]) => ({ bucket, amountHT: round2(amount), share: totalHT > 0 ? amount / totalHT : 0 }))
      .sort((a, b) => b.amountHT - a.amountHT),
    foodShare: totalHT > 0 ? food / totalHT : 0,
    unsplitInvoiceCount: unsplit,
  };
};
