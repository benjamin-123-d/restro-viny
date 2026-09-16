import { z } from "zod";

import { emailSchema, idSchema } from "@/lib/validators/shared";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const money = z.coerce.number().nonnegative().max(100_000_000);
const positiveMoney = z.coerce.number().positive().max(100_000_000);
const positiveQty = z.coerce.number().positive().max(1_000_000);
const percent = z.coerce.number().min(0).max(100);
const optionalDate = z.coerce.date().optional();

export const salesPaymentModeSchema = z.enum([
  "CASH",
  "UPI",
  "CARD",
  "OTHER",
  "BANK_TRANSFER",
  "CHEQUE",
  "MOBILE_MONEY",
]);

// ------------------------------------------------- customer group / territory ---

export const createCustomerGroupSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  defaultDiscountPercent: percent.optional(),
  notes: optionalText(300),
});
export type CreateCustomerGroupInput = z.infer<
  typeof createCustomerGroupSchema
>;

export const updateCustomerGroupSchema = createCustomerGroupSchema.extend({
  id: idSchema,
});
export type UpdateCustomerGroupInput = z.infer<
  typeof updateCustomerGroupSchema
>;

export const createTerritorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  notes: optionalText(300),
});
export type CreateTerritoryInput = z.infer<typeof createTerritorySchema>;

export const updateTerritorySchema = createTerritorySchema.extend({
  id: idSchema,
});
export type UpdateTerritoryInput = z.infer<typeof updateTerritorySchema>;

export const entityIdSchema = z.object({ id: idSchema });
export type EntityIdInput = z.infer<typeof entityIdSchema>;

// -------------------------------------------------------------- customer ---

const customerFields = {
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(140),
  customerGroupId: idSchema.optional(),
  territoryId: idSchema.optional(),
  taxId: optionalText(40),
  contactPerson: optionalText(120),
  email: emailSchema.optional(),
  phone: optionalText(24),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(60),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: money.optional(),
  blockOnCreditLimit: z.boolean().default(true),
  disabled: z.boolean().default(false),
  notes: optionalText(600),
};

export const createCustomerSchema = z.object(customerFields);
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  ...customerFields,
  id: idSchema,
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ---------------------------------------------------------------- lines ---

/**
 * A sales line may point at a menu or stock item, or be a plain described
 * service — "Buffet, 60 guests" is exactly what a caterer bills, and it is not
 * in any catalogue. The name is always required so the document reads
 * correctly on its own, whatever the catalogue later becomes.
 */
const salesLineSchema = z.object({
  menuItemId: idSchema.optional(),
  stockItemId: idSchema.optional(),
  itemName: z.string().trim().min(1, "Décrivez l'article ou la prestation").max(160),
  description: optionalText(200),
  quantity: positiveQty,
  rate: money,
  discountPercent: percent.optional(),
  taxRate: percent.default(0),
});

// ------------------------------------------------------------ quotation ---

export const createSalesQuotationSchema = z.object({
  customerId: idSchema,
  transactionDate: optionalDate,
  validUntil: optionalDate,
  discountAmount: money.default(0),
  roundTotal: z.boolean().default(false),
  notes: optionalText(600),
  termsText: optionalText(2000),
  items: z.array(salesLineSchema).min(1, "Ajoutez au moins un article."),
});
export type CreateSalesQuotationInput = z.infer<
  typeof createSalesQuotationSchema
>;

export const updateSalesQuotationSchema = createSalesQuotationSchema.extend({
  id: idSchema,
});
export type UpdateSalesQuotationInput = z.infer<
  typeof updateSalesQuotationSchema
>;

export const markQuotationLostSchema = z.object({
  id: idSchema,
  lostReason: z.string().trim().min(1, "Indiquez le motif de la perte.").max(300),
});
export type MarkQuotationLostInput = z.infer<typeof markQuotationLostSchema>;

// ---------------------------------------------------------- sales order ---

export const createSalesOrderSchema = z.object({
  customerId: idSchema,
  quotationId: idSchema.optional(),
  transactionDate: optionalDate,
  deliveryDate: optionalDate,
  poNumber: optionalText(80),
  discountAmount: money.default(0),
  roundTotal: z.boolean().default(false),
  notes: optionalText(600),
  termsText: optionalText(2000),
  items: z.array(salesLineSchema).min(1, "Ajoutez au moins un article."),
});
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const updateSalesOrderSchema = createSalesOrderSchema.extend({
  id: idSchema,
});
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;

export const holdSalesOrderSchema = z.object({
  id: idSchema,
  onHold: z.boolean(),
  comment: optionalText(300),
});
export type HoldSalesOrderInput = z.infer<typeof holdSalesOrderSchema>;

export const orderFromQuotationSchema = z.object({
  quotationId: idSchema,
  deliveryDate: optionalDate,
});
export type OrderFromQuotationInput = z.infer<typeof orderFromQuotationSchema>;

// -------------------------------------------------------- delivery note ---

const deliveryLineSchema = z.object({
  salesOrderItemId: idSchema.optional(),
  menuItemId: idSchema.optional(),
  stockItemId: idSchema.optional(),
  itemName: z.string().trim().min(1).max(160),
  description: optionalText(200),
  quantity: positiveQty,
  rate: money,
  taxRate: percent.default(0),
  batchNo: optionalText(60),
});

export const createDeliveryNoteSchema = z.object({
  customerId: idSchema,
  salesOrderId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  postingDate: optionalDate,
  driverName: optionalText(120),
  vehicleNo: optionalText(24),
  notes: optionalText(600),
  items: z.array(deliveryLineSchema).min(1, "Ajoutez au moins un article."),
});
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;

export const deliverAgainstOrderSchema = z.object({ salesOrderId: idSchema });
export type DeliverAgainstOrderInput = z.infer<
  typeof deliverAgainstOrderSchema
>;

export const createSalesReturnSchema = z.object({
  deliveryNoteId: idSchema,
  items: z
    .array(z.object({ deliveryNoteItemId: idSchema, quantity: positiveQty }))
    .min(1, "Choisissez ce qui revient."),
  notes: optionalText(600),
});
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;

// -------------------------------------------------------- sales invoice ---

const invoiceLineSchema = z.object({
  salesOrderItemId: idSchema.optional(),
  deliveryNoteItemId: idSchema.optional(),
  menuItemId: idSchema.optional(),
  stockItemId: idSchema.optional(),
  itemName: z.string().trim().min(1).max(160),
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

export const createSalesInvoiceSchema = z
  .object({
    customerId: idSchema,
    salesOrderId: idSchema.optional(),
    deliveryNoteId: idSchema.optional(),
    postingDate: optionalDate,
    dueDate: optionalDate,
    discountAmount: money.default(0),
    roundTotal: z.boolean().default(false),
    /** Issue stock from the invoice itself when nothing was delivered on a note. */
    updateStock: z.boolean().default(false),
    notes: optionalText(600),
    termsText: optionalText(2000),
    items: z.array(invoiceLineSchema).min(1, "Ajoutez au moins un article."),
    schedule: z.array(scheduleLineSchema).optional(),
  })
  .refine(
    (v) =>
      !v.schedule ||
      v.schedule.length === 0 ||
      Math.abs(
        v.schedule.reduce((sum, s) => sum + s.invoicePortion, 0) - 100,
      ) < 0.01,
    { message: "Les échéances doivent faire 100 % au total.", path: ["schedule"] },
  );
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;

export const billAgainstDeliverySchema = z.object({
  deliveryNoteId: idSchema,
});
export type BillAgainstDeliveryInput = z.infer<
  typeof billAgainstDeliverySchema
>;

// ----------------------------------------------------- customer payment ---

export const createCustomerPaymentSchema = z
  .object({
    customerId: idSchema,
    paymentDate: optionalDate,
    mode: salesPaymentModeSchema.default("CASH"),
    amount: positiveMoney,
    referenceNo: optionalText(80),
    referenceDate: optionalDate,
    notes: optionalText(300),
    allocations: z
      .array(z.object({ salesInvoiceId: idSchema, amount: positiveMoney }))
      .default([]),
  })
  .refine(
    (v) =>
      v.allocations.reduce((sum, a) => sum + a.amount, 0) <= v.amount + 0.01,
    { message: "Le montant affecté dépasse le paiement.", path: ["allocations"] },
  )
  .refine(
    (v) =>
      new Set(v.allocations.map((a) => a.salesInvoiceId)).size ===
      v.allocations.length,
    { message: "La même facture apparaît deux fois.", path: ["allocations"] },
  );
export type CreateCustomerPaymentInput = z.infer<
  typeof createCustomerPaymentSchema
>;
