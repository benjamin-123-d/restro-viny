import Link from "next/link";

import { PrintButton } from "@/components/orders/print-button";
import { SERVICE_NAME } from "@/components/sales/sales-labels";
import { TicketFilters } from "@/components/sales/ticket-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { readTicketFilters } from "@/lib/ticket-filter-params";
import { listSaleTickets } from "@/services/sales-ledger.service";

export const metadata = { title: "Factures et tickets" };

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function SalesLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Factures et tickets" description="Le détail de tout ce qui a été vendu." />
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }

  const raw = await searchParams;
  const { filters, values } = readTicketFilters(raw);
  const ledger = await listSaleTickets(ctx, filters);
  const t = ledger.totals;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Factures et tickets"
          description="Chaque encaissement, avec son détail. Filtrez par dates, service, paiement, plat ou montant."
        />
        <PrintButton label="Imprimer la liste" />
      </div>

      <TicketFilters
        values={values}
        payments={ledger.facets.payments}
        dishes={ledger.facets.dishes}
        resultCount={t.tickets}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Tickets", value: String(t.tickets) },
          { label: "Total TTC", value: formatCurrency(t.totalTTC) },
          { label: "Dont TVA", value: formatCurrency(t.vat) },
          { label: "Ticket moyen", value: formatCurrency(t.averageTicket) },
          {
            label: "Marge matière",
            value: t.margin != null ? formatCurrency(t.margin) : "—",
            sub: t.margin != null ? `coût ${formatCurrency(t.materialCost)}` : "sans fiche technique",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
            {card.sub ? <p className="text-xs text-muted-foreground">{card.sub}</p> : null}
          </div>
        ))}
      </div>

      {ledger.rows.length === 0 ? (
        <EmptyState
          title="Aucun ticket"
          description="Aucun encaissement ne correspond à ces filtres. Élargissez les dates ou effacez les filtres."
        />
      ) : (
        <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Numéro</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Service</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Table / client</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Paiement</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Articles</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">HT</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">TVA</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">TTC</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Marge</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/orders/${row.id}/invoice`} className="font-medium underline underline-offset-2">
                        {row.number}
                      </Link>
                      {row.discount > 0 ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                          remise
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{dateTime(row.settledAt)}</td>
                    <td className="px-3 py-2">{SERVICE_NAME[row.service]}</td>
                    <td className="px-3 py-2">
                      {row.tableLabel ?? row.customerName ?? "—"}
                      <span className="block truncate text-xs text-muted-foreground">{row.dishes.slice(0, 3).join(", ")}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.payments.map((p) => p.label).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.totalHT)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(row.vat)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(row.totalTTC)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.margin != null ? formatCurrency(row.margin) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/40 font-medium">
                <tr>
                  <td className="px-3 py-2" colSpan={6}>
                    Total {ledger.truncated ? `(${ledger.rows.length} lignes affichées sur ${t.tickets})` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.totalHT)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.totalTTC)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.margin != null ? formatCurrency(t.margin) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {ledger.truncated ? (
        <p className="text-sm text-muted-foreground">
          Seules les {ledger.rows.length} premières lignes sont affichées. Les totaux, eux, portent sur les {t.tickets} tickets
          filtrés — et l&apos;export Excel les contient tous.
        </p>
      ) : null}
    </div>
  );
}
