"use client";

import { ChefHatIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordProductionAction, savePreparationAction } from "@/actions/food-cost.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";
import { formatQuantity, formatUnitCost } from "@/lib/food-cost-format";
import { formatCurrency } from "@/lib/format";
import { STOCK_UNIT_OPTIONS, UNIT_LABELS } from "@/lib/inventory";
import type { IngredientDTO, PreparationDTO } from "@/types/food-cost";
import type { StockUnit } from "@/types/inventory";

const toNumber = (v: string): number => Number(v.replace(/\s/g, "").replace(",", "."));

interface Line {
  key: number;
  stockItemId: string;
  quantity: string;
}
let nextKey = 1;

function PreparationEditor({
  initial,
  ingredients,
  onDone,
}: {
  readonly initial: PreparationDTO | null;
  readonly ingredients: readonly IngredientDTO[];
  readonly onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState<StockUnit>(initial?.unit ?? "ML");
  const [yieldQty, setYieldQty] = useState(initial?.preparationYield != null ? String(initial.preparationYield) : "");
  const [location, setLocation] = useState(initial?.storageLocation ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines.length
      ? initial.lines.map((l) => ({ key: nextKey++, stockItemId: l.stockItemId, quantity: String(l.quantity) }))
      : [{ key: nextKey++, stockItemId: "", quantity: "" }],
  );

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const filled = lines.filter((l) => l.stockItemId && toNumber(l.quantity) > 0);
  const batch = filled.reduce((s, l) => s + toNumber(l.quantity) * (byId.get(l.stockItemId)?.netUnitCost ?? 0), 0);
  const perUnit = toNumber(yieldQty) > 0 ? batch / toNumber(yieldQty) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-foreground/20 bg-card p-4">
      <h2 className="text-base font-semibold">{initial ? `Modifier « ${initial.name} »` : "Nouvelle base"}</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="prep-name">Nom</label>
          <Input id="prep-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sauce tomate maison" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="prep-yield">Quantité produite</label>
          <Input id="prep-yield" inputMode="decimal" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} placeholder="2000" className="mt-1 text-right" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="prep-unit">Unité</label>
          <select id="prep-unit" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            {STOCK_UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="prep-location">Lieu de rangement</label>
          <Input id="prep-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chambre froide" className="mt-1" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Ingrédients bruts pour cette quantité</p>
        {lines.map((line) => {
          const item = byId.get(line.stockItemId);
          return (
            <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_7rem_3rem_2rem] items-center gap-2">
              <select
                value={line.stockItemId}
                onChange={(e) => setLines((c) => c.map((l) => (l.key === line.key ? { ...l, stockItemId: e.target.value } : l)))}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                aria-label="Ingrédient"
              >
                <option value="">Choisir…</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <Input
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => setLines((c) => c.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))}
                className="text-right"
                aria-label="Quantité"
              />
              <span className="text-xs text-muted-foreground">{item ? UNIT_LABELS[item.unit] : ""}</span>
              <button
                type="button"
                onClick={() => setLines((c) => (c.length > 1 ? c.filter((l) => l.key !== line.key) : c))}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Retirer"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="self-start" onClick={() => setLines((c) => [...c, { key: nextKey++, stockItemId: "", quantity: "" }])}>
          <PlusIcon className="size-4" aria-hidden />
          Ajouter un ingrédient
        </Button>
      </div>

      <p className="rounded-lg bg-muted/60 p-3 text-sm">
        Coût de la recette : <strong>{formatCurrency(batch)}</strong> · soit {formatUnitCost(perUnit, unit)}
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Annuler</Button>
        <Button
          disabled={pending || filled.length === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await savePreparationAction({
                id: initial?.id,
                name,
                unit,
                preparationYield: toNumber(yieldQty),
                storageLocation: location,
                lines: filled.map((l) => ({ stockItemId: l.stockItemId, quantity: toNumber(l.quantity) })),
              });
              if (!result.success) {
                toast.error(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? humanError(result.error));
                return;
              }
              toast.success("Base enregistrée");
              onDone();
              router.refresh();
            })
          }
        >
          Enregistrer la base
        </Button>
      </div>
    </section>
  );
}

function ProduceButton({ preparation }: { readonly preparation: PreparationDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(preparation.preparationYield != null ? String(preparation.preparationYield) : "");
  return (
    <div className="flex items-center gap-2">
      <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24 text-right" aria-label={`Quantité de ${preparation.name} à produire`} />
      <span className="text-xs text-muted-foreground">{UNIT_LABELS[preparation.unit]}</span>
      <Button
        size="sm"
        disabled={pending || !(toNumber(quantity) > 0)}
        onClick={() =>
          startTransition(async () => {
            const result = await recordProductionAction({ preparationId: preparation.id, quantity: toNumber(quantity) });
            if (!result.success) {
              toast.error(humanError(result.error));
              return;
            }
            toast.success(`Production enregistrée : ${preparation.name}`);
            router.refresh();
          })
        }
      >
        <ChefHatIcon className="size-4" aria-hidden />
        Produire
      </Button>
    </div>
  );
}

export function PreparationManager({
  preparations,
  ingredients,
  canEdit,
}: {
  readonly preparations: readonly PreparationDTO[];
  readonly ingredients: readonly IngredientDTO[];
  readonly canEdit: boolean;
}) {
  const [editing, setEditing] = useState<PreparationDTO | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && editing === null ? (
        <Button className="self-end" onClick={() => setEditing("new")}>
          <PlusIcon className="size-4" aria-hidden />
          Nouvelle base
        </Button>
      ) : null}
      {editing ? (
        <PreparationEditor initial={editing === "new" ? null : editing} ingredients={ingredients} onDone={() => setEditing(null)} />
      ) : null}

      {preparations.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune base pour l&apos;instant.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {preparations.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Recette pour {p.preparationYield != null ? formatQuantity(p.preparationYield, p.unit) : "—"} · coût {formatUnitCost(p.unitCost, p.unit)}
                  </p>
                </div>
                {canEdit ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Modifier</Button>
                ) : null}
              </div>
              <ul className="text-sm text-muted-foreground">
                {p.lines.map((l) => (
                  <li key={l.stockItemId}>
                    {l.name} — {formatQuantity(l.quantity, l.unit)}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                <span>
                  En stock : <strong>{formatQuantity(p.onHand, p.unit)}</strong>
                </span>
                {canEdit ? <ProduceButton preparation={p} /> : null}
              </div>
              {!p.complete ? <p className="text-xs text-amber-700 dark:text-amber-400">Un ingrédient n&apos;a pas de prix : la production est bloquée tant qu&apos;il manque.</p> : null}
            </li>
          ))}
        </ul>
      )}
      <Toaster />
    </div>
  );
}
