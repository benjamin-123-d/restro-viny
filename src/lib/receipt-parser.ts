/**
 * Turns the text read from a ticket or invoice photo into the facts a
 * purchase needs. OCR text is noisy, so every rule prefers saying nothing to
 * guessing wrong, and the owner confirms each value on screen.
 */

import { foldText } from "./search-text";
import { suggestCategory, type PurchaseCategory } from "./purchase-categories";
import { readReceiptTable } from "./receipt-table";

export interface ReceiptVatRow {
  readonly code: string | null;
  readonly rate: number;
  readonly base: number | null;
  readonly amount: number | null;
}

export interface ReceiptLine {
  readonly label: string;
  /** As printed: TTC on shop tickets, HT on most wholesaler invoices. */
  readonly amount: number;
  readonly category: PurchaseCategory;
  readonly vatRate: number | null;
  /** The supplier's article code, when the table prints one. */
  readonly code: string | null;
  readonly quantity: number | null;
  readonly unitPrice: number | null;
  /** « Brasserie », « Crèmerie »… when the invoice groups its lines. */
  readonly family: string | null;
}

export interface ReceiptReading {
  readonly shopName: string | null;
  readonly siret: string | null;
  /** yyyy-mm-dd */
  readonly date: string | null;
  readonly ticketNumber: string | null;
  readonly totalTTC: number | null;
  readonly totalHT: number | null;
  readonly vat: readonly ReceiptVatRow[];
  readonly lines: readonly ReceiptLine[];
  readonly paymentMode: "CARD" | "CASH" | "CHEQUE" | null;
  /** Whether the line amounts are before or after VAT. */
  readonly amountsAre: "HT" | "TTC";
  readonly families: readonly string[];
  readonly confidence: "high" | "medium" | "low";
}

const KNOWN_SHOPS: readonly (readonly [string, string])[] = [
  ["promocash", "Promocash"],
  ["transgourmet", "Transgourmet"],
  ["metro", "Metro"],
  ["carrefour", "Carrefour"],
  ["leclerc", "E.Leclerc"],
  ["auchan", "Auchan"],
  ["intermarche", "Intermarché"],
  ["super u", "Super U"],
  ["hyper u", "Hyper U"],
  ["lidl", "Lidl"],
  ["aldi", "Aldi"],
  ["casino", "Casino"],
  ["monoprix", "Monoprix"],
  ["franprix", "Franprix"],
  ["grand frais", "Grand Frais"],
  ["picard", "Picard"],
  ["biocoop", "Biocoop"],
  ["brakes", "Brakes"],
  ["sysco", "Sysco"],
  ["pomona", "Pomona"],
  ["passion froid", "Passion Froid"],
  ["episaveurs", "EpiSaveurs"],
  ["davigel", "Davigel"],
  ["chomette", "Chomette"],
  ["action", "Action"],
  ["ikea", "IKEA"],
  ["leroy merlin", "Leroy Merlin"],
  ["castorama", "Castorama"],
  ["cash express", "Cash Express"],
];

const FRENCH_VAT_RATES = new Set([0, 2.1, 5.5, 8.5, 10, 13, 20]);

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** OCR often reads 0 as O and 1 as l inside numbers. */
const fixDigits = (token: string): string => token.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1");

/**
 * « 12,90 », « 1 234,56 », « 1.234,56 », « 7.47 », « -0,50 » — always two
 * decimals, which is what tells an amount from a quantity or a code.
 */
export const parseAmountToken = (token: string): number | null => {
  const cleaned = fixDigits(token.trim()).replace(/€|eur/gi, "").replace(/\s/g, "");
  const match = /^(-)?(\d{1,3}(?:[.\s]?\d{3})*|\d+)[.,](\d{2})$/.exec(cleaned);
  if (!match) return null;
  const whole = match[2].replace(/[.\s]/g, "");
  const value = Number(`${whole}.${match[3]}`);
  return match[1] ? -value : value;
};

// An amount at the end of a line, optionally followed by a currency and a VAT code.
const TRAILING_AMOUNT =
  /(-?\s?[\dOo]{1,3}(?:[ .][\dOo]{3})*[.,][\dOo]{2})\s*(?:€|EUR|E)?\s*(?:\*?\s*([A-D1-4]))?\s*$/i;

interface Tail {
  readonly amount: number;
  readonly code: string | null;
  readonly head: string;
}

const trailingAmount = (line: string): Tail | null => {
  const match = TRAILING_AMOUNT.exec(line);
  if (!match) return null;
  const amount = parseAmountToken(match[1].replace(/\s/g, ""));
  if (amount == null) return null;
  return { amount, code: match[2]?.toUpperCase() ?? null, head: line.slice(0, match.index).trim() };
};

const allAmounts = (line: string): number[] =>
  (line.match(/-?[\dOo]{1,3}(?:[ .][\dOo]{3})*[.,][\dOo]{2}(?![\d%])/g) ?? [])
    .map((t) => parseAmountToken(t.replace(/\s/g, "")))
    .filter((n): n is number => n != null);

const SKIP_LINE =
  /\b(sous[\s-]?total|total|tva|t\.v\.a|ht|ttc|net a payer|a payer|montant|cb|carte|visa|mastercard|especes|rendu|monnaie|cheque|nb\.?\s*art|articles?|client|caisse|ticket|facture|merci|siret|tel|date|heure|avoir|acompte|paiement|regle|reglement|paye)\b/;

const TOTAL_TTC_PATTERNS: readonly RegExp[] = [
  /\b(total\s*ttc|net\s*a\s*payer|montant\s*ttc|total\s*a\s*payer|a\s*payer)\b/,
  /\btotal\b(?!\s*(ht|tva|hors))/,
];
const TOTAL_HT_PATTERN = /\b(total\s*ht|montant\s*ht|total\s*hors\s*taxes?)\b/;

const findDate = (text: string): string | null => {
  const re = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/g;
  for (const match of text.matchAll(re)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) continue;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCDate() !== day) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
};

const findSiret = (text: string): string | null => {
  const labelled = /siret\s*:?\s*((?:\d\s?){14})/i.exec(text);
  const digits = (labelled?.[1] ?? /\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/.exec(text)?.[1])?.replace(/\s/g, "");
  return digits && digits.length === 14 ? digits : null;
};

const looksLikeDate = (value: string): boolean => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(value);

/** « N° Facture : 294501 » first, then looser wordings — and never a date. */
const findTicketNumber = (lines: readonly string[]): string | null => {
  const patterns = [
    /\bn[°o]\s*(?:de\s*)?(?:facture|ticket|bon|pi[èe]ce)\s*:?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
    /\b(?:facture|ticket|bon|transaction|trans\.?)\s*(?:n[°o]\.?|no\.?|num(?:ero)?\.?)\s*:?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
    /\bn[°o]\s*:?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
    // A till simply prints « TICKET 0452 ».
    /\b(?:facture|ticket|bon)\s*:?\s*([A-Z0-9][A-Z0-9/-]{2,})/i,
  ];
  for (const pattern of patterns) {
    for (const line of lines) {
      const value = pattern.exec(line)?.[1];
      if (value && /\d/.test(value) && !looksLikeDate(value)) return value;
    }
  }
  return null;
};

const findShop = (lines: readonly string[]): string | null => {
  // A wholesaler often names itself only in the small print at the bottom.
  const whole = lines.map(foldText).join(" \n ");
  for (const [needle, name] of KNOWN_SHOPS) {
    if (new RegExp(`(^|\\s)${needle}(\\s|$)`).test(whole)) return name;
  }
  const first = lines.find((line) => {
    const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
    return letters >= 3 && letters >= line.replace(/\s/g, "").length * 0.6 && !/\d{4,}/.test(line);
  });
  return first ? first.trim().slice(0, 80) : null;
};

const findPayment = (folded: string): ReceiptReading["paymentMode"] => {
  if (/\b(cb|carte bancaire|carte|visa|mastercard|sans contact)\b/.test(folded)) return "CARD";
  if (/\b(especes|espece|cash|liquide)\b/.test(folded)) return "CASH";
  if (/\bcheque\b/.test(folded)) return "CHEQUE";
  return null;
};

/** « A 5,50% 27,63 1,52 » — a rate, then the base and the VAT, in either order. */
const readVatRow = (line: string): ReceiptVatRow | null => {
  const rateMatch = /(?:^|\s)(\d{1,2}(?:[.,]\d{1,2})?)\s*%/.exec(line);
  if (!rateMatch) return null;
  const rate = Number(rateMatch[1].replace(",", "."));
  if (!FRENCH_VAT_RATES.has(rate)) return null;
  const code = /^\s*([A-D1-4])\b/i.exec(line)?.[1]?.toUpperCase() ?? null;
  const numbers = allAmounts(line.slice(rateMatch.index + rateMatch[0].length));
  if (numbers.length === 0) return { code, rate, base: null, amount: null };
  if (numbers.length === 1) return { code, rate, base: null, amount: numbers[0] };
  const [a, b] = numbers;
  const fits = (base: number, vat: number) => Math.abs(round2((base * rate) / 100) - vat) <= 0.05;
  if (fits(a, b)) return { code, rate, base: a, amount: b };
  if (fits(b, a)) return { code, rate, base: b, amount: a };
  // « taux, TTC, HT, TVA » layouts: find any fitting pair.
  for (const base of numbers) {
    for (const vat of numbers) if (base !== vat && fits(base, vat)) return { code, rate, base, amount: vat };
  }
  return { code, rate, base: a, amount: b };
};

/** Slips OCR makes on tickets: « À » for the VAT code A, « $ » for %, « 37, 33 ». */
export const cleanOcrLine = (line: string): string =>
  line
    .replace(/\s+/g, " ")
    .replace(/(\d)\s?[$§]+\s?%?/g, "$1%")
    .replace(/\b(\d{1,3}), (\d{2})(?![\d.,])/g, "$1,$2")
    .replace(/\s[ÀÁÂÄ]\s*$/, " A")
    .trim();

/** Which printed total the sum of the lines lands on, when either is known. */
const amountsMatch = (
  lines: readonly ReceiptLine[],
  totalHT: number | null,
  totalTTC: number | null,
): "HT" | "TTC" | null => {
  const sum = round2(lines.reduce((total, line) => total + line.amount, 0));
  if (sum <= 0) return null;
  const toHT = totalHT == null ? Infinity : Math.abs(sum - totalHT);
  const toTTC = totalTTC == null ? Infinity : Math.abs(sum - totalTTC);
  if (Math.min(toHT, toTTC) > 0.05) return null;
  return toTTC <= toHT ? "TTC" : "HT";
};

export const parseReceiptText = (text: string): ReceiptReading => {
  const lines = text
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter((line) => line.length > 0);
  const folded = foldText(text);

  let totalTTC: number | null = null;
  let totalHT: number | null = null;
  let totalLineIndex = -1;
  for (const pattern of TOTAL_TTC_PATTERNS) {
    lines.forEach((line, index) => {
      const f = foldText(line);
      if (/sous\s*total/.test(f) || !pattern.test(f)) return;
      const tail = trailingAmount(line);
      if (tail && tail.amount > 0 && (totalTTC == null || tail.amount > totalTTC)) {
        totalTTC = tail.amount;
        totalLineIndex = index;
      }
    });
    if (totalTTC != null) break;
  }
  for (const line of lines) {
    if (TOTAL_HT_PATTERN.test(foldText(line))) totalHT = trailingAmount(line)?.amount ?? totalHT;
  }

  const vat: ReceiptVatRow[] = [];
  for (const line of lines) {
    const f = foldText(line);
    if (/\b(total|sous total)\b/.test(f)) continue;
    const row = /%/.test(line) && (/\btva\b/.test(f) || /^\s*[A-D1-4]\s+\d/i.test(line)) ? readVatRow(line) : null;
    if (row && (row.base != null || row.amount != null)) vat.push(row);
  }
  const rateByCode = new Map(vat.filter((v) => v.code).map((v) => [v.code as string, v.rate]));

  // The table reader handles both shapes: a wholesaler's columns and a till's
  // « label … amount » lines. It also knows which rows are not things bought.
  const table = readReceiptTable(lines);
  const itemLines: ReceiptLine[] = [];
  for (const line of table.lines) {
    // A discount without telling words belongs with the line it discounts.
    const own = suggestCategory(line.label);
    const previous = itemLines[itemLines.length - 1];
    const category = line.amount < 0 && own === "DENREES" && previous ? previous.category : own;
    itemLines.push({
      label: line.label,
      amount: line.amount,
      category,
      vatRate: line.vatRate ?? (line.vatCode ? (rateByCode.get(line.vatCode) ?? null) : null),
      code: line.code,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      family: line.family,
    });
  }

  const linesSum = round2(itemLines.reduce((s, l) => s + l.amount, 0));
  const vatSum = round2(vat.reduce((s, v) => s + (v.base ?? 0) + (v.amount ?? 0), 0));
  const consistent =
    totalTTC != null &&
    ((itemLines.length > 0 && Math.abs(linesSum - totalTTC) <= 0.05) || (vat.length > 0 && Math.abs(vatSum - totalTTC) <= 0.05));

  return {
    shopName: findShop(lines),
    siret: findSiret(text),
    date: findDate(text),
    ticketNumber: findTicketNumber(lines),
    totalTTC,
    totalHT,
    vat,
    lines: itemLines,
    paymentMode: findPayment(folded),
    // The header can lie — « P.U. HT » beside a « Montant TTC » column — so
    // the totals decide: the lines belong to whichever one they add up to.
    amountsAre: amountsMatch(itemLines, totalHT, totalTTC) ?? table.amountsAre,
    families: table.families,
    confidence: consistent ? "high" : totalTTC != null ? "medium" : "low",
  };
};
