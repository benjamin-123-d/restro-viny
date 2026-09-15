import type { OrderType } from "@/types/order";

export interface ReceiptSellerDTO {
  readonly name: string;
  readonly legalName: string | null;
  /** "SARL au capital de 10 000 €", ready to print. */
  readonly legalIdentity: string | null;
  readonly addressLines: readonly string[];
  readonly phone: string | null;
  readonly email: string | null;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  readonly nafCode: string | null;
  readonly rcs: string | null;
  readonly drinksLicense: string | null;
}

export interface ReceiptLineDTO {
  readonly name: string;
  readonly details: readonly string[];
  readonly quantity: number;
  readonly unitTTC: number;
  readonly totalTTC: number;
  readonly vatRate: number;
  /** Letter printed next to the line, keyed to the VAT table: A, B, C… */
  readonly vatCode: string;
  readonly offered: boolean;
}

export interface ReceiptVatRowDTO {
  readonly code: string;
  readonly rate: number;
  readonly baseHT: number;
  readonly vat: number;
  readonly totalTTC: number;
}

export interface ReceiptPaymentDTO {
  readonly label: string;
  readonly amount: number;
}

export interface ReceiptDTO {
  readonly orderId: string;
  /** "F-00012", or the ticket number for orders settled before invoicing. */
  readonly number: string;
  readonly orderNumber: number;
  readonly issuedAt: string;
  readonly service: OrderType;
  readonly serviceLabel: string;
  readonly tableLabel: string | null;
  readonly customerName: string | null;
  readonly customerAddress: string | null;
  /** Null on the original; the number of this copy on a duplicate. */
  readonly duplicateNumber: number | null;
  readonly seller: ReceiptSellerDTO;
  readonly lines: readonly ReceiptLineDTO[];
  readonly itemCount: number;
  readonly subtotalTTC: number;
  readonly discountTTC: number;
  readonly discountReason: string | null;
  readonly roundingTTC: number;
  readonly totalHT: number;
  readonly totalVAT: number;
  readonly totalTTC: number;
  readonly vat: readonly ReceiptVatRowDTO[];
  readonly payments: readonly ReceiptPaymentDTO[];
  readonly changeGiven: number;
  readonly notices: readonly string[];
  readonly footer: string | null;
}
