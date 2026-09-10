"use server";

import { withManagerValidation } from "@/actions/helpers";
import {
  createPurchaseOrderSchema,
  createPurchaseInvoiceSchema,
  createSupplierPaymentSchema,
  createPurchaseReceiptSchema,
  createSupplierGroupSchema,
  createSupplierSchema,
  deleteSupplierGroupSchema,
  deleteSupplierSchema,
  holdPurchaseOrderSchema,
  purchaseOrderIdSchema,
  purchaseInvoiceIdSchema,
  supplierPaymentIdSchema,
  purchaseReceiptIdSchema,
  setSupplierHoldSchema,
  updatePurchaseOrderSchema,
  updateSupplierGroupSchema,
  updateSupplierSchema,
} from "@/lib/validators/purchasing";
import {
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  holdPurchaseOrder,
  reopenPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "@/services/purchase-order.service";
import {
  cancelPurchaseInvoice,
  createPurchaseInvoice,
  deletePurchaseInvoice,
  submitPurchaseInvoice,
} from "@/services/purchase-invoice.service";
import {
  cancelPurchaseReceipt,
  createPurchaseReceipt,
  deletePurchaseReceipt,
  submitPurchaseReceipt,
} from "@/services/purchase-receipt.service";
import {
  createSupplierPayment,
  removeSupplierPayment,
} from "@/services/supplier-payment.service";
import {
  createSupplier,
  createSupplierGroup,
  deleteSupplier,
  deleteSupplierGroup,
  setSupplierHold,
  updateSupplier,
  updateSupplierGroup,
} from "@/services/supplier.service";

// Supplier master data
export const createSupplierAction = withManagerValidation(createSupplierSchema, (data, ctx) => createSupplier(ctx, data));
export const updateSupplierAction = withManagerValidation(updateSupplierSchema, (data, ctx) => updateSupplier(ctx, data));
export const deleteSupplierAction = withManagerValidation(deleteSupplierSchema, (data, ctx) => deleteSupplier(ctx, data));
export const setSupplierHoldAction = withManagerValidation(setSupplierHoldSchema, (data, ctx) => setSupplierHold(ctx, data));
export const createSupplierGroupAction = withManagerValidation(createSupplierGroupSchema, (data, ctx) => createSupplierGroup(ctx, data));
export const updateSupplierGroupAction = withManagerValidation(updateSupplierGroupSchema, (data, ctx) => updateSupplierGroup(ctx, data));
export const deleteSupplierGroupAction = withManagerValidation(deleteSupplierGroupSchema, (data, ctx) => deleteSupplierGroup(ctx, data));

// Purchase-order lifecycle
export const createPurchaseOrderAction = withManagerValidation(createPurchaseOrderSchema, (data, ctx) => createPurchaseOrder(ctx, data));
export const updatePurchaseOrderAction = withManagerValidation(updatePurchaseOrderSchema, (data, ctx) => updatePurchaseOrder(ctx, data));
export const submitPurchaseOrderAction = withManagerValidation(purchaseOrderIdSchema, (data, ctx) => submitPurchaseOrder(ctx, data));
export const holdPurchaseOrderAction = withManagerValidation(holdPurchaseOrderSchema, (data, ctx) => holdPurchaseOrder(ctx, data));
export const closePurchaseOrderAction = withManagerValidation(purchaseOrderIdSchema, (data, ctx) => closePurchaseOrder(ctx, data));
export const reopenPurchaseOrderAction = withManagerValidation(purchaseOrderIdSchema, (data, ctx) => reopenPurchaseOrder(ctx, data));
export const cancelPurchaseOrderAction = withManagerValidation(purchaseOrderIdSchema, (data, ctx) => cancelPurchaseOrder(ctx, data));
export const deletePurchaseOrderAction = withManagerValidation(purchaseOrderIdSchema, (data, ctx) => deletePurchaseOrder(ctx, data));

// Goods receipts — submission updates the existing stock ledger atomically.
export const createPurchaseReceiptAction = withManagerValidation(createPurchaseReceiptSchema, (data, ctx) => createPurchaseReceipt(ctx, data));
export const submitPurchaseReceiptAction = withManagerValidation(purchaseReceiptIdSchema, (data, ctx) => submitPurchaseReceipt(ctx, data));
export const cancelPurchaseReceiptAction = withManagerValidation(purchaseReceiptIdSchema, (data, ctx) => cancelPurchaseReceipt(ctx, data));
export const deletePurchaseReceiptAction = withManagerValidation(purchaseReceiptIdSchema, (data, ctx) => deletePurchaseReceipt(ctx, data));

// Supplier bills — can optionally receive stock only when no receipt exists.
export const createPurchaseInvoiceAction = withManagerValidation(createPurchaseInvoiceSchema, (data, ctx) => createPurchaseInvoice(ctx, data));
export const submitPurchaseInvoiceAction = withManagerValidation(purchaseInvoiceIdSchema, (data, ctx) => submitPurchaseInvoice(ctx, data));
export const cancelPurchaseInvoiceAction = withManagerValidation(purchaseInvoiceIdSchema, (data, ctx) => cancelPurchaseInvoice(ctx, data));
export const deletePurchaseInvoiceAction = withManagerValidation(purchaseInvoiceIdSchema, (data, ctx) => deletePurchaseInvoice(ctx, data));

// Payments are allocated only to open bills of the selected supplier.
export const createSupplierPaymentAction = withManagerValidation(createSupplierPaymentSchema, (data, ctx) => createSupplierPayment(ctx, data));
export const removeSupplierPaymentAction = withManagerValidation(supplierPaymentIdSchema, (data, ctx) => removeSupplierPayment(ctx, data));
