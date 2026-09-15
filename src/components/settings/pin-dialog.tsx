"use client";

import { useState } from "react";

import { toast } from "sonner";

import { setPinAction } from "@/actions/pin.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";

const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export function PinDialog({
  mode,
  onOpenChange,
  onSaved,
}: {
  readonly mode: "set" | "change";
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useServerAction(setPinAction, {
    onSuccess: () => {
      toast.success(mode === "set" ? "Code PIN activé" : "Code PIN modifié");
      onOpenChange(false);
      onSaved();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pin !== confirm) {
      setError("Les deux codes ne correspondent pas");
      return;
    }
    setError(null);
    save.execute({ pin });
  };

  const valid = /^\d{4,6}$/.test(pin) && pin === confirm;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "set" ? "Créer un code PIN de connexion" : "Changer le code PIN"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="pin-new">Nouveau code (4 à 6 chiffres)</FieldLabel>
            <Input
              id="pin-new"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => {
                setPin(onlyDigits(e.target.value));
                setError(null);
              }}
              placeholder="••••••"
              autoFocus
            />
            <FieldDescription>6 digits recommended.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pin-confirm">Confirmer le code</FieldLabel>
            <Input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(onlyDigits(e.target.value));
                setError(null);
              }}
              placeholder="••••••"
            />
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !valid}>
              {save.isPending ? "Enregistrement…" : "Enregistrer le code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
