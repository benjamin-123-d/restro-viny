"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format";
import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

import type { FieldOption } from "./entity-form";

/**
 * Record money paid out or received, and say which open invoices it settles.
 * Invoices are listed for the chosen party only, oldest due first, with a
 * one-click "settle in full" so the common case is one tap per invoice.
 */

export interface OpenInvoice {
  readonly id: string;
  readonly number: string;
  readonly dueDate: string;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
}

const MODES: readonly FieldOption[] = [
  { value: "CASH", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "CARD", label: "Carte" },
  { value: "OTHER", label: "Autre" },
];

const n = (v: string): number => {
  const parsed = Number(v.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const inputClass =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const PaymentForm = ({
  direction,
  parties,
  openInvoices,
  action,
  redirectTo,
}: {
  /** "pay" = to a supplier; "receive" = from a customer. */
  direction: "pay" | "receive";
  parties: readonly FieldOption[];
  /** Open invoices keyed by party id. */
  openInvoices: Readonly<Record<string, readonly OpenInvoice[]>>;
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  redirectTo: string;
}) => {
  const router = useRouter();
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invoiceField =
    direction === "pay" ? "purchaseInvoiceId" : "salesInvoiceId";
  const partyField = direction === "pay" ? "supplierId" : "customerId";
  const invoices = party ? (openInvoices[party] ?? []) : [];

  const allocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + n(v), 0),
    [allocations],
  );
  const leftOver = n(amount) - allocated;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await action({
        [partyField]: party || undefined,
        amount: n(amount),
        mode,
        ...(referenceNo && { referenceNo }),
        allocations: Object.entries(allocations)
          .filter(([, v]) => n(v) > 0)
          .map(([id, v]) => ({ [invoiceField]: id, amount: n(v) })),
      });
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <fieldset
        className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2"
        disabled={pending}
      >
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          1. Le paiement
        </legend>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            {direction === "pay" ? "Fournisseur payé" : "Client qui paie"}
            <span className="text-red-600"> *</span>
          </label>
          <select
            value={party}
            onChange={(e) => {
              setParty(e.target.value);
              setAllocations({});
            }}
            className={inputClass}
          >
            <option value="">— Choisir —</option>
            {parties.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Ses factures non réglées s&apos;affichent dessous.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Montant<span className="text-red-600"> *</span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            La somme réellement {direction === "pay" ? "versée" : "encaissée"}.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Moyen de paiement
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={inputClass}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Référence
          </label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="ex. n° de virement, de chèque, de transaction MoMo"
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          2. Factures réglées
        </legend>
        {!party ? (
          <p className="text-sm text-zinc-500">
            Choisissez d&apos;abord{" "}
            {direction === "pay" ? "le fournisseur" : "le client"}.
          </p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucune facture ouverte. Le montant sera gardé « en compte » et
            pourra être affecté plus tard.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 font-medium">Facture</th>
                  <th className="py-2 font-medium">Échéance</th>
                  <th className="py-2 text-right font-medium">Reste dû</th>
                  <th className="w-40 py-2 pl-3 font-medium">Affecter</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{inv.number}</td>
                    <td className="py-2">
                      {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                      {inv.daysOverdue > 0 && (
                        <span className="ml-1 text-xs font-medium text-red-600">
                          +{inv.daysOverdue}j
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(inv.outstandingAmount)}
                    </td>
                    <td className="py-2 pl-3">
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          max={inv.outstandingAmount}
                          value={allocations[inv.id] ?? ""}
                          onChange={(e) =>
                            setAllocations((a) => ({
                              ...a,
                              [inv.id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAllocations((a) => ({
                              ...a,
                              [inv.id]: String(inv.outstandingAmount),
                            }))
                          }
                          className="rounded border px-2 text-xs text-zinc-600 hover:bg-zinc-50"
                          title="Solder cette facture"
                        >
                          Tout
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              className={`mt-3 rounded-md px-3 py-2 text-sm ${leftOver < -0.005 ? "bg-red-50 text-red-700" : "bg-zinc-50 text-zinc-700"}`}
            >
              Affecté {formatCurrency(allocated)} sur{" "}
              {formatCurrency(n(amount))}
              {leftOver < -0.005
                ? " — vous affectez plus que le montant payé."
                : leftOver > 0.005
                  ? ` — ${formatCurrency(leftOver)} resteront en compte.`
                  : "."}
            </p>
          </>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || leftOver < -0.005}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40"
        >
          {pending
            ? "Enregistrement…"
            : direction === "pay"
              ? "Enregistrer le paiement"
              : "Enregistrer l'encaissement"}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-md border px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
};
