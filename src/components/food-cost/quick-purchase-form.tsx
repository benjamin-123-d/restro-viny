"use client";

import { ShoppingBasketIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { recordPurchaseAction } from "@/actions/food-cost.actions";
import { FieldHint } from "@/components/forms/help-box";
import { ItemCombobox, type CreatedItem } from "@/components/forms/item-combobox";
import { UNIT_LABELS } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency } from "@/lib/format";
import type { IngredientDTO } from "@/types/food-cost";

const toNumber = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
};

/**
 * A market purchase in three fields, in the unit it was bought in:
 * « 2 paniers de tomates, 7 € ». Stock and price follow on their own.
 */
export function QuickPurchaseForm({ ingredients }: { readonly ingredients: readonly IngredientDTO[] }) {
  const [stockItemId, setStockItemId] = useState("");
  const [created, setCreated] = useState<CreatedItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const item =
    ingredients.find((i) => i.id === stockItemId) ??
    (created && created.id === stockItemId
      ? { name: created.label, unit: created.unit, purchaseUnit: created.purchaseUnit, purchaseFactor: created.purchaseFactor, lastPurchasePrice: created.lastPurchasePrice }
      : undefined);
  const qty = toNumber(quantity);
  const total = toNumber(amount);
  const unitName = item?.purchaseUnit ?? "unité";

  const save = useServerAction(recordPurchaseAction, {
    refresh: true,
    onSuccess: () => {
      toast.success(`Achat enregistré : ${item?.name ?? ""}`);
      setQuantity("");
      setAmount("");
      setNote("");
      setErrors({});
    },
    onError: (message, fieldErrors) => {
      setErrors(Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])));
      toast.error(humanError(message));
    },
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShoppingBasketIcon className="size-4" aria-hidden />
        Enregistrer un achat
      </h2>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label htmlFor="pur-item" className="text-sm font-medium">
            Ingrédient
          </label>
          <ItemCombobox
            id="pur-item"
            label="Ingrédient"
            options={ingredients.map((i) => ({
              id: i.id,
              label: i.name,
              hint: i.purchaseUnit ? `${i.purchaseUnit} · ${UNIT_LABELS[i.unit]}` : UNIT_LABELS[i.unit],
            }))}
            value={stockItemId}
            onChange={(id, newItem) => {
              setStockItemId(id);
              if (newItem) setCreated(newItem);
            }}
            invalid={Boolean(errors.stockItemId)}
            className="mt-1"
          />
          {errors.stockItemId ? <p className="text-xs text-destructive">{errors.stockItemId}</p> : null}
        </div>
        <div>
          <label htmlFor="pur-qty" className="text-sm font-medium">
            Quantité ({unitName}s)
          </label>
          <Input id="pur-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 h-11 text-right text-base" placeholder="2" />
          {errors.quantity ? <p className="text-xs text-destructive">{errors.quantity}</p> : null}
        </div>
        <div>
          <label htmlFor="pur-amount" className="text-sm font-medium">
            Montant payé HT (€)
          </label>
          <Input id="pur-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 text-right text-base" placeholder="7,00" />
          {errors.amount ? <p className="text-xs text-destructive">{errors.amount}</p> : null}
        </div>
      </div>
      <div>
        <label htmlFor="pur-note" className="text-sm font-medium">
          Remarque
        </label>
        <Input id="pur-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" placeholder="Marché de Rungis, fournisseur…" />
      </div>

      {item && qty && total ? (
        <p className="rounded-lg bg-muted/60 p-3 text-sm">
          + {formatQuantity(qty * item.purchaseFactor, item.unit)} en stock · {formatCurrency(total / qty)} le {unitName}
          {item.lastPurchasePrice != null ? (
            <span className="text-muted-foreground"> (dernier prix : {formatCurrency(item.lastPurchasePrice)})</span>
          ) : null}
        </p>
      ) : (
        <FieldHint>Saisissez dans l&apos;unité où vous avez acheté : « 2 paniers », pas « 16 000 g ». La conversion est faite pour vous.</FieldHint>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={save.isPending || !stockItemId}
          onClick={() => save.execute({ stockItemId, quantity: qty, amount: total, note })}
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer l'achat"}
        </Button>
      </div>
      <Toaster />
    </section>
  );
}
