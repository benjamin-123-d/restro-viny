import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  LightbulbIcon,
  MapPinIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";

import { PrintButton } from "@/components/orders/print-button";
import { PeriodFilter } from "@/components/sales/period-filter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatVatRate } from "@/lib/french-vat";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SalesDashboardDTO } from "@/services/sales-analytics.service";

import {
  FoodDrinkByServiceChart,
  HourHeatmap,
  PaymentMixChart,
  ServiceSplitChart,
  TopItemsChart,
} from "./breakdown-charts";
import { DailySalesChart } from "./daily-sales-chart";
import { formatPercent, SERVICE_NAME, SERVICE_SWATCH } from "./sales-labels";
import { TicketList } from "./ticket-list";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section
    className={cn(
      "flex min-w-0 flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/10 sm:p-5",
      className,
    )}
  >
    {children}
  </section>
);

/** "▲ 12,4 % vs période précédente": icon, sign and words — never colour alone. */
function Delta({ pct, invert = false }: { readonly pct: number | null; readonly invert?: boolean }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">pas de comparaison</span>;
  }
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="flex flex-wrap items-center gap-x-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
          good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {up ? "+" : "−"}
        {formatPercent(Math.abs(pct))}
      </span>
      <span className="whitespace-nowrap text-muted-foreground">vs période préc.</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  sub,
  neutralDelta,
}: {
  readonly label: string;
  readonly value: string;
  readonly delta?: number | null;
  readonly sub?: React.ReactNode;
  readonly neutralDelta?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta !== undefined ? (
        neutralDelta && delta !== null ? (
          <span className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              {delta >= 0 ? "+" : "−"}
              {formatPercent(Math.abs(delta))}
            </span>
            <span className="whitespace-nowrap">vs période préc.</span>
          </span>
        ) : (
          <Delta pct={delta} />
        )
      ) : null}
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Findings({ data }: { readonly data: SalesDashboardDTO }) {
  return (
    <Card>
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <LightbulbIcon className="size-4 text-muted-foreground" aria-hidden />
          Analyse de la période
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ce que disent vos chiffres — chaque constat se vérifie dans les graphiques ci-dessous.
        </p>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {data.findings.map((f, i) => {
          const Icon = f.tone === "up" ? ArrowUpRightIcon : f.tone === "down" ? ArrowDownRightIcon : LightbulbIcon;
          return (
            <li key={i} className="flex gap-3 rounded-lg border p-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  f.tone === "up" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                  f.tone === "down" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                  f.tone === "info" && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="sr-only">
                  {f.tone === "up" ? "Hausse" : f.tone === "down" ? "Baisse" : "Constat"}
                </span>
              </span>
              <span className="leading-relaxed">{f.text}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The recap the owner asked for: by way of serving, meals and drinks apart. */
function RecapTable({ data }: { readonly data: SalesDashboardDTO }) {
  const rows = data.services;
  const t = rows.reduce(
    (a, r) => ({
      tickets: a.tickets + r.tickets,
      foodHT: a.foodHT + r.foodHT,
      foodTTC: a.foodTTC + r.foodTTC,
      drinkHT: a.drinkHT + r.drinkHT,
      drinkTTC: a.drinkTTC + r.drinkTTC,
      ht: a.ht + r.ht,
      vat: a.vat + r.vat,
      ttc: a.ttc + r.ttc,
    }),
    { tickets: 0, foodHT: 0, foodTTC: 0, drinkHT: 0, drinkTTC: 0, ht: 0, vat: 0, ttc: 0 },
  );
  const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold tracking-tight">Récapitulatif des ventes</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Par mode de service, repas et boissons à part — du {formatDate(data.period.from)} au{" "}
          {formatDate(new Date(new Date(data.period.to).getTime() - 1).toISOString())}.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" rowSpan={2} className="px-3 py-2 text-left font-medium">Service</th>
              <th scope="col" rowSpan={2} className="px-3 py-2 text-right font-medium">Tickets</th>
              <th scope="colgroup" colSpan={2} className="border-l px-3 pt-2 text-center font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-sales-food" aria-hidden />
                  Repas
                </span>
              </th>
              <th scope="colgroup" colSpan={2} className="border-l px-3 pt-2 text-center font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-sales-drink" aria-hidden />
                  Boissons
                </span>
              </th>
              <th scope="colgroup" colSpan={3} className="border-l px-3 pt-2 text-center font-medium">Total</th>
            </tr>
            <tr>
              <th scope="col" className="border-l px-3 pb-2 text-right font-normal">HT</th>
              <th scope="col" className="px-3 pb-2 text-right font-normal">TTC</th>
              <th scope="col" className="border-l px-3 pb-2 text-right font-normal">HT</th>
              <th scope="col" className="px-3 pb-2 text-right font-normal">TTC</th>
              <th scope="col" className="border-l px-3 pb-2 text-right font-normal">HT</th>
              <th scope="col" className="px-3 pb-2 text-right font-normal">TVA</th>
              <th scope="col" className="px-3 pb-2 text-right font-normal">TTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.service} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-[3px]", SERVICE_SWATCH[r.service])} aria-hidden />
                    {SERVICE_NAME[r.service]}
                  </span>
                </th>
                <td className={num}>{r.tickets}</td>
                <td className={cn(num, "border-l")}>{formatCurrency(r.foodHT)}</td>
                <td className={num}>{formatCurrency(r.foodTTC)}</td>
                <td className={cn(num, "border-l")}>{formatCurrency(r.drinkHT)}</td>
                <td className={num}>{formatCurrency(r.drinkTTC)}</td>
                <td className={cn(num, "border-l")}>{formatCurrency(r.ht)}</td>
                <td className={num}>{formatCurrency(r.vat)}</td>
                <td className={cn(num, "font-semibold")}>{formatCurrency(r.ttc)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40 font-semibold">
              <th scope="row" className="px-3 py-2 text-left">Total</th>
              <td className={num}>{t.tickets}</td>
              <td className={cn(num, "border-l")}>{formatCurrency(t.foodHT)}</td>
              <td className={num}>{formatCurrency(t.foodTTC)}</td>
              <td className={cn(num, "border-l")}>{formatCurrency(t.drinkHT)}</td>
              <td className={num}>{formatCurrency(t.drinkTTC)}</td>
              <td className={cn(num, "border-l")}>{formatCurrency(t.ht)}</td>
              <td className={num}>{formatCurrency(t.vat)}</td>
              <td className={num}>{formatCurrency(t.ttc)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function VatTable({ data }: { readonly data: SalesDashboardDTO }) {
  const total = data.vat.reduce(
    (a, r) => ({ base: a.base + r.baseHT, vat: a.vat + r.vat, ttc: a.ttc + r.totalTTC }),
    { base: 0, vat: 0, ttc: 0 },
  );
  const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold tracking-tight">TVA collectée par taux</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Les montants à reporter sur votre déclaration de TVA (CA3), ventilés par taux.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">
            Territoire : {data.territory.label}
            <span className="ml-2 font-normal text-muted-foreground">
              taux appliqués {data.territory.rates.map(formatVatRate).join(" · ")}
            </span>
          </p>
          <p className="mt-0.5 text-muted-foreground">{data.territory.note}</p>
          <Link href="/dashboard/settings" className="mt-1 inline-block text-xs underline underline-offset-2 print:hidden">
            Changer de territoire dans les réglages
          </Link>
        </div>
      </div>

      {data.territory.toConfirm.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Taux à faire confirmer par votre expert-comptable</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {data.territory.toConfirm.map((c) => (
                <li key={c.label}>
                  <span className="font-medium first-letter:uppercase">{c.label}</span> — {c.note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Taux</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Base HT</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">TVA</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {data.vat.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Aucune TVA collectée sur la période.
                </td>
              </tr>
            ) : (
              data.vat.map((r) => (
                <tr key={r.rate} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{formatVatRate(r.rate)}</th>
                  <td className={num}>{formatCurrency(r.baseHT)}</td>
                  <td className={num}>{formatCurrency(r.vat)}</td>
                  <td className={num}>{formatCurrency(r.totalTTC)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.vat.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <th scope="row" className="px-3 py-2 text-left">Total</th>
                <td className={num}>{formatCurrency(total.base)}</td>
                <td className={num}>{formatCurrency(total.vat)}</td>
                <td className={num}>{formatCurrency(total.ttc)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </Card>
  );
}

export function SalesDashboard({ data }: { readonly data: SalesDashboardDTO }) {
  const k = data.kpis;
  const d = data.deltas;
  const lastDay = formatDate(new Date(new Date(data.period.to).getTime() - 1).toISOString());

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Ventes</h1>
            <p className="text-sm text-muted-foreground">
              {data.period.label} · du {formatDate(data.period.from)} au {lastDay} · tickets encaissés en caisse
            </p>
          </div>
          <PrintButton label="Imprimer le récapitulatif" />
        </div>

        <PeriodFilter active={data.period.key} basePath="/dashboard/statistics/ventes" />

        {/* The one number first, then what makes it up. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
          <div className="flex flex-col justify-between gap-3 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Chiffre d&apos;affaires TTC</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight">
                {formatCurrency(k.revenueTTC)}
              </p>
              <div className="mt-1.5">
                <Delta pct={d.revenueTTC} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex h-2.5 w-full gap-0.5" aria-hidden>
                {k.revenueTTC > 0 ? (
                  <>
                    <span className="h-full rounded-l-[4px] bg-sales-food" style={{ width: `${100 - k.drinkShare}%` }} />
                    <span className="h-full rounded-r-[4px] bg-sales-drink" style={{ width: `${k.drinkShare}%` }} />
                  </>
                ) : (
                  <span className="h-full w-full rounded-[4px] bg-muted" />
                )}
              </div>
              <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-sales-food" aria-hidden />
                  Repas {formatCurrency(k.foodTTC)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-sales-drink" aria-hidden />
                  Boissons {formatCurrency(k.drinkTTC)} ({formatPercent(k.drinkShare)})
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Chiffre d'affaires HT" value={formatCurrency(k.revenueHT)} delta={d.revenueHT} />
            <Kpi label="TVA collectée" value={formatCurrency(k.vat)} delta={d.vat} neutralDelta />
            <Kpi label="Tickets" value={k.tickets.toLocaleString("fr-FR")} delta={d.tickets} />
            <Kpi label="Ticket moyen" value={formatCurrency(k.averageTicket)} delta={d.averageTicket} />
            <Kpi label="Articles vendus" value={k.itemsSold.toLocaleString("fr-FR")} sub={k.tickets ? `${(k.itemsSold / k.tickets).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par ticket` : undefined} />
            <Kpi label="Part des boissons" value={formatPercent(k.drinkShare)} sub="du chiffre d'affaires TTC" />
            <Kpi label="Remises accordées" value={formatCurrency(k.discounts)} sub={k.revenueTTC ? `${formatPercent((k.discounts / (k.revenueTTC + k.discounts)) * 100)} du brut` : undefined} />
            <Kpi label="Taux de TVA moyen" value={k.revenueHT ? formatPercent((k.vat / k.revenueHT) * 100, 2) : "—"} sub={data.territory.label} />
          </div>
        </div>

        <Findings data={data} />

        <DailySalesChart daily={data.daily} />

        <RecapTable data={data} />

        <div className="grid gap-6 xl:grid-cols-2">
          <ServiceSplitChart services={data.services} />
          <FoodDrinkByServiceChart services={data.services} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <HourHeatmap heatmap={data.heatmap} />
          <TopItemsChart items={data.topItems} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <VatTable data={data} />
          <PaymentMixChart payments={data.payments} />
        </div>

        <TicketList tickets={data.tickets} />
      </div>
    </TooltipProvider>
  );
}
