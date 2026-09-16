import type { PurchaseCategory } from "@/lib/purchase-categories";

export type PurchasingMode = "DIRECT" | "FULL";

export interface DirectPurchaseListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly ticketNumber: string | null;
  readonly supplierName: string;
  readonly purchasedAt: string;
  readonly totalTTC: number;
  readonly totalHT: number;
  readonly outstandingAmount: number;
  readonly paymentMode: string | null;
  readonly categories: readonly { readonly category: PurchaseCategory; readonly amountHT: number }[];
  readonly documentCount: number;
  readonly ingredientLineCount: number;
}

export interface ExpenseLineDTO {
  readonly id: string;
  readonly category: PurchaseCategory;
  readonly label: string | null;
  readonly amountHT: number;
  readonly vatRate: number;
  readonly vatAmount: number;
}

export interface InvoiceBreakdownDTO {
  readonly lines: readonly ExpenseLineDTO[];
  readonly ingredientLines: readonly {
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
    readonly purchaseUnit: string | null;
    readonly amount: number;
  }[];
}

export type SpendingBucket = PurchaseCategory | "NON_VENTILE";

export interface SpendingBreakdownDTO {
  readonly from: string;
  readonly to: string;
  readonly totalHT: number;
  readonly rows: readonly { readonly bucket: SpendingBucket; readonly amountHT: number; readonly share: number }[];
  /** Share of food and drinks in what was spent, 0–1. */
  readonly foodShare: number;
  readonly unsplitInvoiceCount: number;
}
