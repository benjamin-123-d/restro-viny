import { ProfitDashboard } from "@/components/statistics/profit-dashboard";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getProfitDashboard } from "@/services/profit.service";
import { isPeriodKey } from "@/services/sales-analytics.service";

export const metadata = { title: "Bénéfices — Statistiques" };

export default async function ProfitStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Bénéfices" description="Ce qu'il reste une fois la matière payée." />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const { periode } = await searchParams;
  const data = await getProfitDashboard(ctx, isPeriodKey(periode) ? periode : "30j");

  return <ProfitDashboard data={data} />;
}
