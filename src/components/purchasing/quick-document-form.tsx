"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";
import { formatCurrency } from "@/lib/format";
import { splitDocumentTotal } from "@/lib/supplier-documents";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types";
import type { PurchaseDocumentKind } from "@/types/purchasing";

import { DocumentPicker, type PickedDocument } from "./document-picker";

export interface SupplierOption {
  readonly value: string;
  readonly label: string;
  readonly paymentTermsDays: number | null;
}

type VatMode = "rate" | "amount" | "none";

/** The rates found on French supplier invoices, most common first. */
const RATES = [5.5, 20, 10, 2.1, 8.5];

const COPY: Readonly<
  Record<
    PurchaseDocumentKind,
    {
      reference: { name: string; label: string; hint: string; placeholder: string };
      date: { name: string; label: string; hint: string };
      second: { name: string; label: string; hint: string };
      submit: string;
      done: string;
    }
  >
> = {
  QUOTATION: {
    reference: {
      name: "supplierReference",
      label: "Référence du devis",
      hint: "Le numéro imprimé par le fournisseur, pour le retrouver.",
      placeholder: "DEV-2026-118",
    },
    date: { name: "transactionDate", label: "Date du devis", hint: "Vide : aujourd'hui." },
    second: { name: "validUntil", label: "Valable jusqu'au", hint: "La date limite de l'offre, si elle est indiquée." },
    submit: "Enregistrer le devis",
    done: "Devis enregistré",
  },
  INVOICE: {
    reference: {
      name: "supplierInvoiceNo",
      label: "N° de la facture fournisseur",
      hint: "Le numéro imprimé sur la facture.",
      placeholder: "FA-2026-0412",
    },
    date: { name: "postingDate", label: "Date de la facture", hint: "Vide : aujourd'hui." },
    second: {
      name: "dueDate",
      label: "Date d'échéance",
      hint: "Vide : calculée avec le délai de paiement du fournisseur.",
    },
    submit: "Enregistrer la facture",
    done: "Facture enregistrée",
  },
};

const toNumber = (value: string): number | null => {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() === "" || Number.isNaN(n) ? null : n;
};

/**
 * Record a supplier's quote or invoice from its document: attach the PDF or
 * photo, pick the supplier, type the total. HT and VAT are worked out live
 * from the VAT rate or amount so the owner can check them against the paper.
 */
export function QuickDocumentForm({
  kind,
  suppliers,
  action,
  detailHref,
}: {
  readonly kind: PurchaseDocumentKind;
  readonly suppliers: readonly SupplierOption[];
  readonly action: (formData: FormData) => Promise<ActionResult<{ id: string; number: string }>>;
  /** Where to go once saved; "{id}" is replaced by the new record's id. */
  readonly detailHref: string;
}) {
  const copy = COPY[kind];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [second, setSecond] = useState("");
  const [total, setTotal] = useState("");
  const [vatMode, setVatMode] = useState<VatMode>("rate");
  const [vatRate, setVatRate] = useState(5.5);
  const [vatAmount, setVatAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supplier = suppliers.find((s) => s.value === supplierId);
  const totalValue = toNumber(total);
  const split = useMemo(() => {
    if (totalValue == null || totalValue <= 0) return null;
    try {
      return splitDocumentTotal({
        totalTTC: totalValue,
        vatRate: vatMode === "rate" ? vatRate : null,
        vatAmount: vatMode === "amount" ? toNumber(vatAmount) : vatMode === "none" ? 0 : null,
      });
    } catch {
      return null;
    }
  }, [totalValue, vatMode, vatRate, vatAmount]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const form = new FormData();
    form.set("supplierId", supplierId);
    form.set(copy.reference.name, reference);
    form.set(copy.date.name, date);
    form.set(copy.second.name, second);
    form.set("totalTTC", totalValue == null ? "" : String(totalValue));
    if (vatMode === "rate") form.set("vatRate", String(vatRate));
    if (vatMode === "amount") form.set("vatAmount", String(toNumber(vatAmount) ?? ""));
    if (vatMode === "none") form.set("vatAmount", "0");
    form.set("notes", notes);
    form.set("source", document?.source ?? "FILE");
    if (document) form.set("file", document.file);

    startTransition(async () => {
      const result = await action(form);
      if (!result.success || !result.data) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])),
        );
        toast.error(humanError(result.error));
        return;
      }
      toast.success(`${copy.done} (${result.data.number})`);
      router.push(detailHref.replace("{id}", result.data.id));
    });
  };

  const fieldError = (name: string) =>
    errors[name] ? <p className="mt-1 text-xs text-destructive">{errors[name]}</p> : null;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">1. Le document</h2>
        <DocumentPicker value={document} onChange={setDocument} error={errors.file} />
        <FieldHint>
          Facultatif mais conseillé : le document reste attaché et consultable à tout moment.
        </FieldHint>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">2. Ce qu&apos;il dit</h2>

        <div>
          <label htmlFor="quick-supplier" className="text-sm font-medium">
            Fournisseur <span className="text-destructive">*</span>
          </label>
          <select
            id="quick-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Choisir…</option>
            {suppliers.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {fieldError("supplierId") ?? (
            <FieldHint>
              {suppliers.length === 0
                ? "Aucun fournisseur : créez-le d'abord dans l'onglet Fournisseurs."
                : kind === "INVOICE" && supplier?.paymentTermsDays
                  ? `Délai de paiement de ce fournisseur : ${supplier.paymentTermsDays} jours.`
                  : "Celui qui vous a envoyé le document."}
            </FieldHint>
          )}
        </div>

        <div>
          <label htmlFor="quick-ref" className="text-sm font-medium">
            {copy.reference.label}
          </label>
          <Input
            id="quick-ref"
            className="mt-1.5"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={copy.reference.placeholder}
          />
          {fieldError(copy.reference.name) ?? <FieldHint>{copy.reference.hint}</FieldHint>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quick-date" className="text-sm font-medium">
              {copy.date.label}
            </label>
            <Input id="quick-date" type="date" className="mt-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
            {fieldError(copy.date.name) ?? <FieldHint>{copy.date.hint}</FieldHint>}
          </div>
          <div>
            <label htmlFor="quick-second" className="text-sm font-medium">
              {copy.second.label}
            </label>
            <Input id="quick-second" type="date" className="mt-1.5" value={second} onChange={(e) => setSecond(e.target.value)} />
            {fieldError(copy.second.name) ?? <FieldHint>{copy.second.hint}</FieldHint>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quick-total" className="text-sm font-medium">
              Total TTC (€) <span className="text-destructive">*</span>
            </label>
            <Input
              id="quick-total"
              inputMode="decimal"
              className="mt-1.5 text-right text-base font-semibold tabular-nums"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0,00"
              required
            />
            {fieldError("totalTTC") ?? <FieldHint>Le « Net à payer » en bas du document.</FieldHint>}
          </div>

          <fieldset>
            <legend className="text-sm font-medium">TVA</legend>
            <div className="mt-1.5 flex rounded-md bg-muted p-0.5 text-xs font-medium" role="radiogroup">
              {(
                [
                  ["rate", "Par taux"],
                  ["amount", "Montant"],
                  ["none", "Sans TVA"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={vatMode === mode}
                  onClick={() => setVatMode(mode)}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5",
                    vatMode === mode ? "bg-background shadow-xs" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {vatMode === "rate" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setVatRate(rate)}
                    aria-pressed={vatRate === rate}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs tabular-nums",
                      vatRate === rate ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                    )}
                  >
                    {rate.toLocaleString("fr-FR")} %
                  </button>
                ))}
              </div>
            ) : vatMode === "amount" ? (
              <Input
                inputMode="decimal"
                className="mt-2 text-right tabular-nums"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                placeholder="Montant de TVA (€)"
                aria-label="Montant de TVA"
              />
            ) : null}
            {fieldError("vatAmount") ?? (
              <FieldHint>
                {vatMode === "rate"
                  ? "Alimentaire : 5,5 % · boissons alcoolisées, matériel : 20 %."
                  : vatMode === "amount"
                    ? "Plusieurs taux sur la facture ? Additionnez les montants de TVA."
                    : "Fournisseur non assujetti (micro-entreprise) ou achat exonéré."}
              </FieldHint>
            )}
          </fieldset>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center text-sm" aria-live="polite">
          <div>
            <p className="text-xs text-muted-foreground">Total HT</p>
            <p className="font-semibold tabular-nums">{split ? formatCurrency(split.ht) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TVA</p>
            <p className="font-semibold tabular-nums">{split ? formatCurrency(split.vat) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total TTC</p>
            <p className="font-semibold tabular-nums">{split ? formatCurrency(split.ttc) : "—"}</p>
          </div>
        </div>

        <div>
          <label htmlFor="quick-notes" className="text-sm font-medium">
            Remarques
          </label>
          <Textarea
            id="quick-notes"
            className="mt-1.5"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={kind === "INVOICE" ? "Ex. : livraison du 12/09, 2 cartons de tomates." : "Ex. : franco de port dès 150 € HT."}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || suppliers.length === 0}>
            {pending ? "Enregistrement…" : copy.submit}
          </Button>
        </div>
      </section>
      <Toaster />
    </form>
  );
}
