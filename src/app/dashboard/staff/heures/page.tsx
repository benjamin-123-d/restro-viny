import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HelpBox } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { addMonths, hoursText, LEGAL_WEEK_HOURS, monthLabel, monthOf } from "@/lib/planning";
import { parisParts } from "@/lib/sales-analytics";
import { STAFF_ROLE_OPTIONS } from "@/lib/staff";
import { getMonthHours } from "@/services/planning.service";

export const metadata = { title: "Heures du personnel" };

const isMonth = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}$/.test(value));

export default async function HeuresPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Heures" description="Ce que le planning représente en heures." />
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }

  const { mois } = await searchParams;
  const month = isMonth(mois) ? mois : monthOf(parisParts(new Date()).day);
  const hours = await getMonthHours(ctx, month);
  const href = (value: string) => `/dashboard/staff/heures?mois=${value}`;
  const roleLabel = (role: string) => STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Heures"
        description="Le récapitulatif du mois, personne par personne — de quoi préparer la paie."
      />

      <HelpBox
        defaultOpen={false}
        title="Comment ces heures sont comptées"
        steps={[
          "Chaque service compte de son heure de début à son heure de fin, pause déduite.",
          "Un service qui finit après minuit est compté sur le jour où il a commencé.",
          "Les congés, maladies et repos ne comptent pas d'heures : ils sont comptés en jours.",
        ]}
        tips={[
          `Les heures supplémentaires sont comptées semaine par semaine, au-dessus de ${LEGAL_WEEK_HOURS} h ou du contrat de la personne — comme le veut la loi française. Une semaine à 45 h suivie d'une semaine à 25 h fait dix heures supplémentaires, pas zéro.`,
          "Ce tableau reflète le planning prévu. Il ne remplace pas un registre de présence.",
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" render={<Link href={href(addMonths(month, -1))} aria-label="Mois précédent" />}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold capitalize">{monthLabel(month)}</span>
          <Button variant="outline" size="icon" render={<Link href={href(addMonths(month, 1))} aria-label="Mois suivant" />}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <span className="text-muted-foreground text-sm">
          Total du mois <strong className="text-foreground tabular-nums">{hoursText(hours.workedMinutes)}</strong>
        </span>
      </div>

      {hours.rows.length === 0 ? (
        <EmptyState
          title="Aucune heure ce mois-ci"
          description="Établissez le planning dans l'onglet Planning : les heures se comptent toutes seules."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium">Personne</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Heures</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">dont sup.</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Jours travaillés</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Repos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Congés / absences</th>
              </tr>
            </thead>
            <tbody>
              {hours.rows.map((row) => (
                <tr key={row.person.id} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block font-medium">{row.person.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {roleLabel(row.person.role)}
                      {row.person.weeklyHours ? ` · contrat ${row.person.weeklyHours} h` : " · sans contrat renseigné"}
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{hoursText(row.workedMinutes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.overtimeMinutes > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">{hoursText(row.overtimeMinutes)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.workedDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.restDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.leaveDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
