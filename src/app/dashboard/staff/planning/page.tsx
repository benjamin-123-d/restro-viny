import { WeekRotaBoard } from "@/components/planning/week-rota";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HelpBox } from "@/components/forms/help-box";
import { parisParts } from "@/lib/sales-analytics";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { isDay } from "@/lib/planning";
import { getWeek } from "@/services/planning.service";

export const metadata = { title: "Planning du personnel" };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Planning" description="Qui travaille, quel jour, à quelle heure." />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant pour établir un planning."
        />
      </div>
    );
  }

  const { semaine } = await searchParams;
  const anyDay = semaine && isDay(semaine) ? semaine : parisParts(new Date()).day;
  const rota = await getWeek(ctx, anyDay);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Planning"
        description="Qui travaille, quel jour, à quelle heure — et combien d'heures ça fait."
      />

      <HelpBox
        defaultOpen={rota.totalMinutes === 0}
        title="Écrire le planning de la semaine"
        steps={[
          "Cliquez sur le + dans la case d'une personne, au jour voulu.",
          "Donnez l'heure de début et de fin : « 18:30 » à « 01:00 » pour un service du soir qui finit après minuit.",
          "Un jour sans travail se met aussi : repos, congé, maladie — c'est ce qui prouve le repos hebdomadaire.",
          "La semaine suivante ressemble à celle-ci ? « Copier la semaine précédente » la recopie d'un coup.",
        ]}
        tips={[
          "Le total de chaque personne est calculé en direct, pauses déduites.",
          "Au-dessus de son contrat, les heures supplémentaires s'affichent en orange.",
          "Chaque serveur et cuisinier voit son propre planning depuis son écran « Mon planning ».",
        ]}
      />

      {/* The rota is the manager's own screen: reaching it already means the
          right to write it. */}
      <WeekRotaBoard rota={rota} canEdit />
    </div>
  );
}
