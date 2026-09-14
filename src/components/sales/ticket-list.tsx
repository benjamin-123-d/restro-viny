"use client";

import { PrinterIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { ServiceType } from "@/lib/french-vat";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TicketListRow } from "@/services/sales-analytics.service";

import { paymentName, SERVICE_NAME, SERVICE_ORDER, SERVICE_SWATCH } from "./sales-labels";

const PAGE = 25;

/**
 * Every invoice handed to a customer in the period, newest first, each one
 * reprintable as the original or as a duplicata.
 */
export function TicketList({ tickets }: { readonly tickets: readonly TicketListRow[] }) {
  const [service, setService] = useState<ServiceType | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        (service === "ALL" || t.service === service) &&
        (!q || t.number.toLowerCase().includes(q) || (t.tableLabel ?? "").toLowerCase().includes(q)),
    );
  }, [tickets, service, query]);

  const total = filtered.reduce((s, t) => s + t.ttc, 0);
  const counts = useMemo(() => {
    const c = new Map<ServiceType, number>();
    for (const t of tickets) c.set(t.service, (c.get(t.service) ?? 0) + 1);
    return c;
  }, [tickets]);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/10 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Factures de vente</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Les tickets remis aux clients sur la période. Réimprimez l&apos;original ou un duplicata.
          </p>
        </div>
        <div className="relative w-full sm:w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="N° de facture ou table"
            aria-label="Rechercher une facture"
            className="pl-8"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par service">
        {(["ALL", ...SERVICE_ORDER] as const).map((key) => {
          const count = key === "ALL" ? tickets.length : (counts.get(key) ?? 0);
          if (key !== "ALL" && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={service === key}
              onClick={() => {
                setService(key);
                setShown(PAGE);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                service === key
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key !== "ALL" ? (
                <span className={cn("size-2 rounded-[2px]", SERVICE_SWATCH[key])} aria-hidden />
              ) : null}
              {key === "ALL" ? "Toutes" : SERVICE_NAME[key]}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune facture ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-medium">Facture</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Service</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Articles</th>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium lg:table-cell">Paiement</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Total TTC</th>
                <th scope="col" className="px-3 py-2 text-right font-medium print:hidden">
                  <span className="sr-only">Impression</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, shown).map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs font-medium whitespace-nowrap">{t.number}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatDateTime(t.settledAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-[2px]", SERVICE_SWATCH[t.service])} aria-hidden />
                      {SERVICE_NAME[t.service]}
                      {t.tableLabel ? (
                        <span className="text-xs text-muted-foreground">· {t.tableLabel}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{t.items}</td>
                  <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">
                    {t.paymentModes.map(paymentName).join(" + ")}
                  </td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                    {formatCurrency(t.ttc)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap print:hidden">
                    <span className="inline-flex gap-1">
                      <Link
                        href={`/dashboard/orders/${t.id}/invoice`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
                        title="Imprimer la facture"
                      >
                        <PrinterIcon className="size-3.5" aria-hidden />
                        Imprimer
                      </Link>
                      <Link
                        href={`/dashboard/orders/${t.id}/invoice?copy=1`}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Imprimer un duplicata"
                      >
                        Duplicata
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-sm font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {filtered.length} facture{filtered.length > 1 ? "s" : ""}
                </td>
                <td className="hidden md:table-cell" />
                <td className="hidden lg:table-cell" />
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(total)}</td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {shown < filtered.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE * 2)}
          className="self-center rounded-md border px-4 py-1.5 text-sm font-medium hover:bg-muted print:hidden"
        >
          Afficher plus ({filtered.length - shown} restantes)
        </button>
      ) : null}
    </section>
  );
}
