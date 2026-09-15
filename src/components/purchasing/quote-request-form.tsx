"use client";

import { CheckCircle2Icon, MailIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { sendQuoteRequestsAction } from "@/actions/supplier-documents.actions";
import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { humanError } from "@/lib/error-messages";
import { buildQuoteRequest } from "@/lib/supplier-documents";
import { cn } from "@/lib/utils";
import type { QuoteRequestResultDTO } from "@/types/purchasing";

export interface QuoteSupplier {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly contactPerson: string | null;
}

export interface QuoteCatalogueItem {
  readonly name: string;
  readonly unit: string;
}

interface Line {
  key: number;
  name: string;
  quantity: string;
  unit: string;
}

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, name: "", quantity: "", unit: "" });

const RESULT_COPY: Readonly<Record<QuoteRequestResultDTO["status"], string>> = {
  SENT: "E-mail envoyé",
  MAILTO: "À envoyer depuis votre messagerie",
  FAILED: "L'envoi automatique a échoué",
  NO_EMAIL: "Pas d'adresse e-mail dans la fiche fournisseur",
};

/**
 * Ask one or several suppliers for a price: tick them, list what you need,
 * check the email, send. Suppliers answer to the restaurant's own address;
 * their quote is then imported from the Devis reçus tab.
 */
export function QuoteRequestForm({
  suppliers,
  catalogue,
  restaurantName,
  restaurantPhone,
}: {
  readonly suppliers: readonly QuoteSupplier[];
  readonly catalogue: readonly QuoteCatalogueItem[];
  readonly restaurantName: string;
  readonly restaurantPhone: string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [neededBy, setNeededBy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QuoteRequestResultDTO[] | null>(null);
  const [pending, startTransition] = useTransition();

  const filled = lines
    .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity.replace(",", ".")), unit: l.unit.trim() }))
    .filter((l) => l.name && l.quantity > 0);

  const firstSupplier = suppliers.find((s) => s.id === selected[0]);
  const preview = useMemo(
    () =>
      buildQuoteRequest({
        restaurantName,
        senderName: null,
        senderPhone: restaurantPhone,
        supplierName: firstSupplier?.name ?? "",
        contactPerson: firstSupplier?.contactPerson ?? null,
        lines: filled,
        message: message.trim() || null,
        neededBy: neededBy ? new Date(`${neededBy}T12:00:00Z`) : null,
      }),
    [restaurantName, restaurantPhone, firstSupplier, filled, message, neededBy],
  );

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Picking a known product fills in its unit.
        if (patch.name !== undefined && !l.unit) {
          const known = catalogue.find((c) => c.name.toLowerCase() === patch.name?.trim().toLowerCase());
          if (known) next.unit = known.unit;
        }
        return next;
      }),
    );

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendQuoteRequestsAction({
        supplierIds: selected,
        lines: filled,
        message: message.trim(),
        neededBy,
      });
      if (!result.success || !result.data) {
        const firstField = Object.values(result.fieldErrors ?? {})[0]?.[0];
        setError(firstField ?? humanError(result.error));
        return;
      }
      setResults(result.data);
    });
  };

  if (results) {
    return (
      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
        <h2 className="text-base font-semibold">Demande envoyée</h2>
        <ul className="flex flex-col divide-y rounded-lg border">
          {results.map((r) => (
            <li key={r.supplierId} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              {r.status === "SENT" ? (
                <CheckCircle2Icon className="size-5 text-emerald-600" aria-hidden />
              ) : (
                <TriangleAlertIcon className="size-5 text-amber-600" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.supplierName}</p>
                <p className="text-xs text-muted-foreground">
                  {RESULT_COPY[r.status]}
                  {r.toEmail ? ` · ${r.toEmail}` : ""}
                  {r.error ? ` (${r.error})` : ""}
                </p>
              </div>
              {r.mailto && r.status !== "SENT" ? (
                <a
                  href={r.mailto}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  <MailIcon className="size-3.5" aria-hidden />
                  Ouvrir l&apos;e-mail prêt
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Quand le fournisseur répond, importez son devis depuis « Devis reçus » → « Importer un devis ».
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResults(null)}>
            Nouvelle demande
          </Button>
          <Link href="/dashboard/purchasing/quotations/new" className="inline-flex items-center rounded-md bg-foreground px-3 text-sm font-medium text-background">
            Importer un devis reçu
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">1. À quels fournisseurs ?</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun fournisseur : créez-en un dans l&apos;onglet Fournisseurs.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm",
                      selected.includes(s.id) && "border-foreground bg-muted",
                    )}
                  >
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-medium">{s.name}</span>
                      <span className={cn("block truncate text-xs", s.email ? "text-muted-foreground" : "text-amber-700")}>
                        {s.email ?? "pas d'adresse e-mail"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">2. De quoi avez-vous besoin ?</h2>
          <datalist id="quote-catalogue">
            {catalogue.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_6rem_2rem] gap-2">
                <Input
                  list="quote-catalogue"
                  value={line.name}
                  onChange={(e) => setLine(line.key, { name: e.target.value })}
                  placeholder="Produit (ex. tomates)"
                  aria-label="Produit"
                />
                <Input
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                  placeholder="Qté"
                  aria-label="Quantité"
                  className="text-right"
                />
                <Input
                  value={line.unit}
                  onChange={(e) => setLine(line.key, { unit: e.target.value })}
                  placeholder="Unité"
                  aria-label="Unité"
                />
                <button
                  type="button"
                  onClick={() => setLines((c) => (c.length > 1 ? c.filter((l) => l.key !== line.key) : [emptyLine()]))}
                  className="flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Retirer la ligne"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((c) => [...c, emptyLine()])}>
            <PlusIcon className="size-4" aria-hidden />
            Ajouter un produit
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="quote-needed" className="text-sm font-medium">
                Réponse souhaitée avant le
              </label>
              <Input id="quote-needed" type="date" className="mt-1.5" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="quote-message" className="text-sm font-medium">
              Précisions
            </label>
            <Textarea
              id="quote-message"
              className="mt-1.5"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex. : livraison le mardi matin, conditionnement en cagettes de 5 kg."
            />
            <FieldHint>Tout ce que le fournisseur doit savoir pour chiffrer juste.</FieldHint>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-sm font-semibold">3. Vérifiez et envoyez</h2>
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="text-xs text-muted-foreground">Objet</p>
          <p className="font-medium">{preview.subject}</p>
          <p className="mt-2 text-xs text-muted-foreground">Message</p>
          <pre className="mt-1 max-h-80 overflow-auto font-sans text-sm whitespace-pre-wrap">{preview.body}</pre>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" onClick={send} disabled={pending || selected.length === 0}>
          <MailIcon className="size-4" aria-hidden />
          {pending
            ? "Envoi…"
            : selected.length > 1
              ? `Envoyer aux ${selected.length} fournisseurs`
              : "Envoyer la demande"}
        </Button>
        <FieldHint>
          Chaque fournisseur reçoit son propre e-mail et répond directement à l&apos;adresse du restaurant.
        </FieldHint>
      </aside>
    </div>
  );
}
