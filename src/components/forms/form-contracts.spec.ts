import { describe, expect, it } from "vitest";

import { createJournalSchema, createAccountSchema } from "@/lib/validators/accounting";
import {
  createPurchaseInvoiceSchema,
  createPurchaseOrderSchema,
  createSupplierPaymentSchema,
  createSupplierSchema,
} from "@/lib/validators/purchasing";
import {
  createCustomerPaymentSchema,
  createCustomerSchema,
  createSalesInvoiceSchema,
  createSalesOrderSchema,
  createSalesQuotationSchema,
} from "@/lib/validators/selling";
import {
  createStockEntrySchema,
  createWarehouseSchema,
} from "@/lib/validators/stock-advanced";

/**
 * The forms and the server schemas are written separately, so nothing but a
 * test stops them drifting apart — and when they drift, "Save" silently fails
 * for the person using the app. Each payload below is exactly what a form
 * sends: numbers as strings from inputs, blank optionals omitted, dates as the
 * "YYYY-MM-DD" a date input produces.
 */

const id = "cm0000000000000000000001";
const id2 = "cm0000000000000000000002";

const expectValid = (
  schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  payload: unknown,
) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(JSON.stringify(result.error, null, 2));
  }
  expect(result.success).toBe(true);
};

describe("EntityForm payloads", () => {
  it("creates a supplier from a minimal form (name only)", () => {
    expectValid(createSupplierSchema, { name: "Marché Dantokpa", preventPo: false });
  });

  it("creates a supplier with every field the form offers", () => {
    expectValid(createSupplierSchema, {
      name: "Grossiste Akpakpa",
      supplierGroupId: id,
      taxId: "3202012345678",
      contactPerson: "M. Houngbo",
      phone: "+22997000000",
      email: "contact@grossiste.bj",
      addressLine1: "Rue 12",
      city: "Cotonou",
      country: "Bénin",
      paymentTermsDays: "30",
      currency: "XOF",
      preventPo: false,
      notes: "Livre le mardi",
    });
  });

  it("creates a customer with a credit limit typed as text", () => {
    expectValid(createCustomerSchema, {
      name: "Hôtel du Lac",
      paymentTermsDays: "30",
      creditLimit: "2000000",
      blockOnCreditLimit: true,
    });
  });

  it("creates a warehouse with its two checkboxes", () => {
    expectValid(createWarehouseSchema, {
      name: "Chambre froide",
      code: "FROID",
      isDefault: false,
      isGroup: false,
    });
  });

  it("creates an account without choosing a special role", () => {
    expectValid(createAccountSchema, {
      code: "1120",
      name: "Banque Ecobank",
      rootType: "ASSET",
      isGroup: false,
    });
  });
});

describe("DocumentForm payloads", () => {
  const stockLine = { stockItemId: id, quantity: 10, rate: 850, taxRate: 18 };

  it("creates a purchase order with a date input value", () => {
    expectValid(createPurchaseOrderSchema, {
      supplierId: id,
      scheduleDate: "2026-09-20",
      discountAmount: 0,
      roundTotal: false,
      items: [stockLine, { ...stockLine, stockItemId: id2, discountPercent: 5 }],
    });
  });

  it("creates a supplier invoice carrying the supplier's own number", () => {
    expectValid(createPurchaseInvoiceSchema, {
      supplierId: id,
      supplierInvoiceNo: "F-2291",
      discountAmount: 0,
      roundTotal: false,
      items: [stockLine],
    });
  });

  it("creates a sales quotation from a free-text service line", () => {
    expectValid(createSalesQuotationSchema, {
      customerId: id,
      validUntil: "2026-10-01",
      discountAmount: 0,
      roundTotal: false,
      items: [
        { itemName: "Buffet 60 couverts", quantity: 60, rate: 7500, taxRate: 18 },
      ],
    });
  });

  it("creates a sales order mixing a stock line and a service line", () => {
    expectValid(createSalesOrderSchema, {
      customerId: id,
      deliveryDate: "2026-09-30",
      poNumber: "BC-4471",
      discountAmount: 25000,
      roundTotal: false,
      items: [
        { stockItemId: id, itemName: "Beer", quantity: 48, rate: 900, taxRate: 18 },
        { itemName: "Service traiteur", quantity: 1, rate: 150000, taxRate: 18 },
      ],
    });
  });

  it("creates a sales invoice with no due date, leaving it to the terms", () => {
    expectValid(createSalesInvoiceSchema, {
      customerId: id,
      discountAmount: 0,
      roundTotal: false,
      items: [{ itemName: "Séminaire 3 jours", quantity: 3, rate: 260000, taxRate: 18 }],
    });
  });

  it("rejects a document with no party chosen", () => {
    const result = createPurchaseOrderSchema.safeParse({
      discountAmount: 0,
      roundTotal: false,
      items: [stockLine],
    });
    expect(result.success).toBe(false);
  });
});

describe("specialised form payloads", () => {
  it("creates a balanced journal", () => {
    expectValid(createJournalSchema, {
      postingDate: "2026-09-14",
      narration: "Loyer septembre",
      lines: [
        { accountId: id, debit: 150000, credit: 0 },
        { accountId: id2, debit: 0, credit: 150000 },
      ],
    });
  });

  it("refuses an unbalanced journal", () => {
    const result = createJournalSchema.safeParse({
      lines: [
        { accountId: id, debit: 150000, credit: 0 },
        { accountId: id2, debit: 0, credit: 100000 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("creates a warehouse transfer", () => {
    expectValid(createStockEntrySchema, {
      purpose: "MATERIAL_TRANSFER",
      reason: "Réapprovisionner le bar",
      items: [
        { stockItemId: id, fromWarehouseId: id, toWarehouseId: id2, quantity: 60, valuationRate: 450 },
      ],
    });
  });

  it("refuses a transfer into the warehouse it came from", () => {
    const result = createStockEntrySchema.safeParse({
      purpose: "MATERIAL_TRANSFER",
      items: [
        { stockItemId: id, fromWarehouseId: id, toWarehouseId: id, quantity: 1, valuationRate: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("creates a receipt, which needs no source warehouse", () => {
    expectValid(createStockEntrySchema, {
      purpose: "MATERIAL_RECEIPT",
      items: [{ stockItemId: id, toWarehouseId: id2, quantity: 5, valuationRate: 1200 }],
    });
  });

  it("pays a supplier and settles one bill", () => {
    expectValid(createSupplierPaymentSchema, {
      supplierId: id,
      amount: 495600,
      mode: "MOBILE_MONEY",
      referenceNo: "MM-88213",
      allocations: [{ purchaseInvoiceId: id2, amount: 495600 }],
    });
  });

  it("receives a customer payment kept on account", () => {
    expectValid(createCustomerPaymentSchema, {
      customerId: id,
      amount: 100000,
      mode: "CASH",
      allocations: [],
    });
  });

  it("refuses allocating more than was paid", () => {
    const result = createCustomerPaymentSchema.safeParse({
      customerId: id,
      amount: 100000,
      mode: "CASH",
      allocations: [{ salesInvoiceId: id2, amount: 150000 }],
    });
    expect(result.success).toBe(false);
  });
});
