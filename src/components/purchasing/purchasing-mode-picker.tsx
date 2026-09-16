"use client";

import { ReceiptTextIcon, WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { setPurchasingModeAction } from "@/actions/direct-purchase.actions";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";
import type { PurchasingMode } from "@/types/direct-purchase";

const OPTIONS = [
  {
    value: "DIRECT" as const,
    icon: ReceiptTextIcon,
    title: "Méthode directe",
    line: "J'achète → je paie → je photographie le ticket",
    text: "Pour le marché, le magasin, le dépannage du samedi. Un seul écran : le ticket, ce qu'il contient, et c'est enregistré — stock, prix et dépenses suivent.",
  },
  {
    value: "FULL" as const,
    icon: WorkflowIcon,
    title: "Chaîne complète",
    line: "Devis → Commande → Réception → Facture → Paiement",
    text: "Pour les fournisseurs réguliers qui livrent et facturent : vous comparez les prix, suivez ce qui est commandé, reçu, facturé et payé.",
  },
];

/**
 * How this restaurant buys. The choice only changes which screens are pushed
 * forward: the other way stays available, and a direct purchase is always
 * possible for the exceptional shop run.
 */
export function PurchasingModePicker({ mode, canEdit }: { readonly mode: PurchasingMode; readonly canEdit: boolean }) {
  const [current, setCurrent] = useState<PurchasingMode>(mode);

  const save = useServerAction(setPurchasingModeAction, {
    refresh: true,
    onSuccess: () => toast.success("Méthode d'achat enregistrée"),
    onError: (message) => {
      setCurrent(mode);
      toast.error(humanError(message));
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
      <div>
        <h2 className="text-base font-semibold">Comment achetez-vous ?</h2>
        <p className="text-sm text-muted-foreground">
          Les deux méthodes restent disponibles : ce choix décide seulement de ce qui est mis en avant. Même en chaîne
          complète, un achat direct reste possible pour un achat exceptionnel en magasin.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = current === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                active && "border-primary bg-primary/5",
                !canEdit && "cursor-not-allowed opacity-70",
              )}
            >
              <input
                type="radio"
                name="purchasing-mode"
                className="mt-1 size-4"
                checked={active}
                disabled={!canEdit || save.isPending}
                onChange={() => {
                  setCurrent(option.value);
                  save.execute({ mode: option.value });
                }}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="size-4" aria-hidden />
                  {option.title}
                </span>
                <span className="mt-0.5 block font-medium text-muted-foreground">{option.line}</span>
                <span className="mt-1 block text-muted-foreground">{option.text}</span>
              </span>
            </label>
          );
        })}
      </div>
      <Toaster />
    </section>
  );
}
