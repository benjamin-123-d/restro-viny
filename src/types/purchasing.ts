import type { StockUnit } from "@/types/inventory";

export type SupplierHoldType = "ALL" | "INVOICES" | "PAYMENTS";

export type RfqStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

export type SupplierQuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_ORDERED"
  | "ORDERED"
  | "STOPPED"
  | "EXPIRED"
  | "CANCELLED";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "ON_HOLD"
  | "TO_RECEIVE_AND_BILL"
  | "TO_RECEIVE"
  | "TO_BILL"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export type PurchaseReceiptStatus =
  | "DRAFT"
  | "TO_BILL"
  | "PARTLY_BILLED"
  | "COMPLETED"
  | "RETURN"
  | "CLOSED"
  | "CANCELLED";

export type PurchaseInvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "RETURN"
  | "DEBIT_NOTE_ISSUED"
  | "CANCELLED";

export type SupplierPaymentMode =
  | "CASH"
  | "UPI"
  | "CARD"
  | "OTHER"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "MOBILE_MONEY"
  | "MEAL_VOUCHER";

export type ScorecardStanding =
  | "EXCELLENT"
  | "VERY_GOOD"
  | "GOOD"
  | "AVERAGE"
  | "POOR";

// ------------------------------------------------------------- supplier ---

export interface SupplierGroupDTO {
  readonly id: string;
  readonly name: string;
  readonly defaultPaymentTermsDays: number | null;
  readonly notes: string | null;
  readonly supplierCount: number;
}

export interface SupplierDTO {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly supplierGroupId: string | null;
  readonly supplierGroupName: string | null;
  readonly taxId: string | null;
  readonly contactPerson: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly currency: string | null;
  readonly paymentTermsDays: number | null;
  readonly onHold: boolean;
  readonly holdType: SupplierHoldType | null;
  readonly releaseDate: string | null;
  readonly preventRfq: boolean;
  readonly preventPo: boolean;
  readonly disabled: boolean;
  readonly notes: string | null;
  /** True while a hold is in force — i.e. on hold and not yet released. */
  readonly isBlocked: boolean;
}

/** Supplier plus the money view an owner actually asks for. */
export interface SupplierSummaryDTO extends SupplierDTO {
  readonly openOrderCount: number;
  readonly outstandingAmount: number;
  readonly overdueAmount: number;
  readonly totalPurchased: number;
  readonly lastOrderDate: string | null;
}

// -------------------------------------------------------- document lines ---

/** One priced line, shared by every purchasing document's read model. */
export interface PurchaseLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly description: string | null;
  readonly quantity: number;
  readonly rate: number;
  readonly discountPercent: number | null;
  readonly taxRate: number;
  readonly amount: number;
}

export interface PurchaseDocumentTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxTotal: number;
  readonly roundOff: number;
  readonly grandTotal: number;
}

// ------------------------------------------------------------------ rfq ---

export interface RfqLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly description: string | null;
  readonly quantity: number;
  readonly requiredBy: string | null;
}

export interface RfqSupplierDTO {
  readonly id: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly emailSentAt: string | null;
  readonly respondedAt: string | null;
  readonly quotationId: string | null;
}

export interface RfqDTO {
  readonly id: string;
  readonly number: string;
  readonly status: RfqStatus;
  readonly transactionDate: string;
  readonly requiredBy: string | null;
  readonly message: string | null;
  readonly termsText: string | null;
  readonly items: readonly RfqLineDTO[];
  readonly suppliers: readonly RfqSupplierDTO[];
  readonly quotationCount: number;
}

export interface RfqListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: RfqStatus;
  readonly transactionDate: string;
  readonly requiredBy: string | null;
  readonly itemCount: number;
  readonly supplierCount: number;
  readonly quotationCount: number;
}

/** One supplier's price for one RFQ line, for the comparison grid. */
export interface QuoteComparisonCellDTO {
  readonly quotationId: string;
  readonly quotationItemId: string;
  readonly rate: number;
  readonly amount: number;
  readonly leadTimeDays: number | null;
  readonly isBest: boolean;
}

export interface QuoteComparisonRowDTO {
  readonly rfqItemId: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly quantity: number;
  /** Keyed by supplier id; absent when that supplier did not quote the line. */
  readonly cells: Readonly<Record<string, QuoteComparisonCellDTO>>;
}

export interface QuoteComparisonDTO {
  readonly rfqId: string;
  readonly rfqNumber: string;
  readonly suppliers: readonly {
    readonly supplierId: string;
    readonly supplierName: string;
    readonly quotationId: string;
    readonly grandTotal: number;
    readonly validUntil: string | null;
  }[];
  readonly rows: readonly QuoteComparisonRowDTO[];
}

// ------------------------------------------------------- supplier quote ---

export interface SupplierQuotationDTO extends PurchaseDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly status: SupplierQuotationStatus;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly rfqId: string | null;
  readonly rfqNumber: string | null;
  readonly transactionDate: string;
  readonly validUntil: string | null;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly items: readonly PurchaseLineDTO[];
  readonly isExpired: boolean;
  readonly supplierReference: string | null;
  readonly summaryOnly: boolean;
  readonly documents: readonly PurchaseDocumentDTO[];
}

export interface SupplierQuotationListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: SupplierQuotationStatus;
  readonly supplierName: string;
  readonly transactionDate: string;
  readonly validUntil: string | null;
  readonly grandTotal: number;
  readonly isExpired: boolean;
  readonly summaryOnly: boolean;
  readonly documentCount: number;
}

// ------------------------------------------------------- purchase order ---

export interface PurchaseOrderLineDTO extends PurchaseLineDTO {
  readonly scheduleDate: string | null;
  readonly receivedQty: number;
  readonly billedQty: number;
  readonly pendingQty: number;
}

export interface PurchaseOrderDTO extends PurchaseDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly status: PurchaseOrderStatus;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly supplierQuotationId: string | null;
  readonly transactionDate: string;
  readonly scheduleDate: string | null;
  readonly receivedPercent: number;
  readonly billedPercent: number;
  readonly advancePaid: number;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly holdComment: string | null;
  readonly items: readonly PurchaseOrderLineDTO[];
  readonly isEditable: boolean;
}

export interface PurchaseOrderListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: PurchaseOrderStatus;
  readonly supplierName: string;
  readonly transactionDate: string;
  readonly scheduleDate: string | null;
  readonly grandTotal: number;
  readonly receivedPercent: number;
  readonly billedPercent: number;
  readonly isLate: boolean;
}

// ----------------------------------------------------- purchase receipt ---

export interface PurchaseReceiptLineDTO extends PurchaseLineDTO {
  readonly rejectedQuantity: number;
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly purchaseOrderItemId: string | null;
  readonly billedQty: number;
}

export interface PurchaseReceiptDTO {
  readonly id: string;
  readonly number: string;
  readonly status: PurchaseReceiptStatus;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly purchaseOrderId: string | null;
  readonly purchaseOrderNumber: string | null;
  readonly postingDate: string;
  readonly supplierDeliveryNote: string | null;
  readonly subtotal: number;
  readonly taxTotal: number;
  readonly grandTotal: number;
  readonly billedPercent: number;
  readonly isReturn: boolean;
  readonly notes: string | null;
  readonly items: readonly PurchaseReceiptLineDTO[];
  readonly isEditable: boolean;
}

export interface PurchaseReceiptListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: PurchaseReceiptStatus;
  readonly supplierName: string;
  readonly postingDate: string;
  readonly grandTotal: number;
  readonly billedPercent: number;
  readonly isReturn: boolean;
}

// ----------------------------------------------------- purchase invoice ---

export interface PurchaseInvoiceLineDTO extends PurchaseLineDTO {
  readonly purchaseOrderItemId: string | null;
  readonly purchaseReceiptItemId: string | null;
}

export interface PurchasePaymentScheduleDTO {
  readonly id: string;
  readonly dueDate: string;
  readonly invoicePortion: number;
  readonly amount: number;
  readonly paidAmount: number;
}

export interface PurchaseInvoiceDTO extends PurchaseDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly supplierInvoiceNo: string | null;
  readonly status: PurchaseInvoiceStatus;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly purchaseOrderId: string | null;
  readonly purchaseOrderNumber: string | null;
  readonly purchaseReceiptId: string | null;
  readonly purchaseReceiptNumber: string | null;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly paidAmount: number;
  readonly outstandingAmount: number;
  readonly updateStock: boolean;
  readonly isReturn: boolean;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly items: readonly PurchaseInvoiceLineDTO[];
  readonly schedule: readonly PurchasePaymentScheduleDTO[];
  readonly payments: readonly SupplierPaymentAllocationDTO[];
  readonly isEditable: boolean;
  readonly daysOverdue: number;
  readonly summaryOnly: boolean;
  readonly documents: readonly PurchaseDocumentDTO[];
}

export interface PurchaseInvoiceListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly supplierInvoiceNo: string | null;
  readonly status: PurchaseInvoiceStatus;
  readonly supplierName: string;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly grandTotal: number;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
  readonly summaryOnly: boolean;
  readonly documentCount: number;
}

// ----------------------------------------------------- supplier payment ---

export interface SupplierPaymentAllocationDTO {
  readonly id: string;
  readonly supplierPaymentId: string;
  readonly paymentNumber: string;
  readonly purchaseInvoiceId: string;
  readonly invoiceNumber: string;
  readonly amount: number;
  readonly paymentDate: string;
  readonly mode: SupplierPaymentMode;
}

export interface SupplierPaymentDTO {
  readonly id: string;
  readonly number: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly paymentDate: string;
  readonly mode: SupplierPaymentMode;
  readonly amount: number;
  readonly unallocatedAmount: number;
  readonly referenceNo: string | null;
  readonly referenceDate: string | null;
  readonly notes: string | null;
  readonly allocations: readonly SupplierPaymentAllocationDTO[];
}

/** An unpaid bill offered up when allocating a payment. */
export interface PayableInvoiceDTO {
  readonly id: string;
  readonly number: string;
  readonly supplierInvoiceNo: string | null;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly grandTotal: number;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
}

// --------------------------------------------------------- scorecard ---

export interface SupplierScorecardDTO {
  readonly id: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly onTimeDeliveryPercent: number;
  readonly qualityAcceptedPercent: number;
  readonly priceVariancePercent: number;
  readonly totalOrders: number;
  readonly totalReceipts: number;
  readonly totalPurchaseAmount: number;
  readonly score: number;
  readonly standing: ScorecardStanding;
  readonly generatedAt: string;
}

// ------------------------------------------------------------ overview ---

/** Headline numbers for the purchasing dashboard. */
export interface PurchasingOverviewDTO {
  readonly draftOrders: number;
  readonly awaitingReceipt: number;
  readonly awaitingBill: number;
  readonly openRfqs: number;
  readonly outstandingPayable: number;
  readonly overduePayable: number;
  readonly overdueInvoiceCount: number;
  readonly purchasedThisMonth: number;
  readonly topSuppliers: readonly {
    readonly supplierId: string;
    readonly supplierName: string;
    readonly amount: number;
  }[];
}

// ------------------------------------------- supplier documents and email ---

export type PurchaseDocumentKind = "QUOTATION" | "INVOICE";
export type PurchaseDocumentSource = "FILE" | "PHOTO" | "EMAIL";

/** A supplier's document as imported; the file itself is served separately. */
export interface PurchaseDocumentDTO {
  readonly id: string;
  readonly kind: PurchaseDocumentKind;
  readonly source: PurchaseDocumentSource;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly isImage: boolean;
  readonly url: string;
}

export type SupplierMessageStatus = "SENT" | "FAILED" | "MAILTO";

export interface SupplierMessageDTO {
  readonly id: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly toEmail: string;
  readonly subject: string;
  readonly status: SupplierMessageStatus;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface QuoteRequestResultDTO {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly toEmail: string | null;
  /** NO_EMAIL: the supplier has no address on file, nothing was sent. */
  readonly status: SupplierMessageStatus | "NO_EMAIL";
  readonly error: string | null;
  /** Opens the same message in the user's own mail app. */
  readonly mailto: string | null;
}
