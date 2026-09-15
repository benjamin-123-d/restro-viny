"use client";

import { useState } from "react";

import { toast } from "sonner";

import { setInvoiceFooterAction } from "@/actions/settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";

export function InvoiceFooterCard({ note }: { readonly note: string }) {
  const [value, setValue] = useState(note);

  const save = useServerAction(setInvoiceFooterAction, {
    refresh: true,
    onSuccess: () => toast.success("Pied de facture enregistré"),
    onError: (message) => toast.error(message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message en pied de facture</CardTitle>
        <CardDescription>
          Un message imprimé en bas de chaque note et facture.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Ex. : Merci de votre visite ! Service compris. Réservations au 04 00 00 00 00."
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription>
            300 caractères maximum. Laissez vide pour ne rien imprimer.
          </FieldDescription>
          <Button
            size="sm"
            disabled={save.isPending || value.trim() === note.trim()}
            onClick={() => save.execute({ note: value.trim() })}
          >
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
