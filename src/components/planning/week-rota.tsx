"use client";

import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, PlusIcon, PrinterIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearWeekAction, copyWeekAction } from "@/actions/planning.actions";
import { ShiftDialog, type ShiftTarget } from "@/components/planning/shift-dialog";
import { Button } from "@/components/ui/button";
import { humanError } from "@/lib/error-messages";
import { addDays, dayLabel, hoursText, shiftLabel, shiftMinutes, weekLabel, type ShiftKind } from "@/lib/planning";
import { STAFF_ROLE_OPTIONS } from "@/lib/staff";
import { cn } from "@/lib/utils";
import type { RotaRow, WeekRota } from "@/types/planning";
import type { StaffRole } from "@/types/staff";

/** One tint per reason, so a week is read without reading a single word. */
const KIND_STYLES: Readonly<Record<ShiftKind, string>> = {
  TRAVAIL: "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-900",
  FORMATION: "bg-indigo-100 text-indigo-900 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:ring-indigo-900",
  REPOS: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800",
  CONGE: "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900",
  MALADIE: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900",
  ABSENCE: "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-900",
};

const roleLabel = (role: StaffRole) => STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function PersonCell({ row }: { readonly row: RotaRow }) {
  const { person } = row;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-border">
        {initials(person.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{person.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {roleLabel(person.role)}
          {person.weeklyHours ? ` · ${person.weeklyHours} h` : ""}
          {person.onLeave ? " · en congé" : ""}
        </span>
      </span>
    </div>
  );
}

/**
 * The week, as a rota is actually read: people down the side, days across the
 * top, and the hours each person adds up to on the right — where a manager
 * looks before answering « tu me mets combien cette semaine ? ».
 */
export function WeekRotaBoard({ rota, canEdit }: { readonly rota: WeekRota; readonly canEdit: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<ShiftTarget | null>(null);
  const [busy, startBusy] = useTransition();

  const copyPrevious = () =>
    startBusy(async () => {
      const result = await copyWeekAction({ fromMonday: addDays(rota.monday, -7), toMonday: rota.monday });
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      toast.success(`${result.data?.copied ?? 0} service(s) recopié(s) depuis la semaine précédente.`);
      router.refresh();
    });

  const clear = () =>
    startBusy(async () => {
      const result = await clearWeekAction({ monday: rota.monday });
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      toast.success(`${result.data?.removed ?? 0} service(s) retiré(s).`);
      router.refresh();
    });

  const href = (monday: string) => `/dashboard/staff/planning?semaine=${monday}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" render={<Link href={href(addDays(rota.monday, -7))} aria-label="Semaine précédente" />}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          {/* first-letter, not capitalize: « semaine du 14 au 20 septembre » is
              one sentence, and French does not capitalise every word of it. */}
          <span className="min-w-56 text-center text-sm font-semibold first-letter:uppercase">
            {weekLabel(rota.monday)}
          </span>
          <Button variant="outline" size="icon" render={<Link href={href(addDays(rota.monday, 7))} aria-label="Semaine suivante" />}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            Total équipe <strong className="text-foreground tabular-nums">{hoursText(rota.totalMinutes)}</strong>
          </span>
          {canEdit ? (
            <>
              <Button variant="outline" size="sm" onClick={copyPrevious} disabled={busy || !rota.previousWeekHasShifts}>
                <CopyIcon className="size-4" aria-hidden />
                Copier la semaine précédente
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={clear} disabled={busy}>
                Vider
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon className="size-4" aria-hidden />
            Imprimer
          </Button>
        </div>
      </div>

      {rota.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
          {rota.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {rota.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Personne dans l&apos;équipe pour l&apos;instant. Ajoutez vos serveurs et cuisiniers dans l&apos;onglet Équipe.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th scope="col" className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
                  Personne
                </th>
                {rota.days.map((day) => (
                  <th key={day} scope="col" className="px-2 py-2 text-center font-medium capitalize">
                    {dayLabel(day)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Semaine
                </th>
              </tr>
            </thead>
            <tbody>
              {rota.rows.map((row) => (
                <tr key={row.person.id} className="border-t align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal">
                    <PersonCell row={row} />
                  </th>

                  {row.days.map((shifts, index) => {
                    const day = rota.days[index];
                    return (
                      <td key={day} className="px-1 py-1.5">
                        <div className="flex flex-col items-stretch gap-1">
                          {shifts.map((shift) => (
                            <button
                              key={shift.id}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                setTarget({ staffId: row.person.id, staffName: row.person.name, day, shift })
                              }
                              className={cn(
                                "rounded-md px-1.5 py-1 text-center text-xs font-medium ring-1 disabled:cursor-default",
                                KIND_STYLES[shift.kind],
                              )}
                              title={shift.note ?? undefined}
                            >
                              <span className="block whitespace-nowrap tabular-nums">{shiftLabel(shift)}</span>
                              {shiftMinutes(shift) > 0 ? (
                                <span className="block text-[10px] opacity-80">{hoursText(shiftMinutes(shift))}</span>
                              ) : null}
                            </button>
                          ))}

                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => setTarget({ staffId: row.person.id, staffName: row.person.name, day, shift: null })}
                              aria-label={`Ajouter un service pour ${row.person.name} le ${day}`}
                              className="text-muted-foreground hover:bg-muted flex items-center justify-center rounded-md border border-dashed py-1"
                            >
                              <PlusIcon className="size-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 text-right">
                    <span className="block font-semibold tabular-nums">{hoursText(row.workedMinutes)}</span>
                    {row.overtimeMinutes > 0 ? (
                      <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">
                        +{hoursText(row.overtimeMinutes)} sup.
                      </span>
                    ) : null}
                    <span className="text-muted-foreground block text-xs">
                      {row.workedDays} j travaillés
                      {row.restDays > 0 ? ` · ${row.restDays} repos` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ShiftDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
