import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getProfitAndLoss } from "@/services/accounting.service";

export default async function ProfitAndLossPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant."
        />
      </div>
    );
  }

  const pl = await getProfitAndLoss(ctx);
  const empty = pl.income.length === 0 && pl.expense.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Profit & loss"
        description="What came in, what went out, and what is left."
      />
      {empty ? (
        <EmptyState
          title="Nothing posted yet"
          description="Income and expenses appear here once journals are posted."
        />
      ) : (
        <>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Net profit
            </p>
            <p
              className={`mt-1 text-3xl font-semibold ${
                pl.netProfit >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              <Money value={pl.netProfit} />
            </p>
          </div>
          <DocTable
            headers={[
              { label: "Code" },
              { label: "Account" },
              { label: "Amount", align: "right" },
            ]}
          >
            <tr className="bg-zinc-50">
              <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500" colSpan={3}>
                Income
              </td>
            </tr>
            {pl.income.map((row) => (
              <tr key={row.accountId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.code}</td>
                <td className="px-3 py-2 text-zinc-800">{row.name}</td>
                <td className="px-3 py-2 text-right"><Money value={row.balance} /></td>
              </tr>
            ))}
            <tr className="border-b font-medium">
              <td className="px-3 py-2" colSpan={2}>Total income</td>
              <td className="px-3 py-2 text-right"><Money value={pl.totalIncome} /></td>
            </tr>
            <tr className="bg-zinc-50">
              <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500" colSpan={3}>
                Expenses
              </td>
            </tr>
            {pl.expense.map((row) => (
              <tr key={row.accountId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.code}</td>
                <td className="px-3 py-2 text-zinc-800">{row.name}</td>
                <td className="px-3 py-2 text-right"><Money value={row.balance} /></td>
              </tr>
            ))}
            <tr className="border-b font-medium">
              <td className="px-3 py-2" colSpan={2}>Total expenses</td>
              <td className="px-3 py-2 text-right"><Money value={pl.totalExpense} /></td>
            </tr>
            <tr className="bg-zinc-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Net profit</td>
              <td className="px-3 py-2 text-right">
                <Money value={pl.netProfit} tone={pl.netProfit < 0 ? "danger" : undefined} />
              </td>
            </tr>
          </DocTable>
        </>
      )}
    </div>
  );
}
