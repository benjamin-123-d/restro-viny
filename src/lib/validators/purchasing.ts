import { z } from "zod";

import { emailSchema, idSchema } from "@/lib/validators/shared";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const money = z.coerce.number().nonnegative().max(100_000_000);
const positiveMoney = z.coerce.number().positive().max(100_000_000);
const positiveQty = z.coerce.number().positive().max(1_000_000);
const nonNegQty = z.coerce.number().nonnegative().max(1_000_000);
const percent = z.coerce.number().min(0).max(100);
const optionalDate = z.coerce.date().optional();

export const supplierHoldTypeSchema = z.enum(["ALL", "INVOICES", "PAYMENTS"]);

export const supplierPaymentModeSchema = z.enum([
  "CASH",
  "UPI",
  "CARD",
  "OTHER",
  "BANK_TRANSFER",
  "CHEQUE",
  "MOBILE_MONEY",
]);

// -------------------------------------------------------- supplier group ---

export const createSupplierGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  notes: optionalText(300),
});
export type CreateSupplierGroupInput = z.infer<
  typeof createSupplierGroupSchema
>;

export const updateSupplierGroupSchema = createSupplierGroupSchema.extend({
  id: idSchema,
});
export type UpdateSupplierGroupInput = z.infer<
  typeof updateSupplierGroupSchema
>;

export const deleteSupplierGroupSchema = z.object({ id: idSchema });
export type DeleteSupplierGroupInput = z.infer<
  typeof deleteSupplierGroupSchema
>;

// -------------------------------------------------------------- supplier ---

const supplierFields = {
  name: z.string().trim().min(1, "Name is required").max(140),
  supplierGroupId: idSchema.optional(),
  taxId: optionalText(40),
  contactPerson: optionalText(120),
  email: emailSchema.optional(),
  phone: optionalText(24),
  website: optionalText(200),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(60),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  preventRfq: z.boolean().default(false),
  preventPo: z.boolean().default(false),
  disabled: z.boolean().default(false),
  notes: optionalText(600),
};

export const createSupplierSchema = z.object(supplierFields);
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z.object({
  ...supplierFields,
  id: idSchema,
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const deleteSupplierSchema = z.object({ id: idSchema });
export type DeleteSupplierInput = z.infer<typeof deleteSupplierSchema>;

/**
 * Put a supplier on hold, or lift the hold. `releaseDate` schedules the lift;
 * without it the hold stands until someone removes it.
 */
export const setSupplierHoldSchema = z
  .object({
    id: idSchema,
    onHold: z.boolean(),
    holdType: supplierHoldTypeSchema.optional(),
    releaseDate: optionalDate,
  })
  .refine((v) => !v.onHold || v.holdType !== undefined, {
    message: "Choose what the hold blocks",
    path: ["holdType"],
  });
export type SetSupplierHoldInput = z.infer<typeof setSupplierHoldSchema>;

export const setItemDefaultSupplierSchema = z.object({
  stockItemId: idSchema,
  supplierId: idSchema.nullable(),
});
export type SetItemDefaultSupplierInput = z.infer<
  typeof setItemDefaultSupplierSchema
>;

// ------------------------------------------------------------------- rfq ---

const rfqLineSchema = z.object({
  stockItemId: idSchema,
  description: optionalText(200),
  quantity: positiveQty,
  requiredBy: optionalDate,
});

export const createRfqSchema = z.object({
  transactionDate: optionalDate,
  requiredBy: optionalDate,
  message: optionalText(600),
  termsText: optionalText(2000),
  items: z.array(rfqLineSchema).min(1, "Add at least one item"),
  supplierIds: z.array(idSchema).min(1, "Invite at least one supplier"),
});
export type CreateRfqInput = z.infer<typeof createRfqSchema>;

export const updateRfqSchema = createRfqSchema.extend({ id: idSchema });
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;

export const rfqIdSchema = z.object({ id: idSchema });
export type RfqIdInput = z.infer<typeof rfqIdSchema>;

export const markRfqSentSchema = z.object({
  rfqId: idSchema,
  supplierId: idSchema,
});
export type MarkRfqSentInput = z.infer<typeof markRfqSentSchema>;

// ------------------------------------------------------ supplier quotation ---

const quotationLineSchema = z.object({
  stockItemId: idSchema,
  rfqItemId: idSchema.optional(),
  description: optionalText(200),
  quantity: positiveQty,
  rate: money,
  discountPercent: percent.optional(),
  taxRate: percent.default(0),
  leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
});

export const createSupplierQuotationSchema = z.object({
  supplierId: idSchema,
  rfqId: idSchema.optional(),
  transactionDate: optionalDate,
  validUntil: optionalDate,
  discountAmount: money.default(0),
  notes: optionalText(600),
  termsText: optionalText(2000),
  items: z.array(quotationLineSchema).min(1, "Add at least one item"),
});
export type CreateSupplierQuotationInput = z.infer<
  typeof createSupplierQuotationSchema
>;

export const updateSupplierQuotationSchema =
  createSupplierQuotationSchema.extend({ id: idSchema });
export type UpdateSupplierQuotationInput = z.infer<
  typeof updateSupplierQuotationSchema
>;

export const supplierQuotationIdSchema = z.object({ id: idSchema });
export type SupplierQuotationIdInput = z.infer<
  typeof supplierQuotationIdSchema
>;

// -------------------------------------------------------- purchase order ---

const purchaseOrderLineSchema = z.object({
  stockItemId: idSchema,
  supplierQuotationItemId: idSchema.optional(),
  description: optionalText(200),
  quantity: positiveQty,
  rate: money,
  discountPercent: percent.optional(),
  taxRate: percent.default(0),
  scheduleDate: optionalDate,
});

export const createPurchaseOrderSchema = z.object({
  supplierId: idSchema,
  supplierQuotationId: idSchema.optional(),
  transactionDate: optionalDate,
  scheduleDate: optionalDate,
  discountAmount: money.default(0),
  roundTotal: z.boolean().default(false),
  notes: optionalText(600),
  termsText: optionalText(2000),
  items: z.array(purchaseOrderLineSchema).min(1, "Add at least one item"),
});
export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  id: idSchema,
});
export type UpdatePurchaseOrderInput = z.infer<
  typeof updatePurchaseOrderSchema
>;

export const purchaseOrderIdSchema = z.object({ id: idSchema });
export type PurchaseOrderIdInput = z.infer<typeof purchaseOrderIdSchema>;

export const holdPurchaseOrderSchema = z.object({
  id: idSchema,
  onHold: z.boolean(),
  comment: optionalText(300),
});
export type HoldPurchaseOrderInput = z.infer<typeof holdPurchaseOrderSchema>;

/** Turn a submitted quotation into a purchase order, optionally line-picking. */
export const createOrderFromQuotationSchema = z.object({
  quotationId: idSchema,
  quotationItemIds: z.array(idSchema).optional(),
  scheduleDate: optionalDate,
});
export type CreateOrderFromQuotationInput = z.infer<
  typeof createOrderFromQuotationSchema
>;

// ------------------------------------------------------ purchase receipt ---

const receiptLineSchema = z.object({
  stockItemId: idSchema,
  purchaseOrderItemId: idSchema.optional(),
  description: optionalText(200),
  quantity: nonNegQty,
  rejectedQuantity: nonNegQty.default(0),
  rate: money,
  taxRate: percent.default(0),
  batchNo: optionalText(60),
  expiryDate: optionalDate,
});

export const createPurchaseReceiptSchema = z
  .object({
    supplierId: idSchema,
    purchaseOrderId: idSchema.optional(),
    postingDate: optionalDate,
    supplierDeliveryNote: optionalText(80),
    notes: optionalText(600),
    items: z.array(receiptLineSchema).min(1, "Add at least one item"),
  })
  .refine((v) => v.items.some((i) => i.quantity > 0 || i.rejectedQuantity > 0), {
    message: "Record a quantity on at least one line",
    path: ["items"],
  });
export type CreatePurchaseReceiptInput = z.infer<
  typeof createPurchaseReceiptSchema
>;

export const purchaseReceiptIdSchema = z.object({ id: idSchema });
export type PurchaseReceiptIdInput = z.infer<typeof purchaseReceiptIdSchema>;

/** Pre-fill a receipt from what is still outstanding on an order. */
export const receiveAgainstOrderSchema = z.object({
  purchaseOrderId: idSchema,
});
export type ReceiveAgainstOrderInput = z.infer<
  typeof receiveAgainstOrderSchema
>;

export const createPurchaseReturnSchema = z.object({
  purchaseReceiptId: idSchema,
  items: z
    .array(z.object({ purchaseReceiptItemId: idSchema, quantity: positiveQty }))
    .min(1, "Choose what is going back"),
  notes: optionalText(600),
});
export type CreatePurchaseReturnInput = z.infer<
  typeof createPurchaseReturnSchema
>;

// ------------------------------------------------------ purchase invoice ---

const invoiceLineSchema = z.object({
  stockItemId: idSchema,
  purchaseOrderItemId: idSchema.optional(),
  purchaseReceiptItemId: idSchema.optional(),
  description: optionalText(200),
  quantity: positiveQty,
  rate: money,
  discountPercent: percent.optional(),
  taxRate: percent.default(0),
});

const scheduleLineSchema = z.object({
  dueDate: z.coerce.date(),
  invoicePortion: percent,
  amount: money,
});

export const createPurchaseInvoiceSchema = z
  .object({
    supplierId: idSchema,
    supplierInvoiceNo: optionalText(80),
    purchaseOrderId: idSchema.optional(),
    purchaseReceiptId: idSchema.optional(),
    postingDate: optionalDate,
    dueDate: optionalDate,
    discountAmount: money.default(0),
    roundTotal: z.boolean().default(false),
    /** Move stock from the invoice itself, when no receipt was recorded. */
    updateStock: z.boolean().default(false),
    notes: optionalText(600),
    termsText: optionalText(2000),
    items: z.array(invoiceLineSchema).min(1, "Add at least one item"),
    schedule: z.array(scheduleLineSchema).optional(),
  })
  .refine(
    (v) =>
      !v.schedule ||
      v.schedule.length === 0 ||
      Math.abs(
        v.schedule.reduce((sum, s) => sum + s.invoicePortion, 0) - 100,
      ) < 0.01,
    { message: "Instalments must add up to 100%", path: ["schedule"] },
  );
export type CreatePurchaseInvoiceInput = z.infer<
  typeof createPurchaseInvoiceSchema
>;

export const purchaseInvoiceIdSchema = z.object({ id: idSchema });
export type PurchaseInvoiceIdInput = z.infer<typeof purchaseInvoiceIdSchema>;

export const billAgainstReceiptSchema = z.object({
  purchaseReceiptId: idSchema,
});
export type BillAgainstReceiptInput = z.infer<typeof billAgainstReceiptSchema>;

export const billAgainstOrderSchema = z.object({ purchaseOrderId: idSchema });
export type BillAgainstOrderInput = z.infer<typeof billAgainstOrderSchema>;

// ------------------------------------------------------ supplier payment ---

export const createSupplierPaymentSchema = z
  .object({
    supplierId: idSchema,
    paymentDate: optionalDate,
    mode: supplierPaymentModeSchema.default("CASH"),
    amount: positiveMoney,
    referenceNo: optionalText(80),
    referenceDate: optionalDate,
    notes: optionalText(300),
    allocations: z
      .array(
        z.object({ purchaseInvoiceId: idSchema, amount: positiveMoney }),
      )
      .default([]),
  })
  .refine(
    (v) =>
      v.allocations.reduce((sum, a) => sum + a.amount, 0) <= v.amount + 0.01,
    {
      message: "Allocated more than the payment amount",
      path: ["allocations"],
    },
  )
  .refine(
    (v) =>
      new Set(v.allocations.map((a) => a.purchaseInvoiceId)).size ===
      v.allocations.length,
    { message: "The same invoice appears twice", path: ["allocations"] },
  );
export type CreateSupplierPaymentInput = z.infer<
  typeof createSupplierPaymentSchema
>;

export const supplierPaymentIdSchema = z.object({ id: idSchema });
export type SupplierPaymentIdInput = z.infer<typeof supplierPaymentIdSchema>;

// ------------------------------------------------------------ scorecard ---

export const generateScorecardSchema = z.object({
  supplierId: idSchema,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});
export type GenerateScorecardInput = z.infer<typeof generateScorecardSchema>;

// ------------------------------------------- documents imported from suppliers ---

/** Form fields arrive as strings: an empty one means "not given". */
const blank = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

export const documentSourceSchema = z.enum(["FILE", "PHOTO", "EMAIL"]);

const documentTotals = {
  totalTTC: z.coerce
    .number({ error: "Indiquez le total TTC du document." })
    .positive("Indiquez le total TTC du document.")
    .max(100_000_000),
  vatAmount: blank(money.optional()),
  vatRate: blank(percent.optional()),
  notes: blank(optionalText(600)),
  source: blank(documentSourceSchema.default("FILE")),
};

/** A supplier's quote recorded from its document: who, when, how much. */
export const quickQuotationSchema = z
  .object({
    supplierId: idSchema,
    supplierReference: blank(optionalText(80)),
    transactionDate: blank(optionalDate),
    validUntil: blank(optionalDate),
    ...documentTotals,
  })
  .refine((v) => v.vatAmount == null || v.vatAmount <= v.totalTTC, {
    message: "La TVA ne peut pas dépasser le total.",
    path: ["vatAmount"],
  });
export type QuickQuotationInput = z.infer<typeof quickQuotationSchema>;

/** A supplier's invoice recorded from its document with just its totals. */
export const quickInvoiceSchema = z
  .object({
    supplierId: idSchema,
    supplierInvoiceNo: blank(optionalText(80)),
    postingDate: blank(optionalDate),
    dueDate: blank(optionalDate),
    ...documentTotals,
  })
  .refine((v) => v.vatAmount == null || v.vatAmount <= v.totalTTC, {
    message: "La TVA ne peut pas dépasser le total.",
    path: ["vatAmount"],
  })
  .refine((v) => !v.postingDate || !v.dueDate || v.dueDate >= v.postingDate, {
    message: "L'échéance ne peut pas précéder la date de la facture.",
    path: ["dueDate"],
  });
export type QuickInvoiceInput = z.infer<typeof quickInvoiceSchema>;

export const purchaseDocumentIdSchema = z.object({ id: idSchema });

const quoteRequestLineSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: positiveQty,
  unit: z.string().trim().max(20).default(""),
});

/** Ask one or several suppliers for a price, by email. */
export const quoteRequestSchema = z.object({
  supplierIds: z.array(idSchema).min(1, "Choisissez au moins un fournisseur."),
  lines: z.array(quoteRequestLineSchema).max(50).default([]),
  message: blank(optionalText(2000)),
  neededBy: blank(optionalDate),
  rfqId: blank(idSchema.optional()),
}).refine((v) => v.lines.length > 0 || Boolean(v.message), {
  message: "Indiquez au moins un produit ou un message.",
  path: ["lines"],
});
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
