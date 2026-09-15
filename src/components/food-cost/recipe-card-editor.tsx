"use client";

import { BookOpenIcon, CheckCircle2Icon, PlusIcon, ScaleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  applyRecipeProposalAction,
  proposeRecipeCardAction,
  saveRecipeCardAction,
  verifyRecipeCardAction,
} from "@/actions/food-cost.actions";
import { ItemCombobox } from "@/components/forms/item-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";
import { dishEconomics, dishSentence, recipeCost } from "@/lib/food-cost";
import { formatRatio, formatUnitCost } from "@/lib/food-cost-format";
import { formatCurrency, formatDate } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import type { CatalogueProposalDTO, IngredientDTO, RecipeCardDTO } from "@/types/food-cost";

import { ReliabilityBadge } from "./reliability-badge";

interface Line {
  key: number;
  stockItemId: string;
  quantity: string;
}

let nextKey = 1;
const toNumber = (v: string): number => Number(v.replace(/\s/g, "").replace(",", "."));

export function RecipeCardEditor({
  card,
  ingredients,
  canEdit,
}: {
  readonly card: RecipeCardDTO;
  readonly ingredients: readonly IngredientDTO[];
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [portions, setPortions] = useState(String(card.portions));
  const [notes, setNotes] = useState(card.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    card.lines.length > 0
      ? card.lines.map((l) => ({ key: nextKey++, stockItemId: l.stockItemId, quantity: String(l.quantity) }))
      : [{ key: nextKey++, stockItemId: "", quantity: "" }],
  );
  const [proposal, setProposal] = useState<CatalogueProposalDTO | null>(null);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const filled = lines.filter((l) => l.stockItemId && toNumber(l.quantity) > 0);
  const portionCount = Math.max(1, Math.round(toNumber(portions)) || 1);
  const cost = recipeCost(
    filled.map((l) => ({ quantity: toNumber(l.quantity), netCost: byId.get(l.stockItemId)?.netUnitCost ?? null })),
    portionCount,
  );
  const economics = dishEconomics(cost.perPortion, card.priceHT);

  const run = (label: string, action: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      toast.success(label);
      router.refresh();
    });

  const propose = () =>
    startTransition(async () => {
      const result = await proposeRecipeCardAction({ menuItemId: card.menuItemId });
      if (!result.success || !result.data) {
        toast.error(humanError(result.error));
        return;
      }
      setProposal(result.data);
    });

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label htmlFor="portions" className="text-sm font-medium">
                Nombre de portions produites
              </label>
              <Input
                id="portions"
                inputMode="numeric"
                value={portions}
                onChange={(e) => setPortions(e.target.value)}
                className="mt-1 w-28 text-right text-base"
                disabled={!canEdit}
              />
            </div>
            {canEdit ? (
              <Button variant="outline" onClick={propose} disabled={pending}>
                <BookOpenIcon className="size-4" aria-hidden />
                Proposer une fiche (catalogue)
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Ingrédient</th>
                  <th className="py-1 text-right font-medium">Quantité brute</th>
                  <th className="py-1 text-right font-medium">Coût net</th>
                  <th className="py-1 text-right font-medium">Coût ligne</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const item = byId.get(line.stockItemId);
                  const qty = toNumber(line.quantity);
                  return (
                    <tr key={line.key} className="border-t">
                      <td className="py-1.5 pr-2">
                        <ItemCombobox
                          label="Ingrédient"
                          options={ingredients.map((i) => ({
                            id: i.id,
                            label: i.isPreparation ? `Base · ${i.name}` : i.name,
                            hint: UNIT_LABELS[i.unit],
                          }))}
                          value={line.stockItemId}
                          onChange={(stockItemId) => setLine(line.key, { stockItemId })}
                          disabled={!canEdit}
                          placeholder="Tapez l'ingrédient…"
                          className="min-w-52"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                            className="w-28 text-right"
                            disabled={!canEdit}
                            aria-label="Quantité brute"
                          />
                          <span className="w-16 text-xs text-muted-foreground">{item ? UNIT_LABELS[item.unit] : ""}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {item ? (
                          item.netUnitCost == null ? (
                            <span className="text-amber-700 dark:text-amber-400">sans prix</span>
                          ) : (
                            formatUnitCost(item.netUnitCost, item.unit)
                          )
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {item?.netUnitCost != null && qty > 0 ? formatCurrency(qty * item.netUnitCost) : "—"}
                      </td>
                      <td className="py-1.5 text-right">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setLines((c) => (c.length > 1 ? c.filter((l) => l.key !== line.key) : c))}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label="Retirer la ligne"
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setLines((c) => [...c, { key: nextKey++, stockItemId: "", quantity: "" }])}
            >
              <PlusIcon className="size-4" aria-hidden />
              Ajouter un ingrédient
            </Button>
          ) : null}

          <div>
            <label htmlFor="notes" className="text-sm font-medium">
              Notes de préparation
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!canEdit}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Grammage au dressage, cuisson…"
            />
          </div>

          {canEdit ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={pending || !card.hasCard}
                onClick={() => run("Fiche marquée vérifiée", () => verifyRecipeCardAction({ menuItemId: card.menuItemId }))}
                title="À faire après avoir pesé une vraie portion"
              >
                <ScaleIcon className="size-4" aria-hidden />
                J&apos;ai pesé une portion : vérifiée
              </Button>
              <Button
                disabled={pending || filled.length === 0}
                onClick={() =>
                  run("Fiche enregistrée (ajustée)", () =>
                    saveRecipeCardAction({
                      menuItemId: card.menuItemId,
                      portions: portionCount,
                      notes,
                      lines: filled.map((l) => ({ stockItemId: l.stockItemId, quantity: toNumber(l.quantity) })),
                    }),
                  )
                }
              >
                Enregistrer la fiche
              </Button>
            </div>
          ) : null}
        </section>

        {proposal ? (
          <section className="flex flex-col gap-3 rounded-xl border border-orange-300 bg-orange-50/60 p-4 text-sm dark:border-orange-800 dark:bg-orange-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Fiche type : {proposal.recipeName} ({proposal.portions} portions)</h2>
              <ReliabilityBadge reliability="ESTIMATED" />
            </div>
            <ul className="divide-y rounded-lg bg-background">
              {proposal.lines.map((l) => (
                <li key={l.ingredient} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {l.stockItemName ?? l.ingredient}
                    {!l.stockItemId ? (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">nouvel ingrédient, sans prix</span>
                    ) : l.quantity == null ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlertIcon className="size-3" aria-hidden />
                        unité à vérifier
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {l.catalogueQuantity.toLocaleString("fr-FR")} {l.catalogueUnit === "GRAM" ? "g" : l.catalogueUnit === "ML" ? "ml" : "pièce(s)"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Une fiche du catalogue est un point de départ : elle remplace la fiche actuelle et naît « Estimée ». Les ingrédients manquants sont créés sans prix — pensez à les renseigner.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProposal(null)}>
                Ignorer
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run("Fiche du catalogue appliquée (estimée)", async () => {
                    const result = await applyRecipeProposalAction({
                      menuItemId: card.menuItemId,
                      portions: proposal.portions,
                      lines: proposal.lines.map((l) => ({
                        stockItemId: l.stockItemId && l.quantity != null ? l.stockItemId : undefined,
                        ingredient: l.ingredient,
                        catalogueQuantity: l.catalogueQuantity,
                        catalogueUnit: l.catalogueUnit,
                        quantity: l.quantity ?? undefined,
                      })),
                    });
                    if (result.success) setProposal(null);
                    return result;
                  })
                }
              >
                Utiliser cette fiche
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Une portion</h2>
            {card.hasCard ? <ReliabilityBadge reliability={card.reliability} /> : null}
          </div>
          <p className="text-lg font-semibold leading-snug">{dishSentence(economics)}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Coût de la fiche</dt>
              <dd className="text-base font-semibold tabular-nums">{formatCurrency(cost.total)}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Ratio matière</dt>
              <dd className="text-base font-semibold tabular-nums">{formatRatio(economics.ratio)}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Prix de vente TTC</dt>
              <dd className="tabular-nums">{formatCurrency(card.priceTTC)}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Prix de vente HT</dt>
              <dd className="tabular-nums">{formatCurrency(card.priceHT)}</dd>
            </div>
          </dl>
          {!cost.complete ? (
            <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
              {cost.unpricedLines} ingrédient{cost.unpricedLines > 1 ? "s n'ont" : " n'a"} pas de prix : le coût est incomplet et ne sera pas figé sur les ventes tant qu&apos;il manque.
            </p>
          ) : null}
          {card.verifiedAt ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2Icon className="size-3.5" aria-hidden />
              Pesée le {formatDate(card.verifiedAt)}
            </p>
          ) : null}
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Coût de la fiche = Σ (quantité brute × coût net d&apos;usage). Coût par portion = coût de la fiche ÷ nombre de
          portions. Ratio = coût portion ÷ prix de vente HT. Aucune charge fixe (loyer, salaires, énergie) n&apos;entre dans ce calcul.
        </p>
      </aside>
      <Toaster />
    </div>
  );
}
