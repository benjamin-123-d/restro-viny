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
          Sales against purchases
        </p>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />
            Sales
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />
            Purchases
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
                className="w-1/3 rounded-t bg-blue-500"
                style={{ height: `${(month.sales / peak) * 100}%` }}
                title={`Sales ${formatCurrency(month.sales)}`}
              />
              <div
                className="w-1/3 rounded-t bg-amber-500"
                style={{ height: `${(month.purchases / peak) * 100}%` }}
                title={`Purchases ${formatCurrency(month.purchases)}`}
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
                <span className="text-xs text-zinc-400">{row.count} inv.</span>
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
          title="Statistics"
          description="One view across buying, selling and stock."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant."
        />
      </div>
    );
  }

  const s = await getStatistics(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Statistics"
        description="Money in against money out, what is owed either way, and where the stock sits — across every module at once."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales billed" value={formatCurrency(s.salesTotal)} />
        <Stat
          label="Purchases billed"
          value={formatCurrency(s.purchaseTotal)}
        />
        <Stat
          label="Gross margin"
          value={formatCurrency(s.grossMargin)}
          sub={`${s.marginPercent}% of sales`}
          tone={s.grossMargin >= 0 ? "good" : "danger"}
        />
        <Stat label="Stock value" value={formatCurrency(s.stockValue)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Owed to you"
          value={formatCurrency(s.receivable)}
          sub={
            s.overdueReceivable > 0
              ? `${formatCurrency(s.overdueReceivable)} overdue`
              : "nothing overdue"
          }
          tone={s.overdueReceivable > 0 ? "danger" : undefined}
        />
        <Stat
          label="You owe"
          value={formatCurrency(s.payable)}
          sub={
            s.overduePayable > 0
              ? `${formatCurrency(s.overduePayable)} overdue`
              : "nothing overdue"
          }
          tone={s.overduePayable > 0 ? "danger" : undefined}
        />
        <Stat
          label="Open orders"
          value={`${s.openSalesOrders} / ${s.openPurchaseOrders}`}
          sub="sales / purchase"
        />
        <Stat
          label="Quotation win rate"
          value={s.quotationWinRate === null ? "—" : `${s.quotationWinRate}%`}
          sub={
            s.quotationWinRate === null
              ? "nothing decided yet"
              : "of decided quotes"
          }
        />
      </div>

      <MonthlyBars months={s.monthly} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Leaderboard
          title="Top customers"
          rows={s.topCustomers}
          emptyLabel="No customer has been invoiced yet."
        />
        <Leaderboard
          title="Top suppliers"
          rows={s.topSuppliers}
          emptyLabel="No supplier has billed you yet."
        />
      </div>

      <DocTable
        headers={[{ label: "Watch list" }, { label: "Count", align: "right" }]}
      >
        <tr className="border-b">
          <td className="px-3 py-2 text-zinc-800">
            Items at or below reorder level
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
            Batches expiring within 14 days
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
            Net position (owed to you − you owe)
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
