/**
 * Les règles — what the encoding screen refuses, and why.
 *
 * These are accounting postulates, not preferences of this application, so
 * they live in one pure file that can be read and tested on its own:
 *
 * - **partie double** — every entry balances, to the cent;
 * - **non-compensation** — a line carries a debit or a credit, never a net;
 * - **indépendance des exercices** — the entry date decides the period, and a
 *   closed period refuses new postings;
 * - **justification** — no entry without the document that proves it;
 * - **intangibilité** — once posted, an entry is never modified or deleted:
 *   it is reversed by its mirror image.
 *
 * A screen can be redesigned; these cannot.
 */

import { DEFAULT_ACCOUNTS } from "@/lib/chart-of-accounts";

export type PieceKind = "ACHAT" | "VENTE";
export type PieceStatus = "A_TRAITER" | "ENREGISTREE" | "COMPTABILISEE";
export type EntrySide = "D" | "C";

export interface VentilationLine {
  readonly accountCode: string;
  /** « FAUC01 » — the third party's own sub-account under the collective one. */
  readonly auxiliaryCode: string | null;
  readonly auxiliaryName: string | null;
  readonly label: string | null;
  readonly side: EntrySide;
  /** Always positive: the side says which column it falls in. */
  readonly amount: number;
}

export interface PieceHeader {
  readonly kind: PieceKind;
  readonly thirdPartyName: string;
  /** « YYYY-MM-DD ». */
  readonly invoiceDate: string;
  readonly entryDate: string;
  readonly amountTTC: number;
  readonly amountHT: number;
  readonly vatRate: number | null;
  readonly amountVAT: number;
  /** Charges constatées d'avance: the charge belongs to a later period. */
  readonly isCca: boolean;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Under half a cent is rounding, not an imbalance. */
const TOLERANCE = 0.005;

const euro = (n: number): string =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }).replace(/ | /g, " ");

// ------------------------------------------------------------ partie double ---

export interface Balance {
  readonly debit: number;
  readonly credit: number;
  /** Debit minus credit: what is missing, and on which side. */
  readonly difference: number;
}

export const ventilationTotal = (lines: readonly VentilationLine[], side: EntrySide): number =>
  round2(lines.filter((line) => line.side === side).reduce((sum, line) => sum + line.amount, 0));

export const balanceOf = (lines: readonly VentilationLine[]): Balance => {
  const debit = ventilationTotal(lines, "D");
  const credit = ventilationTotal(lines, "C");
  return { debit, credit, difference: round2(debit - credit) };
};

export const isBalanced = (lines: readonly VentilationLine[]): boolean =>
  Math.abs(balanceOf(lines).difference) <= TOLERANCE;

// -------------------------------------------------------------- ventilation ---

export interface VentilationOptions {
  /** The charge account for a purchase; ignored for a sale. */
  readonly expenseAccount?: string;
  /** The product account for a sale; ignored for a purchase. */
  readonly incomeAccount?: string;
  readonly auxiliaryCode?: string | null;
  readonly auxiliaryName?: string | null;
  readonly label?: string | null;
}

const makeLine = (
  accountCode: string,
  side: EntrySide,
  amount: number,
  options: VentilationOptions,
  withAuxiliary = false,
): VentilationLine => ({
  accountCode,
  side,
  amount: round2(amount),
  auxiliaryCode: withAuxiliary ? (options.auxiliaryCode ?? null) : null,
  auxiliaryName: withAuxiliary ? (options.auxiliaryName ?? null) : null,
  label: options.label ?? null,
});

/**
 * The three lines an invoice becomes, proposed and always correctable.
 *
 * The third party carries the amount actually owed — TTC — and the charge takes
 * whatever is left once VAT is removed. Deriving the charge by subtraction
 * rather than by taking the typed HT is deliberate: when the two disagree by a
 * cent, an entry that balances is worth more than a charge that matches a field.
 */
export const proposeVentilation = (
  header: PieceHeader,
  options: VentilationOptions = {},
): VentilationLine[] => {
  const ttc = round2(header.amountTTC);
  const vat = round2(Math.max(0, header.amountVAT));
  const rest = round2(ttc - vat);
  const lines: VentilationLine[] = [];

  if (header.kind === "ACHAT") {
    lines.push(makeLine(DEFAULT_ACCOUNTS.supplier, "C", ttc, options, true));
    if (vat > 0) lines.push(makeLine(DEFAULT_ACCOUNTS.vatDeductible, "D", vat, options));
    lines.push(
      makeLine(
        header.isCca ? DEFAULT_ACCOUNTS.prepaidExpense : (options.expenseAccount ?? DEFAULT_ACCOUNTS.expense),
        "D",
        rest,
        options,
      ),
    );
    return lines;
  }

  lines.push(makeLine(DEFAULT_ACCOUNTS.customer, "D", ttc, options, true));
  if (vat > 0) lines.push(makeLine(DEFAULT_ACCOUNTS.vatCollected, "C", vat, options));
  lines.push(makeLine(options.incomeAccount ?? DEFAULT_ACCOUNTS.income, "C", rest, options));
  return lines;
};

// ------------------------------------------------------- ce qui bloque la pièce ---

export interface PostCheck {
  readonly header: PieceHeader;
  readonly lines: readonly VentilationLine[];
  /** Whether a document is attached — an entry without its proof is not one. */
  readonly hasDocument: boolean;
  /** Whether the entry date falls in a closed financial year. */
  readonly closedPeriod: boolean;
}

/**
 * Everything standing between this piece and the ledger, in plain French.
 *
 * It returns reasons rather than a boolean because « impossible » is not an
 * answer: the accountant has to know which cent is missing and where.
 */
export const blockingReasons = (check: PostCheck): string[] => {
  const reasons: string[] = [];
  const { header, lines } = check;

  if (!header.thirdPartyName.trim()) {
    reasons.push(header.kind === "ACHAT" ? "Indiquez le fournisseur." : "Indiquez le client.");
  }
  if (!header.invoiceDate) reasons.push("Indiquez la date de la facture.");

  if (round2(header.amountTTC) <= 0) {
    reasons.push("Indiquez le montant TTC de la facture.");
  }

  if (lines.length === 0) {
    reasons.push("La pièce n'a aucune ligne de ventilation.");
  } else {
    if (lines.some((line) => round2(line.amount) <= 0)) {
      reasons.push("Une ligne de ventilation est à zéro : retirez-la ou donnez-lui un montant.");
    }

    const balance = balanceOf(lines);
    if (Math.abs(balance.difference) > TOLERANCE) {
      reasons.push(
        balance.difference > 0
          ? `La ventilation n'est pas équilibrée : il manque ${euro(balance.difference)} au crédit.`
          : `La ventilation n'est pas équilibrée : il manque ${euro(-balance.difference)} au débit.`,
      );
    } else if (round2(header.amountTTC) > 0) {
      // Balanced, but balanced around the wrong figure: the third party's side
      // has to carry exactly what the invoice says is owed.
      const side: EntrySide = header.kind === "ACHAT" ? "C" : "D";
      const ventilated = ventilationTotal(lines, side);
      if (Math.abs(ventilated - round2(header.amountTTC)) > TOLERANCE) {
        reasons.push(
          `La ventilation totalise ${euro(ventilated)} alors que la facture est de ${euro(header.amountTTC)}.`,
        );
      }
    }
  }

  if (!check.hasDocument) reasons.push("La pièce n'a pas de justificatif : joignez la facture.");
  if (check.closedPeriod) reasons.push("La date d'écriture tombe dans un exercice clos.");

  return reasons;
};

// ------------------------------------------------------------ intangibilité ---

/** A posted piece is never modified — it is reversed. */
export const canEdit = (status: PieceStatus): boolean => status !== "COMPTABILISEE";

/**
 * The mirror entry. Nothing moves but the side: same accounts, same amounts,
 * so that the two together leave the accounts exactly as they were.
 */
export const reverseLines = (lines: readonly VentilationLine[]): VentilationLine[] =>
  lines.map((line) => ({ ...line, side: line.side === "D" ? "C" : "D" }));

// --------------------------------------------------------------- numérotation ---

/**
 * « 202512000001 » — the month, then a rank within it. The rank is handed out
 * when the piece is posted, never when it is opened: a number reserved by a
 * draft that is abandoned would leave a hole, and a sequence with holes is the
 * first thing an inspection asks about.
 */
export const pieceNumber = (entryDate: string, rank: number): string =>
  `${entryDate.slice(0, 4)}${entryDate.slice(5, 7)}${String(rank).padStart(6, "0")}`;

/** « Auchan - 12/25 ». */
export const defaultLabel = (thirdPartyName: string, entryDate: string): string =>
  `${thirdPartyName.trim()} - ${entryDate.slice(5, 7)}/${entryDate.slice(2, 4)}`;
