"use client";

import { useState } from "react";

import { toast } from "sonner";

import { resetPinAction } from "@/actions/staff.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import type { StaffDTO } from "@/types/staff";

export function ResetPinDialog({
  staff,
  onOpenChange,
  onSaved,
}: {
  readonly staff: StaffDTO;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const [pin, setPin] = useState("");

  const save = useServerAction(resetPinAction, {
    onSuccess: () => {
      toast.success("Code PIN modifié");
      onOpenChange(false);
      onSaved();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.execute({ id: staff.id, pin });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset PIN — {staff.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="rp-pin">Nouveau code PIN caisse (4 à 6 chiffres)</FieldLabel>
            <Input
              id="rp-pin"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !/^\d{4,6}$/.test(pin)}>
              {save.isPending ? "Enregistrement…" : "Modifier le code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
