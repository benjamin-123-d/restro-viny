"use client";

import { PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { saveIngredientAction } from "@/actions/food-cost.actions";
import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { netUsageCost } from "@/lib/food-cost";
import { formatQuantity, formatUnitCost } from "@/lib/food-cost-format";
import { formatCurrency } from "@/lib/format";
import { STOCK_UNIT_OPTIONS, UNIT_LABELS } from "@/lib/inventory";
import type { IngredientDTO } from "@/types/food-cost";
import type { StockUnit } from "@/types/inventory";

const toNumber = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
};

interface FormState {
  id?: string;
  name: string;
  unit: StockUnit;
  category: string;
  purchaseUnit: string;
  purchaseFactor: string;
  lastPurchasePrice: string;
  yieldPercent: string;
  storageLocation: string;
  storageOrder: string;
}

const blank: FormState = {
  name: "",
  unit: "GRAM",
  category: "",
  purchaseUnit: "",
  purchaseFactor: "1",
  lastPurchasePrice: "",
  yieldPercent: "100",
  storageLocation: "",
  storageOrder: "0",
};

const fromIngredient = (i: IngredientDTO): FormState => ({
  id: i.id,
  name: i.name,
  unit: i.unit,
  category: i.category ?? "",
  purchaseUnit: i.purchaseUnit ?? "",
  purchaseFactor: String(i.purchaseFactor),
  lastPurchasePrice: i.lastPurchasePrice != null ? String(i.lastPurchasePrice) : "",
  yieldPercent: String(i.yieldPercent),
  storageLocation: i.storageLocation ?? "",
  storageOrder: String(i.storageOrder),
});

function IngredientDialog({
  initial,
  locations,
  onClose,
}: {
  readonly initial: FormState;
  readonly locations: readonly string[];
  readonly onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = useServerAction(saveIngredientAction, {
    refresh: true,
    onSuccess: () => {
      toast.success(form.id ? "Ingrédient corrigé" : "Ingrédient ajouté");
      onClose();
    },
    onError: (message, fieldErrors) => {
      setErrors(Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])));
      toast.error(humanError(message));
    },
  });

  const factor = toNumber(form.purchaseFactor) ?? 1;
  const price = toNumber(form.lastPurchasePrice);
  const yieldPct = toNumber(form.yieldPercent) ?? 100;
  const net = netUsageCost({ purchasePrice: price ?? null, purchaseFactor: factor, yieldPercent: yieldPct });
  const usage = UNIT_LABELS[form.unit];

  const field = (key: keyof FormState, label: string, hint: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={`ing-${key}`}>
        {label}
      </label>
      {input}
      {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : <FieldHint>{hint}</FieldHint>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? `Corriger « ${initial.name} »` : "Ajouter un ingrédient"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Libellé", "Le nom que vous employez en cuisine.", (
            <Input id="ing-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Tomate fraîche" />
          ))}
          {field("unit", "Unité d'usage", "L'unité des fiches techniques et de l'inventaire.", (
            <select id="ing-unit" value={form.unit} onChange={(e) => set("unit")(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {STOCK_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          {field("purchaseUnit", "Unité d'achat", "Comme vous l'achetez : panier, carton de 6, sac de 25 kg…", (
            <Input id="ing-purchaseUnit" value={form.purchaseUnit} onChange={(e) => set("purchaseUnit")(e.target.value)} placeholder="Panier" />
          ))}
          {field("purchaseFactor", `1 unité d'achat = combien de ${usage} ?`, "Le coefficient : 1 panier = 8 000 g.", (
            <Input id="ing-purchaseFactor" inputMode="decimal" value={form.purchaseFactor} onChange={(e) => set("purchaseFactor")(e.target.value)} className="text-right" />
          ))}
          {field("lastPurchasePrice", "Dernier prix payé (HT)", `Pour 1 ${form.purchaseUnit || "unité d'achat"}. Mis à jour à chaque achat.`, (
            <Input id="ing-lastPurchasePrice" inputMode="decimal" value={form.lastPurchasePrice} onChange={(e) => set("lastPurchasePrice")(e.target.value)} placeholder="3,50" className="text-right" />
          ))}
          {field("yieldPercent", "Taux de rendement (%)", "La part utilisable après épluchage, parage, os… 100 % si rien ne se perd.", (
            <Input id="ing-yieldPercent" inputMode="decimal" value={form.yieldPercent} onChange={(e) => set("yieldPercent")(e.target.value)} className="text-right" />
          ))}
          {field("storageLocation", "Lieu de rangement", "Chambre froide, réserve sèche, cave… L'inventaire suit cet ordre.", (
            <>
              <Input id="ing-storageLocation" list="ing-locations" value={form.storageLocation} onChange={(e) => set("storageLocation")(e.target.value)} placeholder="Chambre froide" />
              <datalist id="ing-locations">
                {locations.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </>
          ))}
          {field("storageOrder", "Ordre sur l'étagère", "0, 1, 2… pour compter dans l'ordre où vous marchez.", (
            <Input id="ing-storageOrder" inputMode="numeric" value={form.storageOrder} onChange={(e) => set("storageOrder")(e.target.value)} className="text-right" />
          ))}
          {field("category", "Famille", "Légumes, viandes, épicerie… sert à cibler les recomptages.", (
            <Input id="ing-category" value={form.category} onChange={(e) => set("category")(e.target.value)} placeholder="Légumes" />
          ))}
        </div>

        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">Coût net d&apos;usage : {formatUnitCost(net, form.unit)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            (Prix d&apos;achat ÷ coefficient) ÷ taux de rendement
            {price != null ? ` = (${formatCurrency(price)} ÷ ${factor.toLocaleString("fr-FR")}) ÷ ${(yieldPct / 100).toLocaleString("fr-FR")}` : ""}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.execute({
                id: form.id,
                name: form.name,
                unit: form.unit,
                category: form.category,
                purchaseUnit: form.purchaseUnit,
                purchaseFactor: toNumber(form.purchaseFactor),
                lastPurchasePrice: toNumber(form.lastPurchasePrice),
                yieldPercent: toNumber(form.yieldPercent),
                storageLocation: form.storageLocation,
                storageOrder: toNumber(form.storageOrder),
              })
            }
          >
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IngredientManager({
  ingredients,
  canEdit,
}: {
  readonly ingredients: readonly IngredientDTO[];
  readonly canEdit: boolean;
}) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [query, setQuery] = useState("");

  const raw = ingredients.filter((i) => !i.isPreparation);
  const locations = [...new Set(raw.map((i) => i.storageLocation).filter((l): l is string => Boolean(l)))];
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, IngredientDTO[]>();
    for (const i of raw) {
      if (q && !i.name.toLowerCase().includes(q)) continue;
      const key = i.storageLocation ?? "Sans lieu de rangement";
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()];
  }, [raw, query]);
  const totalValue = raw.reduce((s, i) => s + (i.stockValue ?? 0), 0);
  const unpriced = raw.filter((i) => i.netUnitCost == null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un ingrédient" className="pl-8" aria-label="Rechercher un ingrédient" />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {raw.length} ingrédients · stock valorisé <strong className="text-foreground">{formatCurrency(totalValue)}</strong>
            {unpriced > 0 ? <span className="text-amber-700 dark:text-amber-400"> · {unpriced} sans prix</span> : null}
          </span>
          {canEdit ? (
            <Button onClick={() => setEditing(blank)}>
              <PlusIcon className="size-4" aria-hidden />
              Ajouter
            </Button>
          ) : null}
        </div>
      </div>

      {groups.map(([location, items]) => (
        <section key={location} className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">{location}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Ingrédient</th>
                  <th className="px-3 py-2 text-left font-medium">Achat</th>
                  <th className="px-3 py-2 text-right font-medium">Dernier prix HT</th>
                  <th className="px-3 py-2 text-right font-medium">Rendement</th>
                  <th className="px-3 py-2 text-right font-medium">Coût net</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-2 font-medium">
                      {i.name}
                      {i.category ? <span className="block text-xs font-normal text-muted-foreground">{i.category}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {i.purchaseUnit ? `1 ${i.purchaseUnit} = ${formatQuantity(i.purchaseFactor, i.unit)}` : `à l'${UNIT_LABELS[i.unit]}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.lastPurchasePrice != null ? formatCurrency(i.lastPurchasePrice) : <span className="text-amber-700 dark:text-amber-400">à saisir</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.yieldPercent.toLocaleString("fr-FR")} %</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatUnitCost(i.netUnitCost, i.unit)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i.onHand < 0 ? "text-red-600" : ""}`}>{formatQuantity(i.onHand, i.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.stockValue != null ? formatCurrency(i.stockValue) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {canEdit ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(fromIngredient(i))}>
                          <PencilIcon className="size-3.5" aria-hidden />
                          Corriger
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {editing ? <IngredientDialog initial={editing} locations={locations} onClose={() => setEditing(null)} /> : null}
      <Toaster />
    </div>
  );
}
