import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { addMonths, dayShort, hoursText, monthLabel, weekDays, type ShiftKind } from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { MonthCalendar } from "@/types/planning";

const DOT_STYLES: Readonly<Record<ShiftKind, string>> = {
  TRAVAIL: "bg-sky-500",
  FORMATION: "bg-indigo-500",
  REPOS: "bg-slate-300",
  CONGE: "bg-emerald-500",
  MALADIE: "bg-amber-500",
  ABSENCE: "bg-rose-500",
};

/**
 * The month at a glance: how many people on each day, and how many hours that
 * costs. A rota is written week by week, but it is *judged* month by month —
 * which Saturdays are thin, where the holidays pile up.
 */
export function MonthCalendarBoard({ calendar, today }: { readonly calendar: MonthCalendar; readonly today: string }) {
  const href = (month: string) => `/dashboard/staff/calendrier?mois=${month}`;
  const headings = weekDays("2026-09-14"); // any Monday: only the day names are used

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            render={<Link href={href(addMonths(calendar.month, -1))} aria-label="Mois précédent" />}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold capitalize">{monthLabel(calendar.month)}</span>
          <Button
            variant="outline"
            size="icon"
            render={<Link href={href(addMonths(calendar.month, 1))} aria-label="Mois suivant" />}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <span className="text-muted-foreground text-sm">
          Heures du mois <strong className="text-foreground tabular-nums">{hoursText(calendar.workedMinutes)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="text-muted-foreground grid grid-cols-7 gap-1 pb-1 text-xs font-medium">
            {headings.map((day) => (
              <span key={day} className="px-1 capitalize">
                {dayShort(day)}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendar.weeks.flat().map((cell) => (
              <Link
                key={cell.day}
                href={`/dashboard/staff/planning?semaine=${cell.day}`}
                className={cn(
                  "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 transition-colors hover:border-primary",
                  cell.inMonth ? "bg-card" : "bg-muted/40 opacity-60",
                  cell.day === today && "ring-2 ring-primary",
                )}
              >
                <span className="flex items-baseline justify-between">
                  <span className={cn("text-sm font-semibold tabular-nums", !cell.inMonth && "font-normal")}>
                    {Number(cell.day.slice(8, 10))}
                  </span>
                  {cell.workedMinutes > 0 ? (
                    <span className="text-muted-foreground text-[10px] tabular-nums">{hoursText(cell.workedMinutes)}</span>
                  ) : null}
                </span>

                <span className="flex flex-col gap-0.5">
                  {cell.shifts.slice(0, 3).map((shift) => (
                    <span key={shift.id} className="flex items-center gap-1 text-[11px]">
                      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_STYLES[shift.kind])} aria-hidden />
                      <span className="truncate">{shift.name}</span>
                    </span>
                  ))}
                  {cell.shifts.length > 3 ? (
                    <span className="text-muted-foreground text-[11px]">+{cell.shifts.length - 3} autres</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {(["TRAVAIL", "FORMATION", "REPOS", "CONGE", "MALADIE", "ABSENCE"] as const).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", DOT_STYLES[kind])} aria-hidden />
            {kind.charAt(0) + kind.slice(1).toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}
