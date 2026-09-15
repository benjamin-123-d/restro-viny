/**
 * French company identifiers printed on invoices and receipts: SIRET, the
 * intra-community VAT number, the NAF/APE activity code. Pure checks, so the
 * settings form can tell the owner about a typo before it reaches a receipt.
 */

export const normaliseDigits = (value: string): string => value.replace(/\D/g, "");

const compact = (value: string): string => value.replace(/[\s.-]/g, "").toUpperCase();

/** La Poste's SIREN: its establishments do not follow the Luhn rule. */
const LA_POSTE_SIREN = "356000000";

const luhn = (digits: string): boolean => {
  let total = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return total % 10 === 0;
};

export const isValidSiret = (value: string): boolean => {
  const raw = value.replace(/\s/g, "");
  if (!/^\d{14}$/.test(raw)) return false;
  if (raw.startsWith(LA_POSTE_SIREN)) {
    const sum = [...raw].reduce((s, d) => s + Number(d), 0);
    return sum % 5 === 0;
  }
  return luhn(raw);
};

/** "732 829 320 00074": SIREN in threes, then the NIC. */
export const formatSiret = (value: string): string => {
  const d = normaliseDigits(value);
  if (d.length !== 14) return value.trim();
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
};

const vatKey = (siren: string): number => (12 + 3 * (Number(siren) % 97)) % 97;

/** The French VAT number follows from the SIREN: FR + 2-digit key + SIREN. */
export const vatNumberFromSiret = (siret: string): string | null => {
  const d = normaliseDigits(siret);
  if (d.length !== 14 && d.length !== 9) return null;
  const siren = d.slice(0, 9);
  return `FR${String(vatKey(siren)).padStart(2, "0")}${siren}`;
};

export const isValidVatNumber = (value: string): boolean => {
  const v = compact(value);
  const french = /^FR(\d{2})(\d{9})$/.exec(v);
  if (french) return Number(french[1]) === vatKey(french[2]);
  // Keys with letters (rare, older numbers) cannot be checked locally.
  return /^FR[0-9A-Z]{2}\d{9}$/.test(v);
};

export const isValidNafCode = (value: string): boolean => /^\d{4}[A-Z]$/.test(compact(value));

/** "5610a" → "56.10A", the way INSEE prints it. */
export const formatNafCode = (value: string): string => {
  const v = compact(value);
  return /^\d{4}[A-Z]$/.test(v) ? `${v.slice(0, 2)}.${v.slice(2)}` : value.trim();
};

/** Legal forms a French restaurant commonly trades under. */
export const LEGAL_FORMS = [
  "Entreprise individuelle (EI)",
  "Micro-entreprise",
  "EURL",
  "SARL",
  "SASU",
  "SAS",
  "SNC",
  "Société coopérative (SCOP)",
  "Association",
] as const;

/** Licences to serve alcohol (Code de la santé publique, art. L3331-1 s.). */
export const DRINKS_LICENSES = [
  "Aucune (pas d'alcool)",
  "Petite licence restaurant",
  "Licence restaurant",
  "Licence III",
  "Licence IV",
  "Petite licence à emporter",
  "Licence à emporter",
] as const;

/** The usual NAF codes for food service, for the settings form's suggestions. */
export const RESTAURANT_NAF_CODES = [
  { code: "56.10A", label: "Restauration traditionnelle" },
  { code: "56.10B", label: "Cafétérias et autres libres-services" },
  { code: "56.10C", label: "Restauration de type rapide" },
  { code: "56.21Z", label: "Services des traiteurs" },
  { code: "56.30Z", label: "Débits de boissons" },
] as const;
