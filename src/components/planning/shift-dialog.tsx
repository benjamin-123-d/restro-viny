"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteShiftAction, saveShiftAction } from "@/actions/planning.actions";
import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { humanError } from "@/lib/error-messages";
import {
  dayLong,
  hoursText,
  isWorkedKind,
  minutesToText,
  shiftMinutes,
  textToMinutes,
  SHIFT_KINDS,
  type ShiftKind,
} from "@/lib/planning";
import type { ShiftDTO } from "@/types/planning";

export interface ShiftTarget {
  readonly staffId: string;
  readonly staffName: string;
  readonly day: string;
  readonly shift: ShiftDTO | null;
}

/**
 * One service, written the way it is said out loud: « Awa, samedi, 18h30 à
 * 1h ». The hours are typed as text because that is how a rota is dictated —
 * « 18h30 » and « 18:30 » both work.
 */
export function ShiftDialog({ target, onClose }: { readonly target: ShiftTarget | null; readonly onClose: () => void }) {
  if (!target) return null;
  return <ShiftForm key={`${target.staffId}-${target.day}-${target.shift?.id ?? "new"}`} target={target} onClose={onClose} />;
}

function ShiftForm({ target, onClose }: { readonly target: ShiftTarget; readonly onClose: () => void }) {
  const router = useRouter();
  const existing = target.shift;
  const [kind, setKind] = useState<ShiftKind>(existing?.kind ?? "TRAVAIL");
  const [start, setStart] = useState(existing?.startMinute != null ? minutesToText(existing.startMinute) : "11:00");
  const [end, setEnd] = useState(existing?.endMinute != null ? minutesToText(existing.endMinute) : "15:00");
  const [breakMinutes, setBreakMinutes] = useState(String(existing?.breakMinutes ?? 0));
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const worked = isWorkedKind(kind);
  const startMinute = textToMinutes(start);
  const endMinute = textToMinutes(end);
  const preview =
    worked && startMinute != null && endMinute != null
      ? hoursText(
          shiftMinutes({ kind, startMinute, endMinute, breakMinutes: Number(breakMinutes) || 0 }),
        )
      : null;

  const save = () => {
    setError(null);
    if (worked && (startMinute == null || endMinute == null)) {
      setError("Indiquez l'heure de début et l'heure de fin, par exemple 18:30.");
      return;
    }
    startSaving(async () => {
      const result = await saveShiftAction({
        id: existing?.id,
        staffId: target.staffId,
        day: target.day,
        kind,
        startMinute: worked ? startMinute : null,
        endMinute: worked ? endMinute : null,
        breakMinutes: worked ? Number(breakMinutes) || 0 : 0,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      toast.success(existing ? "Service modifié." : "Service ajouté.");
      onClose();
      router.refresh();
    });
  };

  const remove = () => {
    if (!existing) return;
    startSaving(async () => {
      const result = await deleteShiftAction({ id: existing.id });
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      toast.success("Service retiré.");
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target.staffName} — {dayLong(target.day)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Ce jour-là</span>
            <div className="flex flex-wrap gap-1.5">
              {SHIFT_KINDS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setKind(option.id)}
                  aria-pressed={kind === option.id}
                  className={
                    kind === option.id
                      ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {worked ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Début</span>
                <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="11:00" inputMode="numeric" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Fin</span>
                <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="15:00" inputMode="numeric" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Pause (min)</span>
                <Input
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                />
              </label>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Note (facultatif)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ouverture, inventaire…" />
          </label>

          {preview ? (
            <FieldHint>
              Ce service compte pour <strong>{preview}</strong>. Une fin avant le début veut dire que le service se termine
              après minuit.
            </FieldHint>
          ) : null}

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {existing ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={saving}>
              Retirer
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
