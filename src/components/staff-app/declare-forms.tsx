"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { declareBreakageAction, declareStaffLossAction } from "@/actions/staff-declarations.actions";
import { ItemCombobox } from "@/components/forms/item-combobox";
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

const Choice = ({
  options,
  value,
  onChange,
  label,
}: {
  readonly options: readonly string[];
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: string;
}) => (
  <fieldset>
    <legend className="text-base font-medium">{label}</legend>
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "min-h-12 rounded-xl border px-4 text-base font-medium",
            value === option ? "border-primary bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  </fieldset>
);

const LOSS_REASONS = ["Avarié", "Date dépassée", "Renversé", "Raté / refait", "Refusé par le client", "Repas du personnel"];

/**
 * A loss declared by the kitchen or the room: an ingredient thrown away, or a
 * dish that never made it to the table. Valued on the spot, counted in the
 * food cost, signed with the name of whoever declared it.
 */
export function StaffLossForm({
  ingredients,
  dishes,
}: {
  readonly ingredients: readonly { readonly id: string; readonly name: string; readonly unit: StockUnit }[];
  readonly dishes: readonly { readonly id: string; readonly name: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"INGREDIENT" | "DISH">("DISH");
  const [targetId, setTargetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(LOSS_REASONS[0]);

  const unit = ingredients.find((i) => i.id === targetId)?.unit;

  const send = useServerAction(declareStaffLossAction, {
    onSuccess: () => {
      toast.success("Perte déclarée. Merci d'avoir prévenu.");
      setTargetId("");
      setQuantity("");
      router.refresh();
    },
    onError: (message) => toast.error(humanError(message)),
  });

  return (
    <div className="flex flex-col gap-5">
      <Choice
        label="C'est quoi ?"
        options={["Un plat", "Un ingrédient"]}
        value={kind === "DISH" ? "Un plat" : "Un ingrédient"}
        onChange={(next) => {
          setKind(next === "Un plat" ? "DISH" : "INGREDIENT");
          setTargetId("");
        }}
      />

      <div>
        <p className="text-base font-medium">{kind === "DISH" ? "Quel plat ?" : "Quel ingrédient ?"}</p>
        <ItemCombobox
          label={kind === "DISH" ? "Plat" : "Ingrédient"}
          placeholder="Tapez les premières lettres…"
          options={(kind === "DISH" ? dishes : ingredients).map((item) => ({ id: item.id, label: item.name }))}
          value={targetId}
          onChange={setTargetId}
          allowCreate={false}
          className="mt-2"
        />
      </div>

      <label className="block">
        <span className="text-base font-medium">Combien ?</span>
        <div className="mt-2 flex items-center gap-3">
          <Input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={kind === "DISH" ? "1" : "0,5"}
            className="h-16 w-40 text-right text-xl"
          />
          <span className="text-lg text-muted-foreground">
            {kind === "DISH" ? "portion(s)" : unit ? UNIT_LABELS[unit] : ""}
          </span>
        </div>
      </label>

      <Choice label="Pourquoi ?" options={LOSS_REASONS} value={reason} onChange={setReason} />

      <Button
        size="lg"
        className="h-16 w-full text-base"
        disabled={send.isPending || !targetId || !toNumber(quantity)}
        onClick={() =>
          send.execute({
            kind,
            stockItemId: kind === "INGREDIENT" ? targetId : undefined,
            menuItemId: kind === "DISH" ? targetId : undefined,
            quantity: toNumber(quantity),
            reason,
          })
        }
      >
        {send.isPending ? "Envoi…" : "Déclarer la perte"}
      </Button>
      <Toaster />
    </div>
  );
}

const BREAKAGE_ITEMS = ["Verre", "Assiette", "Tasse", "Couvert", "Carafe", "Plat de service"];
const BREAKAGE_REASONS = ["Tombé", "Cassé au lavage", "Client", "Usure"];

/**
 * A glass or a plate broken in the room. Recorded with its value, and kept out
 * of the food cost: a broken glass is not what the kitchen ate.
 */
export function BreakageForm() {
  const router = useRouter();
  const [label, setLabel] = useState(BREAKAGE_ITEMS[0]);
  const [custom, setCustom] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitValue, setUnitValue] = useState("");
  const [reason, setReason] = useState(BREAKAGE_REASONS[0]);

  const send = useServerAction(declareBreakageAction, {
    onSuccess: () => {
      toast.success("Casse déclarée. Merci d'avoir prévenu.");
      setQuantity("1");
      setCustom("");
      setUnitValue("");
      router.refresh();
    },
    onError: (message) => toast.error(humanError(message)),
  });

  const finalLabel = custom.trim() || label;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-muted/60 p-4 text-base">
        Ici, c&apos;est la vaisselle et le matériel. Un plat renversé ou refait se déclare dans{" "}
        <span className="font-medium">Pertes</span>.
      </p>

      <Choice label="Qu'est-ce qui est cassé ?" options={BREAKAGE_ITEMS} value={label} onChange={setLabel} />

      <label className="block">
        <span className="text-base font-medium">Autre chose ?</span>
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Écrivez-le ici"
          className="mt-2 h-14 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-base font-medium">Combien ?</span>
          <Input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-2 h-16 text-right text-xl"
          />
        </label>
        <label className="block">
          <span className="text-base font-medium">Valeur à l&apos;unité</span>
          <Input
            inputMode="decimal"
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
            placeholder="€ (facultatif)"
            className="mt-2 h-16 text-right text-xl"
          />
        </label>
      </div>

      <Choice label="Comment ?" options={BREAKAGE_REASONS} value={reason} onChange={setReason} />

      <Button
        size="lg"
        className="h-16 w-full text-base"
        disabled={send.isPending || !finalLabel || !toNumber(quantity)}
        onClick={() =>
          send.execute({
            label: finalLabel,
            quantity: toNumber(quantity),
            unitValue: toNumber(unitValue),
            reason,
          })
        }
      >
        {send.isPending ? "Envoi…" : "Déclarer la casse"}
      </Button>
      <Toaster />
    </div>
  );
}
