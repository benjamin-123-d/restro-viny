import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import {
  getBalanceSheet,
  getProfitAndLoss,
  getTrialBalance,
  listJournals,
} from "@/services/accounting.service";

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "danger";
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
            : "text-zinc-900"
      }`}
    >
      {value}
    </p>
  </div>
);

export default async function AccountingPage() {
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

  const [pl, sheet, tb, journals] = await Promise.all([
    getProfitAndLoss(ctx),
    getBalanceSheet(ctx),
    getTrialBalance(ctx),
    listJournals(ctx),
  ]);

  const drafts = journals.filter((j) => j.status === "DRAFT").length;
  const posted = journals.filter((j) => j.status === "POSTED").length;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Accounting"
        description="Double-entry books: chart of accounts, journals, and the three reports that come out of them."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Income" value={formatCurrency(pl.totalIncome)} />
        <Stat label="Expenses" value={formatCurrency(pl.totalExpense)} />
        <Stat
          label="Net profit"
          value={formatCurrency(pl.netProfit)}
          tone={pl.netProfit >= 0 ? "good" : "danger"}
        />
        <Stat label="Total assets" value={formatCurrency(sheet.totalAssets)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Posted journals" value={String(posted)} />
        <Stat label="Draft journals" value={String(drafts)} />
        <Stat
          label="Ledger balanced"
          value={tb.isBalanced ? "Yes" : "No"}
          tone={tb.isBalanced ? "good" : "danger"}
        />
        <Stat
          label="Sheet balanced"
          value={sheet.isBalanced ? "Yes" : "No"}
          tone={sheet.isBalanced ? "good" : "danger"}
        />
      </div>

      {journals.length === 0 && (
        <EmptyState
          title="No journals yet"
          description="The starter chart of accounts is ready. Post your first journal to open the books."
        />
      )}
    </div>
  );
}
