"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  PlusIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { postPieceAction, reversePieceAction, savePieceAction } from "@/actions/accounting-encoding.actions";
import { AccountCombobox, type AccountOption } from "@/components/accounting/account-combobox";
import { PieceViewer } from "@/components/accounting/piece-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { balanceOf, proposeVentilation, type EntrySide, type VentilationLine } from "@/lib/accounting-rules";
import { blockingReasons } from "@/lib/accounting-rules";
import { splitTTC } from "@/lib/expense-breakdown-state";
import { humanError } from "@/lib/error-messages";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OpenedPiece } from "@/services/accounting-encoding.service";

const VAT_RATES = [0, 2.1, 5.5, 10, 20];

const PAYMENT_MODES = [
  { value: "BANK_TRANSFER", label: "Virement" },
  { value: "CARD", label: "Carte bancaire" },
  { value: "CASH", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "OTHER", label: "Autre" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  A_TRAITER: "bg-muted text-muted-foreground",
  ENREGISTREE: "bg-accent text-accent-foreground",
  COMPTABILISEE: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
};

const STATUS_LABEL: Record<string, string> = {
  A_TRAITER: "À TRAITER",
  ENREGISTREE: "ENREGISTRÉE",
  COMPTABILISEE: "COMPTABILISÉE",
};

const num = (value: string): number => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: number): string => (value === 0 ? "" : value.toFixed(2).replace(".", ","));

type Row = VentilationLine & { readonly key: string; readonly accountName: string };

let seq = 0;
const toRow = (line: VentilationLine, accounts: readonly AccountOption[]): Row => ({
  ...line,
  key: `l-${seq++}`,
  accountName: accounts.find((account) => account.code === line.accountCode)?.name ?? "",
});

/** A label with the green tick the automatic reading earned. */
function FieldLabel({ children, read }: { readonly children: React.ReactNode; readonly read?: boolean }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
      {children}
      {read ? <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="rempli automatiquement" /> : null}
    </span>
  );
}

/**
 * L'encodage — the piece on the left, what it becomes on the right.
 *
 * Everything on this screen is a proposal until the accountant posts it. The
 * amounts recompute, the ventilation regenerates, the account is suggested —
 * but the moment they touch a line, nothing regenerates behind their back.
 */
export function PieceScreen({
  piece,
  accounts: initialAccounts,
}: {
  readonly piece: OpenedPiece;
  readonly accounts: readonly AccountOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"details" | "historique" | "commentaires">("details");
  const [accounts, setAccounts] = useState<readonly AccountOption[]>(initialAccounts);
  const [saving, startSaving] = useTransition();

  const [form, setForm] = useState({
    thirdPartyName: piece.header.thirdPartyName,
    auxiliaryCode: piece.header.auxiliaryCode ?? "",
    invoiceNumber: piece.header.invoiceNumber ?? "",
    invoiceDate: piece.header.invoiceDate,
    dueDate: piece.header.dueDate,
    entryDate: piece.header.entryDate,
    amountTTC: text(piece.header.amountTTC),
    amountHT: text(piece.header.amountHT),
    vatRate: piece.header.vatRate ?? 20,
    amountVAT: text(piece.header.amountVAT),
    label: piece.header.label,
    isCca: piece.header.isCca,
    isPaid: piece.payment.isPaid,
    paymentMode: piece.payment.mode ?? "BANK_TRANSFER",
    paidOn: piece.payment.paidOn,
  });
  const [lines, setLines] = useState<readonly Row[]>(() => piece.lines.map((line) => toRow(line, initialAccounts)));
  // Once a line is touched by hand, the amounts stop rewriting the ventilation.
  const [linesTouched, setLinesTouched] = useState(false);

  const editable = piece.editable;
  const read = (field: string) => piece.readFields.includes(field);
  // A rate the invoice actually carries stays offered even when it is not one of
  // the standard French ones — otherwise the select silently shows 0 % and the
  // accountant reads a VAT figure that disagrees with the rate beside it.
  const rates = VAT_RATES.includes(form.vatRate) ? VAT_RATES : [...VAT_RATES, form.vatRate].sort((a, b) => a - b);

  const header = {
    kind: piece.kind,
    thirdPartyName: form.thirdPartyName,
    invoiceDate: form.invoiceDate,
    entryDate: form.entryDate,
    amountTTC: num(form.amountTTC),
    amountHT: num(form.amountHT),
    vatRate: form.vatRate,
    amountVAT: num(form.amountVAT),
    isCca: form.isCca,
  };
  const balance = balanceOf(lines);
  const blocking = blockingReasons({
    header,
    lines,
    hasDocument: piece.document != null || piece.salesInvoiceId != null,
    closedPeriod: false,
  });

  /** TTC and the rate are what a person reads off a ticket; HT and VAT follow. */
  const setTotals = (ttc: number, rate: number) => {
    const split = splitTTC(ttc, rate);
    setForm((current) => ({
      ...current,
      amountTTC: text(ttc),
      vatRate: rate,
      amountHT: text(split.amountHT),
      amountVAT: text(split.vatAmount),
    }));
    if (!linesTouched) {
      const charge = lines.find(
        (line) => !line.accountCode.startsWith("401") && !line.accountCode.startsWith("411") && !line.accountCode.startsWith("445"),
      );
      setLines(
        proposeVentilation(
          { ...header, amountTTC: ttc, amountHT: split.amountHT, amountVAT: split.vatAmount, vatRate: rate },
          {
            expenseAccount: charge?.accountCode,
            incomeAccount: charge?.accountCode,
            auxiliaryCode: form.auxiliaryCode || null,
            auxiliaryName: form.thirdPartyName,
            label: form.label,
          },
        ).map((line) => toRow(line, accounts)),
      );
    }
  };

  const patchLine = (key: string, patch: Partial<Row>) => {
    setLinesTouched(true);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const save = (then?: "post") =>
    startSaving(async () => {
      const result = await savePieceAction({
        id: piece.id,
        thirdPartyName: form.thirdPartyName,
        auxiliaryCode: form.auxiliaryCode || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        entryDate: form.entryDate,
        amountTTC: num(form.amountTTC),
        amountHT: num(form.amountHT),
        vatRate: form.vatRate,
        amountVAT: num(form.amountVAT),
        label: form.label || undefined,
        isCca: form.isCca,
        isPaid: form.isPaid,
        paymentMode: form.isPaid ? form.paymentMode : undefined,
        paidOn: form.isPaid ? form.paidOn || undefined : undefined,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountName || undefined,
          auxiliaryCode: line.auxiliaryCode ?? undefined,
          auxiliaryName: line.auxiliaryName ?? undefined,
          label: line.label ?? undefined,
          side: line.side,
          amount: line.amount,
        })),
      });
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      if (then !== "post") {
        toast.success("Pièce enregistrée.");
        router.refresh();
        return;
      }
      const posted = await postPieceAction({ id: piece.id });
      if (!posted.success) {
        toast.error(humanError(posted.error));
        return;
      }
      toast.success(`Pièce comptabilisée — n° ${posted.data?.number ?? ""}`);
      if (piece.queue.nextId) router.push(`/comptable/piece/${piece.queue.nextId}`);
      else router.refresh();
    });

  const reverse = () =>
    startSaving(async () => {
      const result = await reversePieceAction({ id: piece.id });
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      toast.success("Écriture contre-passée.");
      router.refresh();
    });

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------------ en-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/comptable" aria-label="Retour à la bannette" />}>
            <ChevronLeftIcon className="size-5" />
          </Button>
          <div>
            <h1 className="font-heading flex items-center gap-2 text-xl font-semibold">
              {piece.kind === "ACHAT" ? "Facture" : "Facture client"}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[piece.status])}>
                ● {STATUS_LABEL[piece.status]}
              </span>
            </h1>
            <p className="text-muted-foreground text-xs">
              {piece.pieceNumber ? `N° pièce ${piece.pieceNumber}` : "N° attribué à la comptabilisation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-muted-foreground mr-2 text-xs tabular-nums">
            {piece.queue.index} / {piece.queue.total}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={!piece.queue.previousId}
            render={
              piece.queue.previousId ? (
                <Link href={`/comptable/piece/${piece.queue.previousId}`} aria-label="Pièce précédente" />
              ) : undefined
            }
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!piece.queue.nextId}
            render={
              piece.queue.nextId ? (
                <Link href={`/comptable/piece/${piece.queue.nextId}`} aria-label="Pièce suivante" />
              ) : undefined
            }
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
        {/* ------------------------------------------------------ la pièce */}
        <PieceViewer
          documentId={piece.document?.id ?? null}
          fileName={piece.document?.fileName ?? null}
          mimeType={piece.document?.mimeType ?? null}
          selfJustified={piece.salesInvoiceId != null}
        />

        {/* ------------------------------------------------- ce qu'elle devient */}
        <div className="flex flex-col gap-4">
          <nav aria-label="Onglets de la pièce" className="flex gap-4 border-b">
            {(
              [
                ["details", "Détails facture"],
                ["historique", "Historique"],
                ["commentaires", "Commentaires"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-2 text-sm font-medium",
                  tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "historique" ? (
            <ul className="flex flex-col gap-2">
              {piece.events.length === 0 ? (
                <li className="text-muted-foreground text-sm">Rien encore.</li>
              ) : (
                piece.events.map((event) => (
                  <li key={event.id} className="rounded-lg border p-2 text-sm">
                    <span className="font-medium">{event.kind.toLowerCase()}</span>
                    {event.detail ? <span className="text-muted-foreground"> — {event.detail}</span> : null}
                    <span className="text-muted-foreground block text-xs">{formatDateTime(event.at)}</span>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {tab === "commentaires" ? (
            <p className="text-muted-foreground text-sm">
              Les commentaires arriveront ici : de quoi poser une question au gérant sans quitter la pièce.
            </p>
          ) : null}

          {tab === "details" ? (
            <div className="flex flex-col gap-4">
              {!editable ? (
                <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900">
                  <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Pièce comptabilisée : elle ne se modifie plus. Pour corriger, contre-passez l&apos;écriture — le
                    miroir s&apos;écrit et l&apos;original reste lisible.
                  </span>
                </p>
              ) : null}

              {/* --- tiers */}
              <div className="flex flex-col gap-1">
                <FieldLabel read={read("thirdPartyName")}>
                  {piece.kind === "ACHAT" ? "Nom du fournisseur" : "Nom du client"}
                </FieldLabel>
                <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                  <Input
                    value={form.thirdPartyName}
                    onChange={(event) => setForm((c) => ({ ...c, thirdPartyName: event.target.value }))}
                    disabled={!editable}
                  />
                  <Input
                    value={form.auxiliaryCode}
                    onChange={(event) => setForm((c) => ({ ...c, auxiliaryCode: event.target.value.toUpperCase() }))}
                    placeholder="Auxiliaire"
                    disabled={!editable}
                    className="tabular-nums"
                  />
                </div>
              </div>

              {/* --- dates et numéro */}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("invoiceDate")}>Date de facture</FieldLabel>
                  <Input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(event) => setForm((c) => ({ ...c, invoiceDate: event.target.value }))}
                    disabled={!editable}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("dueDate")}>Date d&apos;échéance</FieldLabel>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((c) => ({ ...c, dueDate: event.target.value }))}
                    disabled={!editable}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("invoiceNumber")}>N° facture</FieldLabel>
                  <Input
                    value={form.invoiceNumber}
                    onChange={(event) => setForm((c) => ({ ...c, invoiceNumber: event.target.value }))}
                    disabled={!editable}
                  />
                </label>
              </div>

              {/* --- montants */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("amountTTC")}>Montant TTC</FieldLabel>
                  <Input
                    value={form.amountTTC}
                    onChange={(event) => setForm((c) => ({ ...c, amountTTC: event.target.value }))}
                    onBlur={(event) => setTotals(num(event.target.value), form.vatRate)}
                    inputMode="decimal"
                    disabled={!editable}
                    className="text-right tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("amountHT")}>Montant HT</FieldLabel>
                  <Input
                    value={form.amountHT}
                    onChange={(event) => setForm((c) => ({ ...c, amountHT: event.target.value }))}
                    inputMode="decimal"
                    disabled={!editable}
                    className="text-right tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel>TVA</FieldLabel>
                  <select
                    value={form.vatRate}
                    onChange={(event) => setTotals(num(form.amountTTC), Number(event.target.value))}
                    disabled={!editable}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {rates.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate.toString().replace(".", ",")} %
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel read={read("amountVAT")}>Montant TVA</FieldLabel>
                  <Input
                    value={form.amountVAT}
                    onChange={(event) => setForm((c) => ({ ...c, amountVAT: event.target.value }))}
                    inputMode="decimal"
                    disabled={!editable}
                    className="text-right tabular-nums"
                  />
                </label>
              </div>

              {/* --- écriture */}
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1">
                  <FieldLabel>Date écriture</FieldLabel>
                  <Input
                    type="date"
                    value={form.entryDate}
                    onChange={(event) => setForm((c) => ({ ...c, entryDate: event.target.value }))}
                    disabled={!editable}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <FieldLabel>Libellé</FieldLabel>
                  <Input
                    value={form.label}
                    onChange={(event) => setForm((c) => ({ ...c, label: event.target.value }))}
                    disabled={!editable}
                  />
                </label>
                <label
                  className="flex items-center gap-2 pb-2 text-sm"
                  title="Charges constatées d'avance : la charge appartient à la période suivante."
                >
                  <input
                    type="checkbox"
                    checked={form.isCca}
                    onChange={(event) => setForm((c) => ({ ...c, isCca: event.target.checked }))}
                    disabled={!editable}
                    className="size-4"
                  />
                  CCA
                </label>
              </div>

              {/* --- ventilation */}
              <div className="flex flex-col gap-2">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[34rem] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground text-[11px] uppercase">
                        <th scope="col" className="px-2 py-2 text-left font-medium">Compte</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">Auxiliaire</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">Libellé</th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">Affectation (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.key} className="border-t align-top">
                          <td className="w-48 px-2 py-1.5">
                            <AccountCombobox
                              value={line.accountCode}
                              accounts={accounts}
                              disabled={!editable}
                              onChange={(code, name) => patchLine(line.key, { accountCode: code, accountName: name })}
                              onAccountsChanged={(account) =>
                                setAccounts((current) =>
                                  current.some((one) => one.code === account.code)
                                    ? current.map((one) => (one.code === account.code ? account : one))
                                    : [...current, account].sort((a, b) => a.code.localeCompare(b.code)),
                                )
                              }
                            />
                          </td>
                          <td className="w-28 px-2 py-1.5">
                            <Input
                              value={line.auxiliaryCode ?? ""}
                              onChange={(event) => patchLine(line.key, { auxiliaryCode: event.target.value.toUpperCase() })}
                              disabled={!editable}
                              className="h-9 tabular-nums"
                              aria-label="Auxiliaire"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={line.label ?? ""}
                              onChange={(event) => patchLine(line.key, { label: event.target.value })}
                              disabled={!editable}
                              className="h-9"
                              aria-label="Libellé de la ligne"
                            />
                          </td>
                          <td className="w-40 px-2 py-1.5">
                            <span className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => patchLine(line.key, { side: line.side === "D" ? "C" : ("D" as EntrySide) })}
                                disabled={!editable}
                                className={cn(
                                  "size-8 shrink-0 rounded-md text-sm font-semibold",
                                  line.side === "D"
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-secondary text-secondary-foreground",
                                )}
                                title={line.side === "D" ? "Débit" : "Crédit"}
                                aria-label={line.side === "D" ? "Débit, cliquer pour passer au crédit" : "Crédit, cliquer pour passer au débit"}
                              >
                                {line.side}
                              </button>
                              <Input
                                value={line.amount === 0 ? "" : line.amount.toFixed(2).replace(".", ",")}
                                onChange={(event) => patchLine(line.key, { amount: num(event.target.value) })}
                                disabled={!editable}
                                inputMode="decimal"
                                className="h-9 text-right tabular-nums"
                                aria-label="Affectation"
                              />
                              {editable ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinesTouched(true);
                                    setLines((current) => current.filter((one) => one.key !== line.key));
                                  }}
                                  className="text-muted-foreground shrink-0 rounded-md p-1 hover:bg-muted"
                                  aria-label="Retirer la ligne"
                                >
                                  <XIcon className="size-4" />
                                </button>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      setLinesTouched(true);
                      setLines((current) => [
                        ...current,
                        toRow(
                          { accountCode: "", auxiliaryCode: null, auxiliaryName: null, label: form.label, side: "D", amount: 0 },
                          accounts,
                        ),
                      ]);
                    }}
                  >
                    <PlusIcon className="size-4" aria-hidden />
                    Ajouter une ligne
                  </Button>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex gap-4">
                    <span>
                      Débit <strong className="tabular-nums">{formatCurrency(balance.debit)}</strong>
                    </span>
                    <span>
                      Crédit <strong className="tabular-nums">{formatCurrency(balance.credit)}</strong>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      Math.abs(balance.difference) <= 0.005
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
                    )}
                  >
                    {Math.abs(balance.difference) <= 0.005
                      ? "Équilibrée"
                      : `Écart de ${formatCurrency(Math.abs(balance.difference))}`}
                  </span>
                </div>
              </div>

              {/* --- paiement */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold">Paiement</h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={(event) => setForm((c) => ({ ...c, isPaid: event.target.checked }))}
                      disabled={!editable}
                      className="size-4"
                    />
                    Facture payée
                  </label>
                </div>
                {form.isPaid ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Mode de paiement</FieldLabel>
                      <select
                        value={form.paymentMode}
                        onChange={(event) => setForm((c) => ({ ...c, paymentMode: event.target.value }))}
                        disabled={!editable}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        {PAYMENT_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Date de paiement</FieldLabel>
                      <Input
                        type="date"
                        value={form.paidOn}
                        onChange={(event) => setForm((c) => ({ ...c, paidOn: event.target.value }))}
                        disabled={!editable}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              {/* --- ce qui bloque */}
              {editable && blocking.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
                  {blocking.map((reason) => (
                    <li key={reason} className="flex items-start gap-2">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* --- actions */}
              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 py-3 backdrop-blur">
                {editable ? (
                  <>
                    <Button variant="outline" onClick={() => save()} disabled={saving}>
                      Enregistrer
                    </Button>
                    <Button onClick={() => save("post")} disabled={saving || blocking.length > 0}>
                      {saving ? "En cours…" : "Comptabiliser"}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={reverse} disabled={saving}>
                    <Undo2Icon className="size-4" aria-hidden />
                    Contre-passer
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
