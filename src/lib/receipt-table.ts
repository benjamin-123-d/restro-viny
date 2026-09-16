/**
 * Reading the table of a supplier invoice or a shop ticket.
 *
 * Once the rows are back in printed order (see receipt-rows.ts), a product row
 * looks the same everywhere: a code, a label, how many, the VAT rate, the unit
 * price, and the amount at the end. Discounts slip in between, section totals
 * interrupt, and the legal small print follows — so the rules below are as much
 * about what to *skip* as about what to read.
 */

import { parseAmountToken } from "./receipt-parser";
import { foldText } from "./search-text";

export interface TableLine {
  /** The supplier's own article code, when the table has one. */
  readonly code: string | null;
  readonly label: string;
  readonly quantity: number | null;
  readonly vatRate: number | null;
  /** Till tickets key the VAT rate with a letter printed after the amount. */
  readonly vatCode: string | null;
  readonly unitPrice: number | null;
  /** The line's amount, as printed. */
  readonly amount: number;
  /** « Épicerie salée », « Brasserie »… when the ticket groups its lines. */
  readonly family: string | null;
}

export interface ReceiptTable {
  readonly lines: readonly TableLine[];
  /** Whether the amounts above are HT (wholesaler) or TTC (shop till). */
  readonly amountsAre: "HT" | "TTC";
  readonly families: readonly string[];
}

const FRENCH_VAT_RATES = new Set([0, 2.1, 5.5, 8.5, 10, 13, 20]);

// Rows that carry a number but are not something bought.
const NOT_A_PRODUCT =
  /\b(total|totaux|sous[\s-]?total|ventilation|net a payer|a payer|tva|ht\b|ttc\b|remise|dont |escompte|acompte|iban|bic|siret|rcs|n°|tel|t[ée]l|echeance|ech[ée]ance|date|client|facture|ticket|caisse|reglement|r[èe]glement|solde|vignette|emballage|penalit|p[ée]nalit|indemnit|paiement|pay[ée]e|volume|compte|montant|libell|qt[ée]|code|piece|pi[èe]ce|carte|especes|esp[èe]ces|cheque|ch[èe]que|rendu|monnaie|merci|service|poids|livraison|retrait|acheteur|contact|engagement|agr|int |acc |bio =)\b/i;

// « Total BRASSERIE  224,65 » — the family of the lines printed above it.
const FAMILY_TOTAL = /^total\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,40}?)\s*(?:[\d ., €]+)?$/i;

// « Total HT  Motif  HT » is the table's own header, not a family of products.
const NOT_A_FAMILY = /^(ht|ttc|tva|hors taxes?|g[ée]n[ée]ral|facture|remises?|motifs?|montants?|emballages?|nets?|pages?|articles?)\b/i;

/** Every number printed with two decimals — amounts, never quantities. */
const amountsIn = (text: string): number[] =>
  (text.match(/-?\d{1,3}(?:[ .]\d{3})*[.,]\d{2}(?![\d%])/g) ?? [])
    .map((token) => parseAmountToken(token.replace(/\s/g, "")))
    .filter((n): n is number => n != null);

/**
 * A label can carry a percentage of its own — « 70%VDE », « 35% MG » — so the
 * VAT rate is the *last* percentage that is a real French rate, and only when
 * a number follows it (the unit price).
 */
const vatRateIn = (text: string): { rate: number; index: number } | null => {
  let found: { rate: number; index: number } | null = null;
  for (const match of text.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g)) {
    const rate = Number(match[1].replace(",", "."));
    if (!FRENCH_VAT_RATES.has(rate)) continue;
    const after = text.slice((match.index ?? 0) + match[0].length);
    if (!/\d/.test(after)) continue;
    found = { rate, index: match.index ?? 0 };
  }
  return found;
};

const CODE = /^(\d{4,8})\b/;

/**
 * One row of the table. Returns null when the row is a heading, a total, a
 * discount note or the small print — anything that is not a thing bought.
 */
/**
 * The run of numbers printed at the end of a product row — the columns.
 * « 40,00 4,55 5,50 4,80 4,80 192,01 » or « 6 5,5% 5,25 31,50 ».
 */
const TRAILING_NUMBERS = /((?:\s+-?\d[\d.,]*\s*%?\s*(?:€|EUR)?)+)\s*(?:[A-D1-4])?\s*$/i;

interface Column {
  readonly value: number;
  readonly percent: boolean;
  readonly decimals: number;
}

const readColumns = (run: string): Column[] =>
  run
    // « 1 234,56 » is one number; every other space separates two columns, so
    // three digits followed by a decimal separator are a column of their own.
    .replace(/(\d)[\s  ](\d{3})(?![\d.,])/g, "$1$2")
    .trim()
    .split(/\s+/)
    .map((token) => {
      const percent = token.includes("%");
      const cleaned = token.replace(/[%€]|EUR/gi, "").trim();
      if (!/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) return null;
      const decimals = /[.,](\d+)$/.exec(cleaned)?.[1]?.length ?? 0;
      return { value: Number(cleaned.replace(",", ".")), percent, decimals };
    })
    .filter((column): column is Column => column != null);

export const readTableLine = (row: string, amountsAre: "HT" | "TTC"): Omit<TableLine, "family"> | null => {
  const text = row.replace(/\s+/g, " ").trim();
  if (text.length < 4) return null;

  const amounts = amountsIn(text);
  if (amounts.length === 0) return null;

  const codeMatch = CODE.exec(text);
  const code = codeMatch?.[1] ?? null;
  const withoutCode = code ? text.slice(codeMatch?.[0].length ?? 0).trim() : text;

  // A row with a code is a product even when its wording looks like a total.
  // A negative amount is a discount that changes what was paid, so it stays;
  // a positive « remise » line is only a note about a discount already counted.
  const isDiscount = amounts[amounts.length - 1] < 0;
  // Folded first: « Net à payer » and « Echéance » must be caught with their accents.
  if (!code && !isDiscount && NOT_A_PRODUCT.test(foldText(text))) return null;

  // Every table ends its rows with its columns of figures. Reading that run as
  // a whole — rather than hunting for a « % » that some invoices never print —
  // is what makes one rule fit a wholesaler, a caterer and a till ticket.
  // Some tables print a word inside the figures — « Promo », « Offert ».
  // A discount row keeps its wording; elsewhere these words only clutter.
  const withoutNotes = isDiscount ? withoutCode : withoutCode.replace(/\b(promo|offert|gratuit|remise|remis\w*)\b/gi, " ");
  const runMatch = TRAILING_NUMBERS.exec(withoutNotes);
  const columns = runMatch ? readColumns(runMatch[1]) : [];
  const label = (runMatch ? withoutNotes.slice(0, runMatch.index) : withoutNotes)
    .replace(/[\s|·-]+$/, "")
    .replace(/^[\s|·-]+/, "")
    .trim();

  if (label.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 3) return null;
  if (columns.length === 0) return null;

  const amount = columns[columns.length - 1].value;

  // The VAT column: a French rate, written with a « % » or simply as a number
  // between the unit price and the amount.
  const middle = columns.slice(1, -1);
  const vatColumn =
    middle.find((column) => column.percent && FRENCH_VAT_RATES.has(column.value)) ??
    middle.find((column) => FRENCH_VAT_RATES.has(column.value) && column.value !== 0);
  const vatRate = vatColumn?.value ?? (columns[0]?.percent && FRENCH_VAT_RATES.has(columns[0].value) ? columns[0].value : null);

  // The first column is the quantity — unless the row only carries its amount.
  const quantity = columns.length > 1 && columns[0] !== vatColumn ? columns[0].value : null;
  // The unit price is the first figure after the quantity that is neither the
  // VAT rate nor the amount; failing that, the amount divided by the quantity.
  const printedUnitPrice = columns.slice(1, -1).find((column) => column !== vatColumn);
  const unitPrice =
    quantity && quantity > 0 ? (printedUnitPrice?.value ?? Math.round((amount / quantity) * 100) / 100) : null;

  const vatCode = /\d[.,]\d{2}\s*(?:€|EUR)?\s*\*?\s*([A-D1-4])\s*$/i.exec(text)?.[1]?.toUpperCase() ?? null;

  return { code, label, quantity, vatRate, vatCode, unitPrice, amount };
};

/** « Montant HT » in the header means the line amounts exclude VAT. */
const detectAmountKind = (rows: readonly string[]): "HT" | "TTC" => {
  const header = rows.find((row) => /libell[ée]|d[ée]signation|article/i.test(row));
  if (header && /\bht\b|hors\s*taxe/i.test(header)) return "HT";
  // Wholesalers print « PU HT » or « Montant HT » just above or beside the table.
  if (rows.some((row) => /\b(pu|montant|total|prix)\s*ht\b/i.test(row))) return "HT";
  return "TTC";
};

/**
 * The whole table: the lines bought, which family each belongs to, and whether
 * the amounts are before or after VAT.
 */
export const readReceiptTable = (rows: readonly string[]): ReceiptTable => {
  const amountsAre = detectAmountKind(rows);
  const lines: TableLine[] = [];
  const families: string[] = [];
  let pending: Omit<TableLine, "family">[] = [];

  const flush = (family: string | null) => {
    for (const line of pending) lines.push({ ...line, family });
    if (family && !families.includes(family)) families.push(family);
    pending = [];
  };

  for (const row of rows) {
    const familyMatch = FAMILY_TOTAL.exec(row.replace(/\s{2,}.*$/, "").trim());
    const family = familyMatch?.[1]?.trim();
    if (family && !NOT_A_FAMILY.test(family)) {
      // A family total closes the block of lines printed above it.
      flush(family.charAt(0) + family.slice(1).toLowerCase());
      continue;
    }
    const line = readTableLine(row, amountsAre);
    if (line) pending.push(line);
  }
  flush(null);

  return { lines, amountsAre, families };
};

/** What the read lines add up to, to compare with the ticket's own total. */
export const tableTotal = (lines: readonly TableLine[]): number =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
