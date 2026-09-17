import Link from "next/link";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  ClipboardListIcon,
  PackageAlertIcon,
  ShoppingBagIcon,
} from "lucide-react";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { Delta, StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ORDER_TYPE_LABEL } from "@/lib/order-labels";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-labels";
import type { DashboardDTO } from "@/types/dashboard";

const deltaPct = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

const ageClass = (mins: number | null): string =>
  mins === null
    ? ""
    : mins >= 45
      ? "text-red-700"
      : mins >= 30
        ? "text-amber-700"
        : "text-emerald-700";

const MODE_LABEL = PAYMENT_MODE_LABEL;
const TYPE_LABEL: Record<string, string> = ORDER_TYPE_LABEL;

export function DashboardView({
  data,
  lowStock,
}: {
  readonly data: DashboardDTO;
  readonly lowStock: number;
}) {
  const paymentsTotal = data.paymentMixToday.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="min-h-full bg-slate-50/70 p-4 lg:p-8">
      <AutoRefresh />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium text-blue-600">V Suite · Pilotage</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Tableau de bord</h1>
            <p className="mt-1 text-sm text-slate-500">Les chiffres essentiels de votre restaurant, en un coup d’œil.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden /> Données à jour
          </div>
        </header>

        {lowStock > 0 ? (
          <Link
            href="/dashboard/inventory/reappro"
            className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
          >
            <span className="flex items-center gap-3">
              <PackageAlertIcon className="size-5 text-amber-600" aria-hidden />
              <span><strong>{lowStock}</strong> article{lowStock === 1 ? "" : "s"} sous le seuil de réapprovisionnement.</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-medium">Commander <ArrowUpRightIcon className="size-4" aria-hidden /></span>
          </Link>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Aujourd’hui</h2>
            <span className="text-xs text-slate-400">Depuis minuit</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ventes du jour"
            value={formatCurrency(data.today.sales)}
            footer={
              <Delta
                pct={deltaPct(data.today.sales, data.yesterdaySales)}
                label="vs hier"
              />
            }
          />
          <StatCard
            label="Commandes du jour"
            value={String(data.today.orders)}
            footer={
              <span className="text-muted-foreground">
                Ticket moyen {formatCurrency(data.today.aov)}
              </span>
            }
          />
          <StatCard
            label="En cours"
            value={formatCurrency(data.openNow.value)}
            footer={
              <span className="text-muted-foreground">
                {data.openNow.count} en cours
                {data.openNow.oldestMinutes !== null ? (
                  <>
                    {" · la plus ancienne "}
                    <span className={ageClass(data.openNow.oldestMinutes)}>
                      {data.openNow.oldestMinutes} min
                    </span>
                  </>
                ) : null}
              </span>
            }
          />
          <Card className="border-slate-200/80 bg-white shadow-sm @container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-2"><BanknoteIcon className="size-4 text-blue-500" aria-hidden />Encaissements du jour</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatCurrency(paymentsTotal)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="text-sm">
              {data.paymentMixToday.length === 0 ? (
                <span className="text-muted-foreground">Aucun encaissement</span>
              ) : (
                <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {data.paymentMixToday.map((m) => (
                    <span key={m.mode}>
                      {MODE_LABEL[m.mode] ?? m.mode} {formatCurrency(m.amount)}
                    </span>
                  ))}
                </span>
              )}
            </CardFooter>
          </Card>
        </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base text-slate-900">Performance du mois</CardTitle>
                <CardDescription>Ventes encaissées chaque jour</CardDescription>
              </div>
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-500">Ce mois-ci</span>
            </CardHeader>
            <CardContent><SalesTrendChart data={data.trend} /></CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Résumé mensuel</CardTitle>
              <CardDescription>Une vue rapide de l’activité</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatCard label="Ventes" value={formatCurrency(data.month.sales)} footer={<Delta pct={deltaPct(data.month.sales, data.lastMonthSales)} label="vs mois dernier" />} />
              <StatCard label="Commandes" value={String(data.month.orders)} footer={<span className="text-muted-foreground">Ticket moyen {formatCurrency(data.month.aov)}</span>} />
              <StatCard label="Tables occupées" value={`${data.occupancy.occupied}/${data.occupancy.total}`} footer={<span className="text-muted-foreground">En ce moment</span>} />
              <StatCard label="Encaissements" value={formatCurrency(paymentsTotal)} footer={<span className="text-muted-foreground">Tous moyens</span>} />
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900"><ShoppingBagIcon className="size-4 text-blue-500" aria-hidden />Articles les plus vendus aujourd’hui</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItemsToday.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune vente pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.topItemsToday.map((it, index) => (
                  <li key={it.name} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                    <span className="flex items-center gap-3"><span className="text-xs text-slate-400">0{index + 1}</span><span className="truncate">{it.name}</span></span>
                    <span className="text-slate-500 tabular-nums">×{it.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900"><ClipboardListIcon className="size-4 text-blue-500" aria-hidden />Détail du jour</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">TVA</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(data.today.tax)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Remises</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(data.today.discount)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Annulations</p><p className={`mt-1 font-semibold ${data.voidsToday > 0 ? "text-amber-700" : "text-slate-900"}`}>{data.voidsToday}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.orderTypeToday.map((t) => <span key={t.type} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{TYPE_LABEL[t.type]} {t.orders}</span>)}
            </div>
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
}
