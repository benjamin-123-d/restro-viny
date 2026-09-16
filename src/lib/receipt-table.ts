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
  // « SAC DE CAISSE » and « BIC VELLEDA » are things people buy: a word that
  // also names a product cannot be on this list, however common it is on a
  // ticket's small print.
  /\b(total|totaux|sous[\s-]?total|ventilation|net a payer|a payer|tva|ht\b|ttc\b|remise|dont |escompte|acompte|iban|siret|rcs|n°|tel|t[ée]l|echeance|ech[ée]ance|date|client|facture|ticket|reglement|r[èe]glement|solde|vignette|emballage|penalit|p[ée]nalit|indemnit|paiement|pay[ée]e|volume|compte|montant|libell|qt[ée]|code|piece|pi[èe]ce|cartes?\s+(?:bancaires?|bleue)|especes|esp[èe]ces|cheque|ch[èe]que|rendu|monnaie|merci|service|poids|livraison|retrait|acheteur|contact|engagement|agr|int |acc |bio =)\b/i;

// « Total BRASSERIE  224,65 » — the family of the lines printed above it.
const FAMILY_TOTAL = /^total\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,40}?)\s*(?:[\d ., €]+)?$/i;

// « *** SPIRITUEUX Total: 103,16 » — the wholesaler writes it the other way round.
const FAMILY_TOTAL_AFTER = /^[*\s]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,40}?)\s+total\s*:?\s*(?:[\d ., €]+)?$/i;

// « >> PATISSERIE/VIENNOISERIE » — the till announces the family before its lines.
const FAMILY_HEADING = /^>{1,3}\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'./ -]{2,40}?)\s*-?\s*$/;

// « Total HT  Motif  HT » is the table's own header, not a family of products.
const NOT_A_FAMILY = /^(ht|ttc|tva|hors taxes?|g[ée]n[ée]ral|facture|remises?|motifs?|montants?|emballages?|nets?|pages?|articles?)\b/i;

// The VAT recap a till prints at the foot of the ticket, in its two shapes:
// « TVA 4: 5,50% € 26,14 1,44 » (Carrefour) and « 2 5%50 23.03 1.27 24.30 »
// (Leclerc, where the « % » sits where the comma should be).
const RECAP_NAMED = /^tva\s*([A-Za-z0-9])\s*[:.-]?\s*(\d{1,2})[.,%](\d{2})\s*%/i;
const RECAP_BARE = /^([A-Za-z0-9])\s+(\d{1,2})[.,%](\d{2})\s*%?\s+\d/;

/**
 * Which rate each key stands for. A line that ends in a bare « 5 » says
 * nothing on its own; the recap at the foot of the ticket is what turns it
 * into 20 %.
 */
export const vatKeysIn = (rows: readonly string[]): Map<string, number> => {
  const keys = new Map<string, number>();
  for (const row of rows) {
    const text = row.replace(/\s+/g, " ").trim();
    const match = RECAP_NAMED.exec(text) ?? RECAP_BARE.exec(text);
    if (!match) continue;
    const rate = Number(match[2]) + Number(match[3]) / 100;
    if (!FRENCH_VAT_RATES.has(rate)) continue;
    keys.set(match[1].toUpperCase(), rate);
  }
  return keys;
};

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

/**
 * The references a row starts with: a bar code, an article number, or a till's
 * quantity prefix. They belong in the code column, never in the label —
 * « 3099873045864 1765312 WH JACK DANIELS 40D 70CL » is a whisky, not digits.
 */
const LEADING_CODES = /^((?:[A-Z]{0,4}\d{4,14}[A-Z]?[\s|]+){1,3})/i;
// « 4 ASSORTIMENT PATISS », « 6 20 LAVETTES » — the figure a till prints in
// front of the wording is its VAT key, not part of the name nor a quantity.
const SHORT_PREFIX = /^(\d{1,3})\s+(?=\d{0,3}\s*[A-Za-zÀ-ÿ])/;

/**
 * The run of numbers printed at the end of a product row — the columns.
 * « 40,00 4,55 5,50 4,80 4,80 192,01 » or « 6 5,5% 5,25 31,50 ».
 */
const TRAILING_NUMBERS = /((?:\s+-?\d[\d.,]*\s*%?\s*(?:€|EUR)?)+)((?:\s+[A-Z]){0,3})\s*$/i;

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

/**
 * The « unit price × quantity = amount » pair among a row's figures.
 *
 * A wholesaler prints more columns than a till — an alcohol degree, a volume,
 * a weight, a packing quantity — so « the first figure is the quantity » reads
 * 40,0 for a bottle of whisky. The honest test is arithmetic: keep the two
 * columns that multiply out to the amount printed at the end of the row.
 */
const pricePair = (columns: readonly Column[], amount: number): { quantity: number; unitPrice: number } | null => {
  if (amount <= 0 || columns.length < 2) return null;
  let best: { quantity: number; unitPrice: number; at: number } | null = null;
  for (let price = 0; price < columns.length; price += 1) {
    // A price carries cents; a quantity is printed whole or with one decimal.
    if (columns[price].decimals < 2 || columns[price].value <= 0) continue;
    for (let count = 0; count < columns.length; count += 1) {
      if (count === price || columns[count].value <= 0 || columns[count].percent) continue;
      if (Math.abs(columns[price].value * columns[count].value - amount) > 0.015) continue;
      // Nearest the amount wins: that is where a table puts the quantity that
      // produced it, after the sizes and the packing.
      if (!best || count > best.at) best = { quantity: columns[count].value, unitPrice: columns[price].value, at: count };
    }
  }
  return best ? { quantity: best.quantity, unitPrice: best.unitPrice } : null;
};

export const readTableLine = (row: string, amountsAre: "HT" | "TTC"): Omit<TableLine, "family"> | null => {
  const text = row.replace(/\s+/g, " ").trim();
  if (text.length < 4) return null;

  const amounts = amountsIn(text);
  if (amounts.length === 0) return null;

  // Strip the references first: a long bar code, then a shorter article
  // number, then a till's « 4 » in front of « 4 ASSORTIMENT PATISS ».
  const codeMatch = LEADING_CODES.exec(text);
  const afterCodes = codeMatch ? text.slice(codeMatch[0].length).trim() : text;
  const prefixMatch = codeMatch ? null : SHORT_PREFIX.exec(text);
  const withoutCode = prefixMatch ? text.slice(prefixMatch[0].length).trim() : afterCodes;
  const code = codeMatch?.[1].trim().split(/[\s|]+/).pop() ?? null;

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
  // « 6,99x2 » on a till receipt is the unit price times the quantity, and
  // « 2 X 5.90€ » the same thing the other way round.
  const timesMatch = /(\d+[.,]\d{2})\s*[x*]\s*(\d+(?:[.,]\d+)?)/i.exec(withoutNotes);
  const reverseMatch = timesMatch ? null : /(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+[.,]\d{2})\s*(?:€|EUR)?/i.exec(withoutNotes);
  const times = timesMatch
    ? { unitPrice: timesMatch[1], quantity: timesMatch[2], text: timesMatch[0] }
    : reverseMatch
      ? { unitPrice: reverseMatch[2], quantity: reverseMatch[1], text: reverseMatch[0] }
      : null;
  const withoutTimes = times ? withoutNotes.replace(times.text, " ") : withoutNotes;
  const runMatch = TRAILING_NUMBERS.exec(withoutTimes);
  const columns = runMatch ? readColumns(runMatch[1]) : [];
  const wording = (runMatch ? withoutTimes.slice(0, runMatch.index) : withoutTimes)
    .replace(/[\s|·-]+$/, "")
    .replace(/^[\s|·-]+/, "")
    .trim();
  // A wholesaler slips a one-letter column — the excise régime — between the
  // wording and the figures. It belongs to the table, not to the product name.
  const label = code ? wording.replace(/\s+[A-Z]$/, "") : wording;

  if (label.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 3) return null;
  if (columns.length === 0) return null;

  // Tills print the VAT key after the amount — « 2,41  5 » at Leclerc,
  // « 179,40 €  13 » at Super U. A bare small integer there is that key, never
  // the price: the price is the figure with cents printed just before it.
  const last = columns[columns.length - 1];
  const beforeLast = columns[columns.length - 2];
  const trailingKey =
    columns.length > 1 && last.decimals === 0 && Math.abs(last.value) < 100 && beforeLast.decimals === 2;
  const figures = trailingKey ? columns.slice(0, -1) : columns;
  const amount = figures[figures.length - 1].value;

  // The VAT column: a French rate, written with a « % » or simply as a number
  // between the unit price and the amount.
  const middle = figures.slice(1, -1);
  const vatColumn =
    middle.find((column) => column.percent && FRENCH_VAT_RATES.has(column.value)) ??
    middle.find((column) => FRENCH_VAT_RATES.has(column.value) && column.value !== 0);
  const vatRate = vatColumn?.value ?? (figures[0]?.percent && FRENCH_VAT_RATES.has(figures[0].value) ? figures[0].value : null);

  // The first column is the quantity — unless the row only carries its amount.
  const timesQuantity = times ? Number(times.quantity.replace(",", ".")) : null;
  const timesUnitPrice = times ? Number(times.unitPrice.replace(",", ".")) : null;
  const pair = times ? null : pricePair(figures.slice(0, -1).filter((column) => column !== vatColumn), amount);
  const quantity =
    timesQuantity ?? pair?.quantity ?? (figures.length > 1 && figures[0] !== vatColumn ? figures[0].value : null);
  // The unit price is the first figure after the quantity that is neither the
  // VAT rate nor the amount; failing that, the amount divided by the quantity.
  const printedUnitPrice = figures.slice(1, -1).find((column) => column !== vatColumn);
  const unitPrice =
    timesUnitPrice ??
    pair?.unitPrice ??
    (quantity && quantity > 0 ? (printedUnitPrice?.value ?? Math.round((amount / quantity) * 100) / 100) : null);

  const vatCode =
    (trailingKey ? String(last.value) : null) ??
    /\d[.,]\d{2}\s*(?:€|EUR)?\s*\*?\s*([A-D1-4])\s*$/i.exec(text)?.[1]?.toUpperCase() ??
    // Carrefour keys its lines from the front: « 4 » is 5,50 %, « 6 » is 20 %.
    prefixMatch?.[1] ??
    null;

  return { code, label, quantity, vatRate, vatCode, unitPrice, amount };
};

/**
 * A row that reads like the name of something bought but carries no amount —
 * the first half of a line the till wrapped onto two rows.
 */
const isWording = (text: string): boolean =>
  text.length >= 4 &&
  text.length <= 60 &&
  text.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 3 &&
  amountsIn(text).length === 0 &&
  !NOT_A_PRODUCT.test(foldText(text));

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
  const keys = vatKeysIn(rows);
  const lines: TableLine[] = [];
  const families: string[] = [];
  let pending: Omit<TableLine, "family">[] = [];
  // Some tills announce the family before its lines (« >> BAZAR »), others
  // close it with a total underneath (« Total BAZAR 29,75 »).
  let announced: string | null = null;
  // The wording of a line whose amount is printed on the row below.
  let dangling: string | null = null;

  // « EPICERIE SALEE » reads better as « Epicerie salee »; « D.P.H. » is an
  // abbreviation and stays as printed.
  const named = (name: string) =>
    /^[A-Z.]+$/.test(name) && name.includes(".") ? name : name.charAt(0) + name.slice(1).toLowerCase();

  const flush = (family: string | null) => {
    for (const line of pending) {
      // « 2,41  5 » only becomes 20 % once the recap at the foot is read.
      const keyed = line.vatRate == null && line.vatCode ? (keys.get(line.vatCode) ?? null) : null;
      lines.push({ ...line, vatRate: line.vatRate ?? keyed, family });
    }
    if (family && !families.includes(family)) families.push(family);
    pending = [];
  };

  for (const row of rows) {
    const clean = row.replace(/\s+/g, " ").trim();

    const heading = FAMILY_HEADING.exec(clean)?.[1]?.trim();
    if (heading && !NOT_A_FAMILY.test(heading)) {
      flush(announced);
      announced = named(heading);
      continue;
    }

    const closing = (FAMILY_TOTAL.exec(clean) ?? FAMILY_TOTAL_AFTER.exec(clean))?.[1]?.trim();
    if (closing && !NOT_A_FAMILY.test(closing)) {
      // A family total closes the block of lines printed above it.
      flush(announced ?? named(closing));
      announced = null;
      continue;
    }

    const line = readTableLine(row, amountsAre);
    if (line) {
      pending.push(line);
      dangling = null;
      continue;
    }

    // « ASSORTIMENT TARTELETTES X4 » on one row, « 2 X 5.90€  11.80  2 » on the
    // next: a wording with no amount followed by an amount with no wording.
    const joined = dangling ? readTableLine(`${dangling} ${clean}`, amountsAre) : null;
    if (joined) {
      pending.push(joined);
      dangling = null;
      continue;
    }

    dangling = isWording(clean) ? clean : null;
  }
  flush(announced);

  return { lines, amountsAre, families };
};

/** What the read lines add up to, to compare with the ticket's own total. */
export const tableTotal = (lines: readonly TableLine[]): number =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
