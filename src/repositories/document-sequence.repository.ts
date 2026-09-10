import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** The purchasing document types that draw a number from a sequence. */
export type PurchaseDocType =
  | "RFQ"
  | "SQTN"
  | "PO"
  | "PREC"
  | "PINV"
  | "PPAY"
  | "SQTE"
  | "SO"
  | "DN"
  | "SINV"
  | "CPAY"
  | "MREQ"
  | "STE"
  | "STRECO"
  | "JV";

const PREFIX: Readonly<Record<PurchaseDocType, string>> = {
  RFQ: "RFQ",
  SQTN: "SQ",
  PO: "PO",
  PREC: "PR",
  PINV: "PI",
  PPAY: "PAY",
  SQTE: "QTN",
  SO: "SO",
  DN: "DN",
  SINV: "SINV",
  CPAY: "REC",
  MREQ: "MR",
  STE: "STE",
  STRECO: "REC-CNT",
  JV: "JV",
};

const format = (docType: PurchaseDocType, value: number): string =>
  `${PREFIX[docType]}-${String(value).padStart(5, "0")}`;

/**
 * Claim the next number for a document type, atomically.
 *
 * `upsert` + `increment` means two concurrent creates can never be handed the
 * same number: the row is locked for the duration of the update, and the
 * `@@unique([restaurantId, docType])` constraint makes the insert race safe
 * too. Runs inside the caller's transaction when one is supplied, so a rolled
 * back document does not burn a number.
 */
export const claimDocumentNumber = async (
  restaurantId: string,
  docType: PurchaseDocType,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> => {
  const row = await tx.documentSequence.upsert({
    where: { restaurantId_docType: { restaurantId, docType } },
    create: { restaurantId, docType, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  // `create` seeds nextValue at 2 having just handed out 1; `update` returns
  // the already-incremented value, so the number issued is one below it.
  const issued = row.nextValue - 1;
  return format(docType, issued);
};

/** Read the number a document type would issue next, without consuming it. */
export const peekDocumentNumber = async (
  restaurantId: string,
  docType: PurchaseDocType,
): Promise<string> => {
  const row = await prisma.documentSequence.findUnique({
    where: { restaurantId_docType: { restaurantId, docType } },
    select: { nextValue: true },
  });
  return format(docType, row?.nextValue ?? 1);
};
