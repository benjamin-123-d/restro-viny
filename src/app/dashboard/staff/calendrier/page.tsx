import { MonthCalendarBoard } from "@/components/planning/month-calendar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { monthOf } from "@/lib/planning";
import { parisParts } from "@/lib/sales-analytics";
import { getMonth } from "@/services/planning.service";

export const metadata = { title: "Calendrier du personnel" };

const isMonth = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}$/.test(value));

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Calendrier" description="Le mois entier, d'un coup d'œil." />
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }

  const today = parisParts(new Date()).day;
  const { mois } = await searchParams;
  const month = isMonth(mois) ? mois : monthOf(today);
  const calendar = await getMonth(ctx, month);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Calendrier"
        description="Le mois entier : qui est là chaque jour, et ce que ça représente en heures."
      />
      <MonthCalendarBoard calendar={calendar} today={today} />
    </div>
  );
}
