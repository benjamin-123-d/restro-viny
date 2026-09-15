"use client";

import { useState } from "react";
import { toast } from "sonner";

import { recordLossAction } from "@/actions/food-cost.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { formatCurrency } from "@/lib/format";
import { UNIT_LABELS, WASTE_REASONS } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { IngredientDTO, RecipeCardDTO } from "@/types/food-cost";

const toNumber = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
};

/** A spoiled ingredient or a dish that went in the bin, with its value frozen. */
export function LossForm({
  ingredients,
  dishes,
}: {
  readonly ingredients: readonly IngredientDTO[];
  readonly dishes: readonly RecipeCardDTO[];
}) {
  const [kind, setKind] = useState<"INGREDIENT" | "DISH">("INGREDIENT");
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(WASTE_REASONS[0]);

  const qty = toNumber(quantity);
  const ingredient = ingredients.find((i) => i.id === target);
  const dish = dishes.find((d) => d.menuItemId === target);
  const unitValue = kind === "INGREDIENT" ? (ingredient?.netUnitCost ?? null) : (dish?.portionCost ?? null);
  const value = qty == null || unitValue == null ? null : qty * unitValue;

  const save = useServerAction(recordLossAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Perte enregistrée");
      setQuantity("");
    },
    onError: (message, fieldErrors) => toast.error(Object.values(fieldErrors ?? {})[0]?.[0] ?? humanError(message)),
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5">
      <h2 className="text-base font-semibold">Déclarer une perte</h2>
      <div className="flex rounded-lg bg-muted p-0.5 text-sm font-medium" role="radiogroup" aria-label="Ce qui a été perdu">
        {(
          [
            ["INGREDIENT", "Un ingrédient"],
            ["DISH", "Un plat préparé"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={kind === key}
            onClick={() => {
              setKind(key);
              setTarget("");
            }}
            className={cn("flex-1 rounded-md px-3 py-2", kind === key ? "bg-background shadow-xs" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <label htmlFor="loss-target" className="text-sm font-medium">
            {kind === "INGREDIENT" ? "Ingrédient" : "Plat (avec fiche)"}
          </label>
          <select id="loss-target" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base">
            <option value="">Choisir…</option>
            {kind === "INGREDIENT"
              ? ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))
              : dishes.map((d) => (
                  <option key={d.menuItemId} value={d.menuItemId}>
                    {d.menuItemName}
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label htmlFor="loss-qty" className="text-sm font-medium">
            Quantité {kind === "INGREDIENT" && ingredient ? `(${UNIT_LABELS[ingredient.unit]})` : kind === "DISH" ? "(portions)" : ""}
          </label>
          <Input id="loss-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 h-11 text-right text-base" />
        </div>
        <div>
          <label htmlFor="loss-reason" className="text-sm font-medium">
            Motif
          </label>
          <Input id="loss-reason" list="loss-reasons" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-11" />
          <datalist id="loss-reasons">
            {[...WASTE_REASONS, "Assiette renvoyée", "Erreur de commande"].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {value != null && target ? <>Valeur de la perte : <strong className="text-foreground">{formatCurrency(value)}</strong></> : "La valeur est figée au coût du jour."}
        </p>
        <Button
          size="lg"
          disabled={save.isPending || !target}
          onClick={() =>
            save.execute({
              kind,
              stockItemId: kind === "INGREDIENT" ? target : undefined,
              menuItemId: kind === "DISH" ? target : undefined,
              quantity: qty,
              reason,
            })
          }
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer la perte"}
        </Button>
      </div>
      <Toaster />
    </section>
  );
}
