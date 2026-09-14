/** Presentation helpers shared across POS, Orders, KOT and invoice screens. */

/** The restaurant's display timezone. Pinned so server (RSC/UTC) and client
 *  render the same local time — no hydration flash, no UTC leaking through. */
export const TIME_ZONE = "Europe/Paris";

/** Every screen reads money and dates the French way. */
export const LOCALE = "fr-FR";

const EUR = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "12,50 €". Intl separates thousands and the currency sign with narrow
 * no-break spaces; those are swapped for plain no-break spaces so the figure
 * never wraps and renders the same in every font and on thermal printers.
 */
export const formatCurrency = (n: number): string =>
  EUR.format(n).replace(/ /g, " ");

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

/** "14/09/2026" — the date as it is written on a French document. */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });

/** Mask a phone to its last 3 digits for display, e.g. "+33612345678" → "••678". */
export const maskPhone = (phone: string): string => {
  const last = phone.replace(/\D/g, "").slice(-3);
  return last ? `••${last}` : "";
};
