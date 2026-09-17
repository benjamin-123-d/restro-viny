import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { balanceOf } from "../src/lib/accounting-rules";
import {
  listAccounts,
  listInbox,
  openPiece,
  postPiece,
  reversePiece,
  savePiece,
  syncInbox,
} from "../src/services/accounting-encoding.service";

/**
 * Walks one invoice the whole way on the real database: the bannette is filled,
 * a piece is opened, its proposed ventilation checked, saved, posted, found
 * locked, then reversed — and everything the run wrote is removed afterwards,
 * so the restaurant's books are exactly as they were.
 *
 *   npx tsx scripts/e2e-encodage.ts
 */

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

const euro = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

const run = async () => {
  const restaurant = await prisma.restaurant.findFirst({
    where: { deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!restaurant) throw new Error("Aucun restaurant.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };

  const accountsBefore = (await listAccounts(ctx)).length;
  const { added } = await syncInbox(ctx);
  console.log(`Bannette : ${added} pièce(s) ajoutée(s), ${accountsBefore} comptes au plan.`);

  // A supplier invoice with its scan is the richest case; a customer invoice is
  // its own justification, so it works too when no scan has been imported yet.
  const inbox = await listInbox(ctx);
  const encodable = inbox.filter((row) => row.hasDocument && row.amountTTC > 0 && row.status !== "COMPTABILISEE");
  const target = encodable.find((row) => row.kind === "ACHAT") ?? encodable[0];
  if (!target) {
    console.log("Aucune facture à encoder — rien à vérifier.");
    return;
  }
  console.log(`Pièce suivie : ${target.kind} — ${target.thirdPartyName} — ${euro(target.amountTTC)}`);

  const opened = await openPiece(ctx, target.id);
  const proposed = balanceOf(opened.lines);

  await savePiece(ctx, {
    id: opened.id,
    thirdPartyName: opened.header.thirdPartyName,
    auxiliaryCode: opened.header.auxiliaryCode ?? undefined,
    invoiceNumber: opened.header.invoiceNumber ?? undefined,
    invoiceDate: opened.header.invoiceDate,
    dueDate: opened.header.dueDate || undefined,
    entryDate: opened.header.entryDate,
    amountTTC: opened.header.amountTTC,
    amountHT: opened.header.amountHT,
    vatRate: opened.header.vatRate,
    amountVAT: opened.header.amountVAT,
    label: opened.header.label,
    isCca: false,
    isPaid: opened.payment.isPaid,
    lines: opened.lines.map((line) => ({
      accountCode: line.accountCode,
      auxiliaryCode: line.auxiliaryCode ?? undefined,
      auxiliaryName: line.auxiliaryName ?? undefined,
      label: line.label ?? undefined,
      side: line.side,
      amount: line.amount,
    })),
  });

  const posted = await postPiece(ctx, opened.id);
  const afterPost = await openPiece(ctx, opened.id);

  let refusedSecondPost = false;
  try {
    await postPiece(ctx, opened.id);
  } catch {
    refusedSecondPost = true;
  }

  const { journalEntryId } = await prisma.accountingPiece.findUniqueOrThrow({
    where: { id: opened.id },
    select: { journalEntryId: true },
  });
  if (!journalEntryId) throw new Error("La pièce n'a pas d'écriture après comptabilisation.");
  const entry = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: journalEntryId },
    include: { lines: true },
  });

  await reversePiece(ctx, opened.id);
  const afterReverse = await openPiece(ctx, opened.id);

  const checks: [string, boolean, string][] = [
    ["La ventilation proposée est équilibrée", Math.abs(proposed.difference) < 0.005, euro(proposed.debit)],
    ["Elle totalise le montant de la facture", Math.abs(proposed.credit - opened.header.amountTTC) < 0.005, euro(proposed.credit)],
    ["Trois lignes : fournisseur, TVA, charge", opened.lines.length >= 2, `${opened.lines.length}`],
    ["Le numéro de pièce est du mois de l'écriture", posted.number.startsWith(opened.header.entryDate.slice(0, 4) + opened.header.entryDate.slice(5, 7)), posted.number],
    ["Le numéro fait douze chiffres", /^\d{12}$/.test(posted.number), posted.number],
    ["L'écriture est comptabilisée", entry.status === "POSTED", entry.status],
    ["Débit = crédit dans l'écriture", Number(entry.totalDebit) === Number(entry.totalCredit), euro(Number(entry.totalDebit))],
    ["La pièce comptabilisée est verrouillée", afterPost.editable === false, `${afterPost.editable}`],
    ["Une deuxième comptabilisation est refusée", refusedSecondPost, `${refusedSecondPost}`],
    ["La contre-passation rouvre la pièce", afterReverse.editable === true, afterReverse.status],
  ];

  let failed = 0;
  for (const [label, ok, value] of checks) {
    console.log(`${ok ? "OK  " : "ÉCHEC"} ${label} : ${value}`);
    if (!ok) failed += 1;
  }

  // Nettoyage : la pièce reste dans la bannette, mais rien de ce que l'essai a
  // écrit ne demeure dans les comptes.
  await prisma.gLEntry.deleteMany({ where: { journalEntryId: entry.id } });
  await prisma.accountingPiece.update({
    where: { id: opened.id },
    data: { journalEntryId: null, status: "A_TRAITER", postedAt: null },
  });
  await prisma.accountingPieceEvent.deleteMany({ where: { pieceId: opened.id } });
  await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: entry.id } });
  await prisma.journalEntry.delete({ where: { id: entry.id } });

  console.log("\nNettoyage : écriture de test retirée, la pièce est revenue « à traiter ».");
  console.log(failed === 0 ? "Tout est conforme." : `${failed} vérification(s) en échec.`);
  if (failed > 0) process.exitCode = 1;
};

run()
  .catch(async (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
