export type QuotationStatus =
  | "DRAFT"
  | "OPEN"
  | "REPLIED"
  | "PARTIALLY_ORDERED"
  | "ORDERED"
  | "LOST"
  | "EXPIRED"
  | "CANCELLED";

export type SalesOrderStatus =
  | "DRAFT"
  | "ON_HOLD"
  | "TO_DELIVER_AND_BILL"
  | "TO_DELIVER"
  | "TO_BILL"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export type DeliveryNoteStatus =
  | "DRAFT"
  | "TO_BILL"
  | "PARTLY_BILLED"
  | "COMPLETED"
  | "RETURN"
  | "CLOSED"
  | "CANCELLED";

export type SalesInvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "RETURN"
  | "CREDIT_NOTE_ISSUED"
  | "CANCELLED";

// ------------------------------------------------------------- customers ---

export interface CustomerGroupDTO {
  readonly id: string;
  readonly name: string;
  readonly defaultPaymentTermsDays: number | null;
  readonly defaultDiscountPercent: number | null;
  readonly notes: string | null;
  readonly customerCount: number;
}

export interface TerritoryDTO {
  readonly id: string;
  readonly name: string;
  readonly notes: string | null;
  readonly customerCount: number;
}

export interface CustomerDTO {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly customerGroupId: string | null;
  readonly customerGroupName: string | null;
  readonly territoryId: string | null;
  readonly territoryName: string | null;
  readonly taxId: string | null;
  readonly contactPerson: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly currency: string | null;
  readonly paymentTermsDays: number | null;
  readonly creditLimit: number | null;
  readonly blockOnCreditLimit: boolean;
  readonly loyaltyPoints: number;
  readonly disabled: boolean;
  readonly notes: string | null;
}

/** Customer plus the receivables view an owner asks for. */
export interface CustomerSummaryDTO extends CustomerDTO {
  readonly openOrderCount: number;
  readonly outstandingAmount: number;
  readonly overdueAmount: number;
  readonly totalSold: number;
  readonly lastOrderDate: string | null;
  /** Outstanding has passed the credit limit. */
  readonly overCreditLimit: boolean;
  readonly creditAvailable: number | null;
}

// --------------------------------------------------------------- lines ---

export interface SalesLineDTO {
  readonly id: string;
  readonly menuItemId: string | null;
  readonly stockItemId: string | null;
  readonly itemName: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly rate: number;
  readonly discountPercent: number | null;
  readonly taxRate: number;
  readonly amount: number;
}

export interface SalesDocumentTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxTotal: number;
  readonly roundOff: number;
  readonly grandTotal: number;
}

// ----------------------------------------------------------- quotation ---

export interface SalesQuotationDTO extends SalesDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly status: QuotationStatus;
  readonly customerId: string;
  readonly customerName: string;
  readonly transactionDate: string;
  readonly validUntil: string | null;
  readonly lostReason: string | null;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly items: readonly SalesLineDTO[];
  readonly isExpired: boolean;
  readonly isEditable: boolean;
}

export interface SalesQuotationListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: QuotationStatus;
  readonly customerName: string;
  readonly transactionDate: string;
  readonly validUntil: string | null;
  readonly grandTotal: number;
  readonly isExpired: boolean;
}

// --------------------------------------------------------- sales order ---

export interface SalesOrderLineDTO extends SalesLineDTO {
  readonly deliveryDate: string | null;
  readonly deliveredQty: number;
  readonly billedQty: number;
  readonly pendingQty: number;
}

export interface SalesOrderDTO extends SalesDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly status: SalesOrderStatus;
  readonly customerId: string;
  readonly customerName: string;
  readonly quotationId: string | null;
  readonly transactionDate: string;
  readonly deliveryDate: string | null;
  readonly deliveredPercent: number;
  readonly billedPercent: number;
  readonly advanceReceived: number;
  readonly poNumber: string | null;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly holdComment: string | null;
  readonly items: readonly SalesOrderLineDTO[];
  readonly isEditable: boolean;
}

export interface SalesOrderListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: SalesOrderStatus;
  readonly customerName: string;
  readonly transactionDate: string;
  readonly deliveryDate: string | null;
  readonly grandTotal: number;
  readonly deliveredPercent: number;
  readonly billedPercent: number;
  readonly isLate: boolean;
}

// ------------------------------------------------------- delivery note ---

export interface DeliveryNoteLineDTO extends SalesLineDTO {
  readonly salesOrderItemId: string | null;
  readonly batchNo: string | null;
  readonly billedQty: number;
}

export interface DeliveryNoteDTO {
  readonly id: string;
  readonly number: string;
  readonly status: DeliveryNoteStatus;
  readonly customerId: string;
  readonly customerName: string;
  readonly salesOrderId: string | null;
  readonly salesOrderNumber: string | null;
  readonly warehouseId: string | null;
  readonly warehouseName: string | null;
  readonly postingDate: string;
  readonly subtotal: number;
  readonly taxTotal: number;
  readonly grandTotal: number;
  readonly billedPercent: number;
  readonly isReturn: boolean;
  readonly driverName: string | null;
  readonly vehicleNo: string | null;
  readonly notes: string | null;
  readonly items: readonly DeliveryNoteLineDTO[];
  readonly isEditable: boolean;
}

export interface DeliveryNoteListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: DeliveryNoteStatus;
  readonly customerName: string;
  readonly postingDate: string;
  readonly grandTotal: number;
  readonly billedPercent: number;
  readonly isReturn: boolean;
}

// ------------------------------------------------------- sales invoice ---

export interface SalesInvoiceDTO extends SalesDocumentTotals {
  readonly id: string;
  readonly number: string;
  readonly status: SalesInvoiceStatus;
  readonly customerId: string;
  readonly customerName: string;
  readonly salesOrderId: string | null;
  readonly salesOrderNumber: string | null;
  readonly deliveryNoteId: string | null;
  readonly deliveryNoteNumber: string | null;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly paidAmount: number;
  readonly outstandingAmount: number;
  readonly updateStock: boolean;
  readonly isReturn: boolean;
  readonly notes: string | null;
  readonly termsText: string | null;
  readonly items: readonly SalesLineDTO[];
  readonly schedule: readonly SalesPaymentScheduleDTO[];
  readonly isEditable: boolean;
  readonly daysOverdue: number;
}

export interface SalesPaymentScheduleDTO {
  readonly id: string;
  readonly dueDate: string;
  readonly invoicePortion: number;
  readonly amount: number;
  readonly paidAmount: number;
}

export interface SalesInvoiceListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: SalesInvoiceStatus;
  readonly customerName: string;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly grandTotal: number;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
}

// ---------------------------------------------------- customer payment ---

export interface CustomerPaymentAllocationDTO {
  readonly id: string;
  readonly salesInvoiceId: string;
  readonly invoiceNumber: string;
  readonly amount: number;
}

export interface CustomerPaymentDTO {
  readonly id: string;
  readonly number: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly paymentDate: string;
  readonly mode: string;
  readonly amount: number;
  readonly unallocatedAmount: number;
  readonly referenceNo: string | null;
  readonly referenceDate: string | null;
  readonly notes: string | null;
  readonly allocations: readonly CustomerPaymentAllocationDTO[];
}

/** An unpaid bill offered up when allocating a receipt. */
export interface ReceivableInvoiceDTO {
  readonly id: string;
  readonly number: string;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly grandTotal: number;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
}
