/** How each payment mode is named on screens and receipts. */
export const PAYMENT_MODE_LABEL: Readonly<Record<string, string>> = {
  CASH: "Espèces",
  CARD: "Carte bancaire",
  MEAL_VOUCHER: "Titre-restaurant",
  UPI: "Virement instantané",
  OTHER: "Autre",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
};

export const paymentModeLabel = (mode: string): string => PAYMENT_MODE_LABEL[mode] ?? mode;
