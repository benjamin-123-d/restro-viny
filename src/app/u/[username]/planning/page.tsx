import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { StaffShell } from "@/components/staff-app/staff-shell";
import {
  addDays,
  dayLong,
  hoursText,
  isDay,
  shiftLabel,
  shiftMinutes,
  weekLabel,
  type ShiftKind,
} from "@/lib/planning";
import { parisParts } from "@/lib/sales-analytics";
import { cn } from "@/lib/utils";
import { getMyWeek } from "@/services/planning.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Mon planning" };

const KIND_STYLES: Readonly<Record<ShiftKind, string>> = {
  TRAVAIL: "bg-sky-50 ring-sky-200 dark:bg-sky-950 dark:ring-sky-900",
  FORMATION: "bg-indigo-50 ring-indigo-200 dark:bg-indigo-950 dark:ring-indigo-900",
  REPOS: "bg-slate-50 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800",
  CONGE: "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950 dark:ring-emerald-900",
  MALADIE: "bg-amber-50 ring-amber-200 dark:bg-amber-950 dark:ring-amber-900",
  ABSENCE: "bg-rose-50 ring-rose-200 dark:bg-rose-950 dark:ring-rose-900",
};

/**
 * One person's own week, in big type. Read standing up, phone in hand, before
 * a service — so the day being read today is marked, and nothing is editable:
 * the rota is the manager's to write.
 */
export default async function MyPlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ semaine?: string }>;
}) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "PLANNING");

  const today = parisParts(new Date()).day;
  const { semaine } = await searchParams;
  const week = await getMyWeek(ctx.staffId, semaine && isDay(semaine) ? semaine : today);
  const href = (monday: string) => `/u/${restaurant.username}/planning?semaine=${monday}`;

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="PLANNING"
      title="Mon planning"
      subtitle="Vos horaires de la semaine"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={href(addDays(week.monday, -7))}
            aria-label="Semaine précédente"
            className="flex size-12 items-center justify-center rounded-xl border"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="text-center text-base font-semibold capitalize">{weekLabel(week.monday)}</span>
          <Link
            href={href(addDays(week.monday, 7))}
            aria-label="Semaine suivante"
            className="flex size-12 items-center justify-center rounded-xl border"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>

        <p className="rounded-xl bg-muted/50 p-3 text-center text-base">
          <strong className="text-2xl font-semibold tabular-nums">{hoursText(week.workedMinutes)}</strong>
          <span className="text-muted-foreground block text-sm">
            prévues cette semaine
            {week.weeklyHours ? ` · contrat ${week.weeklyHours} h` : ""}
          </span>
        </p>

        <ul className="flex flex-col gap-2">
          {week.days.map((day, index) => {
            const shifts = week.shifts[index];
            return (
              <li
                key={day}
                className={cn(
                  "rounded-xl border p-3",
                  day === today && "border-primary ring-2 ring-primary/30",
                )}
              >
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold capitalize">{dayLong(day)}</span>
                  {day === today ? <span className="text-primary text-xs font-medium">aujourd&apos;hui</span> : null}
                </p>

                {shifts.length === 0 ? (
                  <p className="text-muted-foreground mt-1 text-sm">Rien de prévu.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {shifts.map((shift) => (
                      <li key={shift.id} className={cn("rounded-lg px-3 py-2 ring-1", KIND_STYLES[shift.kind])}>
                        <span className="block text-lg font-semibold tabular-nums">{shiftLabel(shift)}</span>
                        <span className="text-muted-foreground block text-sm">
                          {shiftMinutes(shift) > 0 ? hoursText(shiftMinutes(shift)) : null}
                          {shift.breakMinutes > 0 ? ` · ${shift.breakMinutes} min de pause` : ""}
                          {shift.note ? ` · ${shift.note}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground text-center text-sm">
          Une erreur dans vos horaires ? Prévenez votre responsable : lui seul peut modifier le planning.
        </p>
      </div>
    </StaffShell>
  );
}
