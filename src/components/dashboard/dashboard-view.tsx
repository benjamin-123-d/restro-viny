import Link from "next/link";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  ClipboardListIcon,
  PackageXIcon,
  ShoppingBagIcon,
  type LucideIcon,
} from "lucide-react";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { PaymentDonut } from "@/components/dashboard/payment-donut";
import { TrendPanel } from "@/components/dashboard/trend-panel";
import { formatCurrency, formatTime } from "@/lib/format";
import { deriveKitchenStatus, KITCHEN_STATUS_LABEL } from "@/lib/kitchen";
import { ORDER_TYPE_LABEL } from "@/lib/order-labels";
import { cn } from "@/lib/utils";
import type { DashboardDTO } from "@/types/dashboard";
import type { OrderDTO } from "@/types/order";

/**
 * The owner's first screen. Four figures they check before anything else, the
 * shape of the month, where the money came in, and what is still open on the
 * floor right now.
 *
 * Every number here is read from the real day — nothing is a placeholder. A
 * dashboard with one invented figure on it stops being consulted within a week.
 */

const deltaPct = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

/** Enough black mixed in that white text stays readable on every hue. */
const gradient = (token: string, from: number, to: number): string =>
  `linear-gradient(135deg, color-mix(in oklab, var(${token}), black ${from}%), color-mix(in oklab, var(${token}), black ${to}%))`;

function StatTile({
  icon: Icon,
  value,
  label,
  hint,
  background,
  href,
}: {
  readonly icon: LucideIcon;
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
  readonly background: string;
  readonly href: string;
}) {
  return (
    <Link
      href={href}
      style={{ backgroundImage: background }}
      className="group flex items-center gap-4 rounded-2xl p-5 text-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="font-heading block text-2xl font-semibold tabular-nums">{value}</span>
        <span className="block text-sm text-white/85">{label}</span>
        {hint ? <span className="block text-xs text-white/70">{hint}</span> : null}
      </span>
      <ArrowUpRightIcon className="ml-auto size-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function MiniStat({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  );
}

function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card flex flex-col gap-4 rounded-2xl border p-5 shadow-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DashboardView({
  data,
  lowStock,
  openOrders,
}: {
  readonly data: DashboardDTO;
  readonly lowStock: number;
  readonly openOrders: readonly OrderDTO[];
}) {
  const salesDelta = deltaPct(data.today.sales, data.yesterdaySales);
  const monthDelta = deltaPct(data.month.sales, data.lastMonthSales);

  return (
    <div className="min-h-full p-4 lg:p-6">
      <AutoRefresh />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Votre restaurant aujourd&apos;hui, et le mois en cours.
            </p>
          </div>
          <span className="text-muted-foreground bg-card rounded-lg border px-3 py-1.5 text-xs">
            Mis à jour en continu
          </span>
        </header>

        {/* ------------------------------------------------ les quatre chiffres */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={BanknoteIcon}
            value={formatCurrency(data.today.sales)}
            label="Encaissé aujourd'hui"
            hint={
              salesDelta === null
                ? "pas de comparaison hier"
                : `${salesDelta >= 0 ? "+" : ""}${salesDelta} % par rapport à hier`
            }
            background={gradient("--chart-1", 5, 25)}
            href="/dashboard/statistics/ventes"
          />
          <StatTile
            icon={ShoppingBagIcon}
            value={String(data.today.orders)}
            label="Commandes du jour"
            hint={data.today.orders > 0 ? `panier moyen ${formatCurrency(data.today.aov)}` : undefined}
            background={gradient("--chart-4", 0, 20)}
            href="/dashboard/orders"
          />
          <StatTile
            icon={ClipboardListIcon}
            value={String(data.openNow.count)}
            label="Tickets ouverts"
            hint={
              data.openNow.count > 0
                ? `${formatCurrency(data.openNow.value)}${data.openNow.oldestMinutes != null ? ` · le plus ancien ${data.openNow.oldestMinutes} min` : ""}`
                : "rien en attente"
            }
            background={gradient("--chart-2", 30, 50)}
            href="/dashboard/orders"
          />
          <StatTile
            icon={PackageXIcon}
            value={String(lowStock)}
            label="Ingrédients sous le seuil"
            hint={lowStock > 0 ? "à commander" : "stock au-dessus des seuils"}
            background={gradient("--chart-3", 35, 55)}
            href="/dashboard/inventory"
          />
        </div>

        {/* ------------------------------------------- le mois et les paiements */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel
            title="Le mois en cours"
            description="Ce qui a été encaissé, jour après jour."
            className="xl:col-span-2"
            action={
              <Link
                href="/dashboard/statistics/ventes"
                className="text-primary text-xs font-medium hover:underline"
              >
                Voir le détail
              </Link>
            }
          >
            <div className="grid gap-5 md:grid-cols-[minmax(0,14rem)_1fr]">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="font-heading block text-3xl font-semibold tabular-nums">
                    {formatCurrency(data.month.sales)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    encaissé ce mois-ci
                    {monthDelta !== null ? (
                      <span className={cn("ml-1 font-medium", monthDelta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {monthDelta >= 0 ? "+" : ""}
                        {monthDelta} %
                      </span>
                    ) : null}
                  </span>
                </div>
                <div>
                  <span className="font-heading block text-2xl font-semibold tabular-nums">{data.month.orders}</span>
                  <span className="text-muted-foreground text-xs">
                    commandes · panier moyen {formatCurrency(data.month.aov)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <MiniStat label="TVA du mois" value={formatCurrency(data.month.tax)} />
                  <MiniStat label="Remises" value={formatCurrency(data.month.discount)} />
                  <MiniStat
                    label="Annulations du jour"
                    value={String(data.voidsToday)}
                    tone={data.voidsToday > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
                  />
                  <MiniStat
                    label="Tables occupées"
                    value={`${data.occupancy.occupied} / ${data.occupancy.total}`}
                  />
                </div>
              </div>

              <TrendPanel data={data.trend} />
            </div>
          </Panel>

          <Panel title="Encaissements" description="Par mode de paiement, aujourd'hui.">
            <PaymentDonut slices={data.paymentMixToday} />
          </Panel>
        </div>

        {/* ------------------------------------ ce qui se vend, ce qui est ouvert */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Meilleures ventes du jour" description="Les plats qui sortent le plus.">
            {data.topItemsToday.length === 0 ? (
              <p className="text-muted-foreground text-sm">Rien de vendu pour l&apos;instant.</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {data.topItemsToday.slice(0, 6).map((item, index) => (
                  <li key={item.name} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{item.quantity}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            title="Tickets ouverts"
            description="Ce qui est encore sur le service."
            className="xl:col-span-2"
            action={
              <Link href="/dashboard/orders" className="text-primary text-xs font-medium hover:underline">
                Tout voir
              </Link>
            }
          >
            {openOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun ticket ouvert. La salle est à jour.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-[11px] uppercase">
                      <th scope="col" className="px-2 py-2 text-left font-medium">Ticket</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">Où</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">Ouvert à</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">Cuisine</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.slice(0, 6).map((order) => {
                      const kitchen = deriveKitchenStatus(order.lines.map((line) => line.state));
                      return (
                        <tr key={order.id} className="border-t">
                          <td className="px-2 py-2">
                            <Link href={`/dashboard/orders/${order.id}`} className="font-medium hover:underline">
                              #{order.orderNumber}
                            </Link>
                          </td>
                          <td className="text-muted-foreground px-2 py-2">
                            {order.tableLabel ?? ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
                          </td>
                          <td className="text-muted-foreground px-2 py-2 tabular-nums">{formatTime(order.createdAt)}</td>
                          <td className="px-2 py-2">
                            {kitchen ? (
                              <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                                {KITCHEN_STATUS_LABEL[kitchen]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums">
                            {formatCurrency(order.grandTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
