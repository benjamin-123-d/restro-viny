import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getStatistics } from "@/services/statistics.service";
import type { SeriesPoint } from "@/services/statistics.service";

const Stat = ({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "danger" | "warn";
}) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
      {label}
    </p>
    <p
      className={`mt-1 text-2xl font-semibold ${
        tone === "danger"
          ? "text-red-600"
          : tone === "good"
            ? "text-green-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-zinc-900"
      }`}
    >
      {value}
    </p>
    {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
  </div>
);

/**
 * Sales against purchases, month by month. Drawn with plain divs rather than a
 * charting library: two bars per month is not worth a dependency, and it keeps
 * the page a server component.
 */
const MonthlyBars = ({ months }: { months: readonly SeriesPoint[] }) => {
  const peak = Math.max(
    1,
    ...months.map((m) => Math.max(m.sales, m.purchases)),
  );

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-900">
          Ventes et achats
        </p>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-primary" />
            Ventes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />
            Achats
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 sm:gap-6">
        {months.map((month) => (
          <div
            key={month.label}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div className="flex h-40 w-full items-end justify-center gap-1">
              <div
                className="w-1/3 rounded-t bg-primary"
                style={{ height: `${(month.sales / peak) * 100}%` }}
                title={`Ventes ${formatCurrency(month.sales)}`}
              />
              <div
                className="w-1/3 rounded-t bg-amber-500"
                style={{ height: `${(month.purchases / peak) * 100}%` }}
                title={`Achats ${formatCurrency(month.purchases)}`}
              />
            </div>
            <span className="text-xs text-zinc-500">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Leaderboard = ({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: readonly { name: string; amount: number; count: number }[];
  emptyLabel: string;
}) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-sm font-medium text-zinc-900">{title}</p>
    {rows.length === 0 ? (
      <p className="mt-3 text-sm text-zinc-500">{emptyLabel}</p>
    ) : (
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const share = (row.amount / rows[0].amount) * 100;
          return (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-zinc-800">{row.name}</span>
                <span className="whitespace-nowrap tabular-nums font-medium">
                  {formatCurrency(row.amount)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-800"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400">{row.count} fact.</span>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export default async function StatisticsPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Statistiques"
          description="Une vue d'ensemble des achats, des ventes et du stock."
        />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const s = await getStatistics(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Statistiques"
        description="Ce qui rentre et ce qui sort, ce qui est dû dans les deux sens, et la valeur du stock, tous modules confondus."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ventes facturées" value={formatCurrency(s.salesTotal)} />
        <Stat
          label="Achats facturés"
          value={formatCurrency(s.purchaseTotal)}
        />
        <Stat
          label="Marge brute"
          value={formatCurrency(s.grossMargin)}
          sub={`${s.marginPercent} % des ventes`}
          tone={s.grossMargin >= 0 ? "good" : "danger"}
        />
        <Stat label="Valeur du stock" value={formatCurrency(s.stockValue)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Ce qu'on vous doit"
          value={formatCurrency(s.receivable)}
          sub={
            s.overdueReceivable > 0
              ? `${formatCurrency(s.overdueReceivable)} en retard`
              : "rien en retard"
          }
          tone={s.overdueReceivable > 0 ? "danger" : undefined}
        />
        <Stat
          label="Ce que vous devez"
          value={formatCurrency(s.payable)}
          sub={
            s.overduePayable > 0
              ? `${formatCurrency(s.overduePayable)} en retard`
              : "rien en retard"
          }
          tone={s.overduePayable > 0 ? "danger" : undefined}
        />
        <Stat
          label="Commandes en cours"
          value={`${s.openSalesOrders} / ${s.openPurchaseOrders}`}
          sub="ventes / achats"
        />
        <Stat
          label="Devis acceptés"
          value={s.quotationWinRate === null ? "—" : `${s.quotationWinRate}%`}
          sub={
            s.quotationWinRate === null
              ? "aucun devis tranché"
              : "des devis tranchés"
          }
        />
      </div>

      <MonthlyBars months={s.monthly} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Leaderboard
          title="Meilleurs clients"
          rows={s.topCustomers}
          emptyLabel="Aucun client facturé pour l'instant."
        />
        <Leaderboard
          title="Principaux fournisseurs"
          rows={s.topSuppliers}
          emptyLabel="Aucun fournisseur ne vous a facturé."
        />
      </div>

      <DocTable
        headers={[{ label: "Points de vigilance" }, { label: "Nombre", align: "right" }]}
      >
        <tr className="border-b">
          <td className="px-3 py-2 text-zinc-800">
            Articles sous le seuil de réapprovisionnement
          </td>
          <td className="px-3 py-2 text-right">
            <span
              className={
                s.lowStockCount > 0
                  ? "font-semibold text-amber-700"
                  : "text-zinc-400"
              }
            >
              {s.lowStockCount}
            </span>
          </td>
        </tr>
        <tr className="border-b">
          <td className="px-3 py-2 text-zinc-800">
            Lots qui expirent dans les 14 jours
          </td>
          <td className="px-3 py-2 text-right">
            <span
              className={
                s.expiringBatchCount > 0
                  ? "font-semibold text-red-600"
                  : "text-zinc-400"
              }
            >
              {s.expiringBatchCount}
            </span>
          </td>
        </tr>
        <tr>
          <td className="px-3 py-2 text-zinc-800">
            Position nette (ce qu’on vous doit − ce que vous devez)
          </td>
          <td className="px-3 py-2 text-right">
            <Money
              value={s.receivable - s.payable}
              tone={s.receivable - s.payable < 0 ? "danger" : undefined}
            />
          </td>
        </tr>
      </DocTable>
    </div>
  );
}
