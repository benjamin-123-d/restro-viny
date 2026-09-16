"use client";

import { CookingPotIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { declareProductionAction } from "@/actions/staff-declarations.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { UNIT_LABELS } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { StockUnit } from "@/types/inventory";

const toNumber = (value: string): number | undefined => {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() === "" || Number.isNaN(n) ? undefined : n;
};

/**
 * « J'ai fait 4 litres de sauce tomate » : the ingredients leave the stock and
 * the base enters it, in one tap, so the food cost follows the kitchen.
 */
export function StaffProductionForm({
  preparations,
}: {
  readonly preparations: readonly {
    readonly id: string;
    readonly name: string;
    readonly unit: StockUnit;
    readonly batchYield: number | null;
  }[];
}) {
  const router = useRouter();
  const [preparationId, setPreparationId] = useState(preparations[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");

  const chosen = preparations.find((p) => p.id === preparationId);

  const send = useServerAction(declareProductionAction, {
    onSuccess: () => {
      toast.success("Production enregistrée. Merci !");
      setQuantity("");
      router.refresh();
    },
    onError: (message) => toast.error(humanError(message)),
  });

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-base font-medium">Qu&apos;avez-vous préparé ?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {preparations.map((preparation) => (
            <button
              key={preparation.id}
              type="button"
              onClick={() => setPreparationId(preparation.id)}
              aria-pressed={preparation.id === preparationId}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 text-left text-base font-medium",
                preparation.id === preparationId ? "border-primary bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              <span>{preparation.name}</span>
              {preparation.batchYield ? (
                <span className="text-sm font-normal opacity-80">
                  fournée : {preparation.batchYield.toLocaleString("fr-FR")} {UNIT_LABELS[preparation.unit]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-base font-medium">Combien avez-vous produit ?</span>
        <div className="mt-2 flex items-center gap-3">
          <Input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={chosen?.batchYield ? String(chosen.batchYield).replace(".", ",") : "4"}
            className="h-16 w-40 text-right text-xl"
          />
          <span className="text-lg text-muted-foreground">{chosen ? UNIT_LABELS[chosen.unit] : ""}</span>
        </div>
      </label>

      <Button
        size="lg"
        className="h-16 w-full text-base"
        disabled={send.isPending || !preparationId || !toNumber(quantity)}
        onClick={() => send.execute({ preparationId, quantity: toNumber(quantity) })}
      >
        <CookingPotIcon className="size-5" aria-hidden />
        {send.isPending ? "Envoi…" : "Enregistrer la production"}
      </Button>
      <Toaster />
    </div>
  );
}
