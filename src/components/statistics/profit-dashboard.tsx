"use client";

import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import { PrintButton } from "@/components/orders/print-button";
import { ChartCard, DataTable } from "@/components/sales/chart-card";
import { MarginDailyChart } from "@/components/statistics/margin-daily-chart";
import { PeriodFilter } from "@/components/sales/period-filter";
import { formatPercent } from "@/components/sales/sales-labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { marginSentence } from "@/lib/profit";
import { cn } from "@/lib/utils";
import type { ProfitDashboardDTO } from "@/services/profit.service";

/**
 * What the period left, read two ways: the margin on the food actually sold —
 * which judges the kitchen — and revenue against everything bought, which
 * judges the activity. Neither is a net profit, and the screen says so.
 */
export function ProfitDashboard({ data }: { readonly data: ProfitDashboardDTO }) {
  const m = data.margin;
  const p = data.purchases;
  const lastDay = formatDate(new Date(new Date(data.period.to).getTime() - 1).toISOString());
  const best = data.dishes.filter((d) => d.hasCost).slice(0, 8);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bénéfices</h1>
          <p className="text-sm text-muted-foreground">
            {data.period.label} · du {formatDate(data.period.from)} au {lastDay} · ce qui reste une fois la matière payée
          </p>
        </div>
        <PrintButton label="Imprimer le récapitulatif" />
      </div>

      <PeriodFilter active={data.period.key} basePath="/dashboard/statistics/benefices" />

      {/* 1 — la marge matière : ce que la cuisine rapporte. */}
      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Marge sur la matière</h2>
          <p className="text-sm text-muted-foreground">
            Ce que vous avez vendu, moins le coût des ingrédients de ces plats — le coût figé au moment de chaque vente.
          </p>
        </div>
        <p className="text-5xl font-semibold tracking-tight">{formatCurrency(m.margin)}</p>
        <p className="text-sm text-muted-foreground">{marginSentence(m, formatCurrency)}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Vendu HT</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(m.revenueHT)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Coût matière</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(m.materialCost)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Ratio matière</p>
            <p className="text-lg font-semibold tabular-nums">{m.ratio != null ? formatPercent(m.ratio) : "—"}</p>
          </div>
        </div>

        {m.coverage != null && m.coverage < 100 ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
            <span>
              {formatPercent(m.coverage, 0)} de vos ventes ont une fiche technique. Les {formatCurrency(m.revenueWithoutCost)} HT
              restants ({data.dishesWithoutCard} plat{data.dishesWithoutCard > 1 ? "s" : ""}) n&apos;ont pas de coût connu : leur
              marge n&apos;est pas comptée ici.{" "}
              <Link href="/dashboard/food-cost/fiches" className="font-medium underline underline-offset-2">
                Compléter les fiches
              </Link>
            </span>
          </p>
        ) : null}
      </section>

      <MarginDailyChart daily={data.daily} totals={m} />

      <ChartCard
        title="Ce qui vous rapporte le plus"
        description="Marge totale par plat sur la période : la quantité vendue compte autant que la marge unitaire."
        chart={
          best.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun plat avec fiche technique n&apos;a été vendu sur la période.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {best.map((dish) => {
                const top = best[0].margin || 1;
                return (
                  <li key={dish.menuItemId ?? dish.name} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">
                        {dish.name}
                        <span className="text-muted-foreground"> · {dish.quantity} vendu{dish.quantity > 1 ? "s" : ""}</span>
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(dish.margin)}
                        {dish.ratio != null ? (
                          <span className={cn("ml-1.5 text-xs", dish.ratio > 40 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                            ratio {formatPercent(dish.ratio, 0)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-sales-delivery" style={{ width: `${Math.max((dish.margin / top) * 100, 1)}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        }
        table={
          <DataTable
            headers={[
              { label: "Plat" },
              { label: "Vendus", numeric: true },
              { label: "Vendu HT", numeric: true },
              { label: "Matière", numeric: true },
              { label: "Marge", numeric: true },
              { label: "Ratio", numeric: true },
            ]}
            rows={data.dishes.map((d) => [
              d.hasCost ? d.name : `${d.name} (sans fiche)`,
              d.quantity,
              formatCurrency(d.revenueHT),
              d.hasCost ? formatCurrency(d.materialCost) : "—",
              d.hasCost ? formatCurrency(d.margin) : "—",
              d.ratio != null ? formatPercent(d.ratio, 0) : "—",
            ])}
          />
        }
      />

      {/* 2 — le résultat des achats : ce que l'activité a laissé. */}
      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Ventes moins achats</h2>
          <p className="text-sm text-muted-foreground">
            Tout ce que vous avez vendu, moins tout ce que vous avez acheté sur la même période — nourriture comprise, mais
            aussi entretien, matériel et emballages.
          </p>
        </div>
        <p className={cn("text-4xl font-semibold tracking-tight", p.result < 0 && "text-destructive")}>{formatCurrency(p.result)}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Vendu HT</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(p.revenueHT)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Acheté HT</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(p.purchasesHT)}</p>
            <p className="text-xs text-muted-foreground">
              dont {formatCurrency(p.foodPurchasesHT)} de nourriture
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Achats / ventes</p>
            <p className="text-lg font-semibold tabular-nums">{p.ratio != null ? formatPercent(p.ratio) : "—"}</p>
          </div>
        </div>
        {data.purchaseCategories.length > 0 ? (
          <DataTable
            headers={[{ label: "Type de dépense" }, { label: "Montant HT", numeric: true }, { label: "Part des achats", numeric: true }]}
            rows={data.purchaseCategories.map((c) => [c.label, formatCurrency(c.amountHT), c.share != null ? formatPercent(c.share, 0) : "—"])}
          />
        ) : null}
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          À lire sur une longue période : un mois où vous remplissez la réserve paraît mauvais, le mois suivant paraît
          excellent. Et ce chiffre n&apos;est pas un bénéfice net : le loyer, les salaires, l&apos;énergie et les impôts n&apos;y
          sont pas.
          {data.unsplitPurchaseCount > 0 ? (
            <>
              {" "}
              {data.unsplitPurchaseCount} document{data.unsplitPurchaseCount > 1 ? "s" : ""} non réparti
              {data.unsplitPurchaseCount > 1 ? "s" : ""} {data.unsplitPurchaseCount > 1 ? "sont comptés" : "est compté"} hors
              nourriture.
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}
