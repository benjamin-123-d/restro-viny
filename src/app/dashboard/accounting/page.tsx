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
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
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
        title="Comptabilité"
        description="La comptabilité en partie double : plan comptable, écritures et les trois états qui en découlent."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Produits" value={formatCurrency(pl.totalIncome)} />
        <Stat label="Charges" value={formatCurrency(pl.totalExpense)} />
        <Stat
          label="Résultat net"
          value={formatCurrency(pl.netProfit)}
          tone={pl.netProfit >= 0 ? "good" : "danger"}
        />
        <Stat label="Total de l'actif" value={formatCurrency(sheet.totalAssets)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Écritures comptabilisées" value={String(posted)} />
        <Stat label="Écritures en brouillon" value={String(drafts)} />
        <Stat
          label="Grand livre équilibré"
          value={tb.isBalanced ? "Oui" : "Non"}
          tone={tb.isBalanced ? "good" : "danger"}
        />
        <Stat
          label="Bilan équilibré"
          value={sheet.isBalanced ? "Oui" : "Non"}
          tone={sheet.isBalanced ? "good" : "danger"}
        />
      </div>

      {journals.length === 0 && (
        <EmptyState
          title="Aucune écriture"
          description="Le plan comptable de départ est prêt. Comptabilisez votre première écriture pour ouvrir les comptes."
        />
      )}
    </div>
  );
}
