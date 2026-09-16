import Link from "next/link";

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
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <AutoRefresh />

      {lowStock > 0 ? (
        <Link
          href="/dashboard/inventory/reappro"
          className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            <strong>{lowStock}</strong> article{lowStock === 1 ? "" : "s"} de stock
            {lowStock === 1 ? " est" : " sont"} sous le seuil de réapprovisionnement.
          </span>
          <span className="font-medium underline">Commander le réassort</span>
        </Link>
      ) : null}

      {/* Today */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">Aujourd’hui</h2>
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
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Encaissements du jour</CardDescription>
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

      {/* This month */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">Ce mois-ci</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Ventes du mois"
            value={formatCurrency(data.month.sales)}
            footer={
              <Delta
                pct={deltaPct(data.month.sales, data.lastMonthSales)}
                label="vs mois dernier"
              />
            }
          />
          <StatCard
            label="Commandes du mois"
            value={String(data.month.orders)}
            footer={
              <span className="text-muted-foreground">
                Ticket moyen {formatCurrency(data.month.aov)}
              </span>
            }
          />
          <StatCard
            label="Tables occupées"
            value={`${data.occupancy.occupied}/${data.occupancy.total}`}
            footer={
              <span className="text-muted-foreground">En ce moment</span>
            }
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes par jour</CardTitle>
            <CardDescription>Ventes encaissées chaque jour ce mois-ci</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={data.trend} />
          </CardContent>
        </Card>
      </section>

      {/* Detail */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Articles les plus vendus aujourd’hui</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItemsToday.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune vente pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.topItemsToday.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{it.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      ×{it.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail du jour</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>TVA {formatCurrency(data.today.tax)}</span>
              <span>Remises {formatCurrency(data.today.discount)}</span>
              <span>
                Annulations{" "}
                <span className={data.voidsToday > 0 ? "text-amber-700" : ""}>
                  {data.voidsToday}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.orderTypeToday.map((t) => (
                <span
                  key={t.type}
                  className="bg-muted rounded-full px-2.5 py-1 text-xs"
                >
                  {TYPE_LABEL[t.type]} {t.orders}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
