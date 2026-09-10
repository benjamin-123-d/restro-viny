"use server";

/**
 * Selling: customers and the ERPNext sales chain — Quotation → Sales Order →
 * Delivery Note → Sales Invoice → Customer Payment.
 */

import { withManagerValidation } from "@/actions/helpers";
import {
  createCustomerGroupSchema,
  createCustomerPaymentSchema,
  createCustomerSchema,
  createDeliveryNoteSchema,
  createSalesInvoiceSchema,
  createSalesOrderSchema,
  createSalesQuotationSchema,
  createTerritorySchema,
  entityIdSchema,
  holdSalesOrderSchema,
  markQuotationLostSchema,
  orderFromQuotationSchema,
  updateCustomerGroupSchema,
  updateCustomerSchema,
  updateSalesOrderSchema,
  updateSalesQuotationSchema,
  updateTerritorySchema,
} from "@/lib/validators/selling";
import {
  createCustomer,
  createCustomerGroup,
  createTerritory,
  deleteCustomer,
  deleteCustomerGroup,
  deleteTerritory,
  updateCustomer,
  updateCustomerGroup,
  updateTerritory,
} from "@/services/customer.service";
import {
  cancelDeliveryNote,
  cancelSalesInvoice,
  cancelSalesOrder,
  cancelSalesQuotation,
  closeSalesOrder,
  createCustomerPayment,
  createDeliveryNote,
  createSalesInvoice,
  createSalesOrder,
  createSalesQuotation,
  deleteDeliveryNote,
  deleteSalesInvoice,
  deleteSalesOrder,
  deleteSalesQuotation,
  holdSalesOrder,
  markQuotationLost,
  orderFromQuotation,
  removeCustomerPayment,
  submitDeliveryNote,
  submitSalesInvoice,
  submitSalesOrder,
  submitSalesQuotation,
  updateSalesOrder,
  updateSalesQuotation,
} from "@/services/sales.document.service";

// Customers, groups and territories.
export const createCustomerAction = withManagerValidation(
  createCustomerSchema,
  (data, ctx) => createCustomer(ctx, data),
);
export const updateCustomerAction = withManagerValidation(
  updateCustomerSchema,
  (data, ctx) => updateCustomer(ctx, data),
);
export const deleteCustomerAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteCustomer(ctx, data),
);
export const createCustomerGroupAction = withManagerValidation(
  createCustomerGroupSchema,
  (data, ctx) => createCustomerGroup(ctx, data),
);
export const updateCustomerGroupAction = withManagerValidation(
  updateCustomerGroupSchema,
  (data, ctx) => updateCustomerGroup(ctx, data),
);
export const deleteCustomerGroupAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteCustomerGroup(ctx, data),
);
export const createTerritoryAction = withManagerValidation(
  createTerritorySchema,
  (data, ctx) => createTerritory(ctx, data),
);
export const updateTerritoryAction = withManagerValidation(
  updateTerritorySchema,
  (data, ctx) => updateTerritory(ctx, data),
);
export const deleteTerritoryAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteTerritory(ctx, data),
);

// Quotations.
export const createSalesQuotationAction = withManagerValidation(
  createSalesQuotationSchema,
  (data, ctx) => createSalesQuotation(ctx, data),
);
export const updateSalesQuotationAction = withManagerValidation(
  updateSalesQuotationSchema,
  (data, ctx) => updateSalesQuotation(ctx, data),
);
export const submitSalesQuotationAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => submitSalesQuotation(ctx, data),
);
export const markQuotationLostAction = withManagerValidation(
  markQuotationLostSchema,
  (data, ctx) => markQuotationLost(ctx, data),
);
export const cancelSalesQuotationAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => cancelSalesQuotation(ctx, data),
);
export const deleteSalesQuotationAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteSalesQuotation(ctx, data),
);

// Sales orders — creation is gated on the customer's credit limit.
export const createSalesOrderAction = withManagerValidation(
  createSalesOrderSchema,
  (data, ctx) => createSalesOrder(ctx, data),
);
export const updateSalesOrderAction = withManagerValidation(
  updateSalesOrderSchema,
  (data, ctx) => updateSalesOrder(ctx, data),
);
export const submitSalesOrderAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => submitSalesOrder(ctx, data),
);
export const holdSalesOrderAction = withManagerValidation(
  holdSalesOrderSchema,
  (data, ctx) => holdSalesOrder(ctx, data),
);
export const closeSalesOrderAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => closeSalesOrder(ctx, data),
);
export const cancelSalesOrderAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => cancelSalesOrder(ctx, data),
);
export const deleteSalesOrderAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteSalesOrder(ctx, data),
);
export const orderFromQuotationAction = withManagerValidation(
  orderFromQuotationSchema,
  (data, ctx) => orderFromQuotation(ctx, data),
);

// Delivery notes — submission issues stock from the shipping warehouse.
export const createDeliveryNoteAction = withManagerValidation(
  createDeliveryNoteSchema,
  (data, ctx) => createDeliveryNote(ctx, data),
);
export const submitDeliveryNoteAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => submitDeliveryNote(ctx, data),
);
export const cancelDeliveryNoteAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => cancelDeliveryNote(ctx, data),
);
export const deleteDeliveryNoteAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteDeliveryNote(ctx, data),
);

// Sales invoices and receipts.
export const createSalesInvoiceAction = withManagerValidation(
  createSalesInvoiceSchema,
  (data, ctx) => createSalesInvoice(ctx, data),
);
export const submitSalesInvoiceAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => submitSalesInvoice(ctx, data),
);
export const cancelSalesInvoiceAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => cancelSalesInvoice(ctx, data),
);
export const deleteSalesInvoiceAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => deleteSalesInvoice(ctx, data),
);
export const createCustomerPaymentAction = withManagerValidation(
  createCustomerPaymentSchema,
  (data, ctx) => createCustomerPayment(ctx, data),
);
export const removeCustomerPaymentAction = withManagerValidation(
  entityIdSchema,
  (data, ctx) => removeCustomerPayment(ctx, data),
);
