import type { StockUnit } from "@/types/inventory";

export type MaterialRequestType =
  | "PURCHASE"
  | "MATERIAL_TRANSFER"
  | "MATERIAL_ISSUE"
  | "MANUFACTURE";

export type MaterialRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING"
  | "PARTIALLY_ORDERED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "ISSUED"
  | "TRANSFERRED"
  | "STOPPED"
  | "CANCELLED";

export type StockEntryPurpose =
  | "MATERIAL_RECEIPT"
  | "MATERIAL_ISSUE"
  | "MATERIAL_TRANSFER"
  | "REPACK"
  | "MANUFACTURE";

export type StockDocStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

// ------------------------------------------------------------ warehouse ---

export interface WarehouseDTO {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly isGroup: boolean;
  readonly isDefault: boolean;
  readonly addressLine1: string | null;
  readonly city: string | null;
  readonly disabled: boolean;
  readonly notes: string | null;
  /** Distinct items with stock here. */
  readonly itemCount: number;
  readonly stockValue: number;
}

/** One item's position in one warehouse (ERPNext Bin). */
export interface BinDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly warehouseId: string;
  readonly warehouseName: string;
  readonly actualQty: number;
  readonly reservedQty: number;
  readonly orderedQty: number;
  readonly indentedQty: number;
  readonly projectedQty: number;
  readonly valuationRate: number;
  readonly stockValue: number;
}

export interface BatchDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly warehouseId: string | null;
  readonly warehouseName: string | null;
  readonly batchNo: string;
  readonly expiryDate: string | null;
  readonly manufactureDate: string | null;
  readonly quantity: number;
  readonly notes: string | null;
  /** Days until expiry; negative once past. Null when no expiry is tracked. */
  readonly daysToExpiry: number | null;
  readonly isExpired: boolean;
}

// ----------------------------------------------------- material request ---

export interface MaterialRequestLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly warehouseId: string | null;
  readonly warehouseName: string | null;
  readonly description: string | null;
  readonly quantity: number;
  readonly orderedQty: number;
  readonly receivedQty: number;
  readonly pendingQty: number;
  readonly requiredBy: string | null;
}

export interface MaterialRequestDTO {
  readonly id: string;
  readonly number: string;
  readonly type: MaterialRequestType;
  readonly status: MaterialRequestStatus;
  readonly transactionDate: string;
  readonly requiredBy: string | null;
  readonly notes: string | null;
  readonly items: readonly MaterialRequestLineDTO[];
  readonly isEditable: boolean;
}

export interface MaterialRequestListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly type: MaterialRequestType;
  readonly status: MaterialRequestStatus;
  readonly transactionDate: string;
  readonly requiredBy: string | null;
  readonly itemCount: number;
  readonly isLate: boolean;
}

// --------------------------------------------------------- stock entry ---

export interface StockEntryLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly fromWarehouseId: string | null;
  readonly fromWarehouseName: string | null;
  readonly toWarehouseId: string | null;
  readonly toWarehouseName: string | null;
  readonly quantity: number;
  readonly valuationRate: number;
  readonly amount: number;
  readonly batchNo: string | null;
}

export interface StockEntryDTO {
  readonly id: string;
  readonly number: string;
  readonly purpose: StockEntryPurpose;
  readonly status: StockDocStatus;
  readonly postingDate: string;
  readonly totalValue: number;
  readonly reason: string | null;
  readonly notes: string | null;
  readonly items: readonly StockEntryLineDTO[];
  readonly isEditable: boolean;
}

export interface StockEntryListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly purpose: StockEntryPurpose;
  readonly status: StockDocStatus;
  readonly postingDate: string;
  readonly totalValue: number;
  readonly itemCount: number;
}

// ------------------------------------------------ stock reconciliation ---

export interface StockReconciliationLineDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly warehouseId: string | null;
  readonly warehouseName: string | null;
  readonly currentQty: number;
  readonly countedQty: number;
  readonly differenceQty: number;
  readonly valuationRate: number;
  readonly differenceValue: number;
}

export interface StockReconciliationDTO {
  readonly id: string;
  readonly number: string;
  readonly status: StockDocStatus;
  readonly postingDate: string;
  readonly differenceValue: number;
  readonly reason: string | null;
  readonly notes: string | null;
  readonly items: readonly StockReconciliationLineDTO[];
  readonly isEditable: boolean;
}

export interface StockReconciliationListItemDTO {
  readonly id: string;
  readonly number: string;
  readonly status: StockDocStatus;
  readonly postingDate: string;
  readonly differenceValue: number;
  readonly itemCount: number;
}

// ------------------------------------------------------------ reporting ---

/** Headline numbers for the stock dashboard. */
export interface StockOverviewDTO {
  readonly warehouseCount: number;
  readonly totalStockValue: number;
  readonly lowStockCount: number;
  readonly expiringBatchCount: number;
  readonly openRequestCount: number;
  readonly draftEntryCount: number;
}
