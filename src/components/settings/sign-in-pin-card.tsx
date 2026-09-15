"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { removePinAction } from "@/actions/pin.actions";
import { PinDialog } from "@/components/settings/pin-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { PinStatus } from "@/services/pin-auth.service";

export function SignInPinCard({ status }: { readonly status: PinStatus }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    const result = await removePinAction();
    setRemoving(false);
    if (result.success) {
      toast.success("Code PIN supprimé");
      setRemoveOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Une erreur est survenue");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Code PIN de connexion</CardTitle>
        <CardDescription>
          Connectez-vous avec votre numéro et un code PIN, sans attendre le SMS. Gardez-le
          secret : toute personne ayant votre numéro et ce code peut se connecter.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {status.hasPin ? (
          <p className="text-muted-foreground text-sm">
            Code PIN activé
            {status.pinUpdatedAt
              ? ` · modifié le ${formatDateTime(status.pinUpdatedAt)}`
              : ""}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucun code PIN : vous vous connectez avec un code reçu par SMS.
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            {status.hasPin ? "Changer le code" : "Créer un code PIN"}
          </Button>
          {status.hasPin ? (
            <Button variant="outline" onClick={() => setRemoveOpen(true)}>
              Supprimer
            </Button>
          ) : null}
        </div>
      </CardContent>

      {dialogOpen ? (
        <PinDialog
          mode={status.hasPin ? "change" : "set"}
          onOpenChange={setDialogOpen}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {removeOpen ? (
        <Dialog open onOpenChange={(open) => !open && setRemoveOpen(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer votre code PIN ?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              You&apos;ll sign in with a one-time SMS code until you set a new
              PIN.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" disabled={removing} onClick={remove}>
                {removing ? "Suppression…" : "Supprimer le code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
