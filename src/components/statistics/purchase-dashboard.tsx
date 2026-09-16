"use client";

import Link from "next/link";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { PrintButton } from "@/components/orders/print-button";
import { ChartCard, DataTable } from "@/components/sales/chart-card";
import { PurchaseDailyChart } from "@/components/statistics/purchase-daily-chart";
import { PeriodFilter } from "@/components/sales/period-filter";
import { formatPercent } from "@/components/sales/sales-labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PurchaseDashboardDTO } from "@/services/purchase-analytics.service";

const Figure = ({
  label,
  value,
  sub,
  delta,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly delta?: number | null;
}) => (
  <div className="flex flex-col justify-between gap-1 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold tabular-nums">{value}</p>
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {delta != null ? (
        <span className={cn("inline-flex items-center gap-0.5 font-medium", delta > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
          {delta > 0 ? <TrendingUpIcon className="size-3.5" aria-hidden /> : <TrendingDownIcon className="size-3.5" aria-hidden />}
          {delta > 0 ? "+" : ""}
          {formatPercent(delta)}
        </span>
      ) : null}
      {sub}
    </p>
  </div>
);

/**
 * What the restaurant bought over a period: how much, from whom, on what, and
 * which ingredient prices moved — the purchasing twin of the sales summary.
 */
export function PurchaseDashboard({ data }: { readonly data: PurchaseDashboardDTO }) {
  const t = data.totals;
  const lastDay = formatDate(new Date(new Date(data.period.to).getTime() - 1).toISOString());

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Achats</h1>
          <p className="text-sm text-muted-foreground">
            {data.period.label} · du {formatDate(data.period.from)} au {lastDay} · factures fournisseurs et achats directs
          </p>
        </div>
        <PrintButton label="Imprimer le récapitulatif" />
      </div>

      <PeriodFilter active={data.period.key} basePath="/dashboard/statistics/achats" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Acheté HT"
          value={formatCurrency(t.amountHT)}
          delta={data.deltas.amountHT}
          sub={`${formatCurrency(t.amountTTC)} TTC · ${formatCurrency(t.vat)} de TVA`}
        />
        <Figure
          label="Documents"
          value={String(t.documents)}
          delta={data.deltas.documents}
          sub={`${t.directCount} achat${t.directCount > 1 ? "s" : ""} direct${t.directCount > 1 ? "s" : ""} · ${t.suppliers} fournisseur${t.suppliers > 1 ? "s" : ""}`}
        />
        <Figure
          label="Nourriture et boissons"
          value={formatCurrency(t.foodHT)}
          sub={t.amountHT > 0 ? `${formatPercent((t.foodHT / t.amountHT) * 100, 0)} de vos achats` : undefined}
        />
        <Figure
          label="Reste à payer"
          value={formatCurrency(data.owed.total)}
          sub={data.owed.overdue > 0 ? `dont ${formatCurrency(data.owed.overdue)} en retard` : "rien en retard"}
        />
      </div>

      {t.unsplitCount > 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t.unsplitCount} document{t.unsplitCount > 1 ? "s" : ""} de cette période {t.unsplitCount > 1 ? "ont" : "a"} été
          enregistré{t.unsplitCount > 1 ? "s" : ""} au total seul : on ne sait pas encore ce qu&apos;{t.unsplitCount > 1 ? "ils contiennent" : "il contient"}.{" "}
          <Link href="/dashboard/purchasing/invoices" className="font-medium underline underline-offset-2">
            Les répartir
          </Link>
        </p>
      ) : null}

      <PurchaseDailyChart daily={data.daily} totalHT={t.amountHT} documents={t.documents} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Où part l'argent"
          description="Par type de dépense, HT. Seules les denrées et les boissons comptent dans le food cost."
          chart={
            <ul className="flex flex-col gap-2">
              {data.categories.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Aucun achat sur la période.</li>
              ) : (
                data.categories.map((row) => (
                  <li key={row.label} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span>{row.label}</span>
                      <span className="tabular-nums">
                        {formatCurrency(row.amountHT)}
                        {row.share != null ? <span className="ml-1.5 text-muted-foreground">{formatPercent(row.share, 0)}</span> : null}
                      </span>
                    </span>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-sales-takeaway"
                        style={{ width: `${Math.max(row.share ?? 0, 1)}%` }}
                      />
                    </span>
                  </li>
                ))
              )}
            </ul>
          }
          table={
            <DataTable
              headers={[{ label: "Type de dépense" }, { label: "Montant HT", numeric: true }, { label: "Part", numeric: true }]}
              rows={data.categories.map((r) => [r.label, formatCurrency(r.amountHT), r.share != null ? formatPercent(r.share, 0) : "—"])}
            />
          }
        />

        <ChartCard
          title="Vos fournisseurs"
          description="Qui a le plus pesé sur la période."
          chart={
            <ul className="flex flex-col gap-2">
              {data.suppliers.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Aucun fournisseur sur la période.</li>
              ) : (
                data.suppliers.map((row) => (
                  <li key={row.supplierId} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{row.name}</span>
                      <span className="tabular-nums">
                        {formatCurrency(row.amountHT)}
                        <span className="ml-1.5 text-muted-foreground">
                          {row.documents} doc{row.documents > 1 ? "s" : ""}
                        </span>
                      </span>
                    </span>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-sales-dine-in" style={{ width: `${Math.max(row.share ?? 0, 1)}%` }} />
                    </span>
                  </li>
                ))
              )}
            </ul>
          }
          table={
            <DataTable
              headers={[{ label: "Fournisseur" }, { label: "Documents", numeric: true }, { label: "Montant HT", numeric: true }]}
              rows={data.suppliers.map((r) => [r.name, r.documents, formatCurrency(r.amountHT)])}
            />
          }
        />
      </div>

      <ChartCard
        title="Prix qui bougent"
        description="Ingrédients achetés au moins deux fois sur la période : prix payé la première et la dernière fois, par unité d'achat."
        chart={
          data.priceMoves.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas encore assez d&apos;achats répétés pour comparer des prix. Saisissez vos achats marché : la hausse d&apos;un
              ingrédient se verra ici avant de se voir sur la marge.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.priceMoves.map((row) => (
                <li key={row.stockItemId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {row.name}
                    {row.purchaseUnit ? <span className="text-muted-foreground"> · le {row.purchaseUnit}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">{formatCurrency(row.firstPrice)}</span>→
                    <span className="font-medium">{formatCurrency(row.lastPrice)}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        row.changePercent > 0
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
                      )}
                    >
                      {row.changePercent > 0 ? <TrendingUpIcon className="size-3" aria-hidden /> : <TrendingDownIcon className="size-3" aria-hidden />}
                      {row.changePercent > 0 ? "+" : ""}
                      {formatPercent(row.changePercent)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        table={
          <DataTable
            headers={[{ label: "Ingrédient" }, { label: "Premier prix", numeric: true }, { label: "Dernier prix", numeric: true }, { label: "Écart", numeric: true }]}
            rows={data.priceMoves.map((r) => [
              r.purchaseUnit ? `${r.name} (le ${r.purchaseUnit})` : r.name,
              formatCurrency(r.firstPrice),
              formatCurrency(r.lastPrice),
              `${r.changePercent > 0 ? "+" : ""}${formatPercent(r.changePercent)}`,
            ])}
          />
        }
      />

      <section className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Documents de la période</h2>
          <p className="text-sm text-muted-foreground">Chaque facture et chaque ticket, du plus récent au plus ancien.</p>
        </div>
        {data.documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun document sur la période.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {["Numéro", "Fournisseur", "Date", "Contenu", "HT", "TTC"].map((h, i) => (
                    <th key={h} scope="col" className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", i >= 4 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.documents.map((doc) => (
                  <tr key={doc.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/purchasing/invoices/${doc.id}`} className="font-medium underline underline-offset-2">
                        {doc.number}
                      </Link>
                      {doc.isDirect ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs">direct</span> : null}
                    </td>
                    <td className="px-3 py-2">{doc.supplierName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(doc.postingDate)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.categories.join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(doc.amountHT)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(doc.amountTTC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
