"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { setSubRecipesAction } from "@/actions/food-cost.actions";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: false,
    title: "Sans sous-recettes",
    text: "Les fiches n'utilisent que des ingrédients bruts. Chaque vente sort directement les ingrédients du stock.",
  },
  {
    value: true,
    title: "Avec sous-recettes",
    text: "Vous préparez des bases à l'avance (sauce, fond, pâte). Elles ont leur fiche, se produisent et se stockent.",
  },
] as const;

/** One of two ways to run the kitchen's stock: pick one, change later if needed. */
export function SubRecipesToggle({ enabled, canEdit }: { readonly enabled: boolean; readonly canEdit: boolean }) {
  const [value, setValue] = useState(enabled);
  const save = useServerAction(setSubRecipesAction, {
    refresh: true,
    onSuccess: (saved) => toast.success(saved ? "Sous-recettes activées : l'onglet « Bases » est disponible" : "Sous-recettes désactivées"),
    onError: (message) => {
      setValue(enabled);
      toast.error(humanError(message));
    },
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode de gestion des bases">
      {OPTIONS.map((option) => {
        const checked = value === option.value;
        return (
          <button
            key={option.title}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={!canEdit || save.isPending}
            onClick={() => {
              if (checked) return;
              setValue(option.value);
              save.execute({ enabled: option.value });
            }}
            className={cn(
              "flex gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed",
              checked ? "border-foreground bg-muted" : "hover:bg-muted/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                checked && "border-foreground bg-foreground text-background",
              )}
            >
              {checked ? <CheckIcon className="size-3.5" /> : null}
            </span>
            <span>
              <span className="block font-semibold">{option.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{option.text}</span>
            </span>
          </button>
        );
      })}
      <Toaster />
    </div>
  );
}
