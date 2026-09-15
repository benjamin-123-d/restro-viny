import type { ServiceType } from "@/lib/french-vat";

export const SERVICE_ORDER: readonly ServiceType[] = ["DINE_IN", "TAKEAWAY", "DELIVERY"];

export const SERVICE_NAME: Readonly<Record<ServiceType, string>> = {
  DINE_IN: "Sur place",
  TAKEAWAY: "À emporter",
  DELIVERY: "Livraison",
};

/** Tailwind classes bound to the validated palette tokens in globals.css. */
export const SERVICE_SWATCH: Readonly<Record<ServiceType, string>> = {
  DINE_IN: "bg-sales-dine-in",
  TAKEAWAY: "bg-sales-takeaway",
  DELIVERY: "bg-sales-delivery",
};

export const SERVICE_VAR: Readonly<Record<ServiceType, string>> = {
  DINE_IN: "var(--sales-dine-in)",
  TAKEAWAY: "var(--sales-takeaway)",
  DELIVERY: "var(--sales-delivery)",
};

export {
  PAYMENT_MODE_LABEL as PAYMENT_NAME,
  paymentModeLabel as paymentName,
} from "@/lib/payment-labels";

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const WEEKDAY_LONG = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export const formatPercent = (n: number, digits = 1): string =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;

/** Whole euros for axis ticks and dense labels, where cents are noise. */
export const formatEuroShort = (n: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace(/[  ]/g, " ");
