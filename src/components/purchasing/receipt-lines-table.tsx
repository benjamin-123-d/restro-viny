"use client";

import { EyeOffIcon, PlusIcon, SearchIcon, SparklesIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";

import { FieldHint } from "@/components/forms/help-box";
import { ItemCombobox, type CreatedItem } from "@/components/forms/item-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import { CATEGORY_DEFAULT_VAT, CATEGORY_LABEL, PURCHASE_CATEGORIES, type PurchaseCategory } from "@/lib/purchase-categories";
import {
  emptyLine,
  summarise,
  visibleLines,
  type LineFilter,
  type ReceiptLineDraft,
} from "@/lib/receipt-lines-state";
import { cn } from "@/lib/utils";
import type { IngredientDTO } from "@/types/food-cost";

const FILTERS: readonly { value: LineFilter; label: string }[] = [
  { value: "TOUT", label: "Tout" },
  { value: "A_TRAITER", label: "Reste à traiter" },
  ...PURCHASE_CATEGORIES.map((category) => ({ value: category as LineFilter, label: CATEGORY_LABEL[category] })),
];

/**
 * A supplier invoice has twenty lines; a screen that groups them by category
 * hides exactly what the owner needs to check. So: one row per printed line,
 * the family headings the invoice itself uses, and a toolbar to work through
 * them — search, filter, tick several at once, hide what is done.
 *
 * Everything stays correctable: the reading proposes, the owner decides.
 */
export function ReceiptLinesTable({
  lines,
  onChange,
  ingredients,
  amountsAre,
  ticketTotal,
}: {
  readonly lines: readonly ReceiptLineDraft[];
  readonly onChange: (next: ReceiptLineDraft[]) => void;
  readonly ingredients: readonly IngredientDTO[];
  readonly amountsAre: "HT" | "TTC";
  /** The ticket's own total, to show what is still unaccounted for. */
  readonly ticketTotal: number | undefined;
}) {
  const [filter, setFilter] = useState<LineFilter>("TOUT");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [created, setCreated] = useState<readonly CreatedItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const summary = summarise(lines);
  const shown = visibleLines(lines, filter, search);
  const gap = ticketTotal ? Math.round((ticketTotal - summary.total) * 100) / 100 : 0;

  // « Tout cocher » ticks what is on screen: with a filter on, that is exactly
  // the lines the owner is looking at — the others are not silently included.
  const learnedCount = lines.filter((line) => line.learned && !line.ignored).length;
  const allPicked = shown.length > 0 && shown.every((line) => picked.has(line.key));
  const somePicked = shown.some((line) => picked.has(line.key));
  const toggleAll = () =>
    setPicked((current) => {
      const next = new Set(current);
      for (const line of shown) {
        if (allPicked) next.delete(line.key);
        else next.add(line.key);
      }
      return next;
    });

  // Correcting a line the memory filled in makes it the owner's answer, so the
  // « appris » mark goes away.
  const decided = (patch: Partial<ReceiptLineDraft>): Partial<ReceiptLineDraft> =>
    "category" in patch || "stockItemId" in patch ? { ...patch, learned: false } : patch;

  const update = (key: string, patch: Partial<ReceiptLineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...decided(patch) } : line)));

  const updateMany = (keys: ReadonlySet<string>, patch: Partial<ReceiptLineDraft>) =>
    onChange(lines.map((line) => (keys.has(line.key) ? { ...line, ...decided(patch) } : line)));

  const toggle = (key: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // The invoice's own headings — « Brasserie », « Crèmerie » — keep the rows
  // in the order the person reading the paper expects.
  const groups = new Map<string, ReceiptLineDraft[]>();
  for (const line of shown) {
    const family = line.family ?? "Autres lignes";
    groups.set(family, [...(groups.get(family) ?? []), line]);
  }

  const options = ingredients.map((item) => ({
    id: item.id,
    label: item.name,
    hint: item.purchaseUnit ? `${item.purchaseUnit} · ${UNIT_LABELS[item.unit]}` : UNIT_LABELS[item.unit],
  }));
  const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative min-w-52 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher un produit ou un code…"
              className="h-10 pl-8"
            />
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}>
            <PlusIcon className="size-4" aria-hidden />
            Ligne oubliée
          </Button>
          {confirmClear ? (
            <span className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-sm">
              <span>Effacer les {lines.length} lignes ?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onChange([]);
                  setPicked(new Set());
                  setConfirmClear(false);
                }}
              >
                Oui, tout effacer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Annuler
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmClear(true)}
              disabled={lines.length === 0}
            >
              <Trash2Icon className="size-4" aria-hidden />
              Tout effacer
            </Button>
          )}
        </div>

        <label className="flex w-fit items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={allPicked}
            ref={(element) => {
              if (element) element.indeterminate = somePicked && !allPicked;
            }}
            onChange={toggleAll}
            disabled={shown.length === 0}
            className="size-4"
          />
          Tout cocher{shown.length > 0 ? ` (${shown.length} ligne${shown.length > 1 ? "s" : ""} affichée${shown.length > 1 ? "s" : ""})` : ""}
        </label>

        <nav aria-label="Filtrer les lignes" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === option.value ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </nav>

        {picked.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background p-2 text-sm">
            <span className="font-medium">
              {picked.size} ligne{picked.size > 1 ? "s" : ""} cochée{picked.size > 1 ? "s" : ""}
            </span>
            <select
              aria-label="Donner une catégorie aux lignes cochées"
              className={cn(select, "w-auto")}
              defaultValue=""
              onChange={(e) => {
                const category = e.target.value as PurchaseCategory;
                if (!category) return;
                updateMany(picked, { category, vatRate: CATEGORY_DEFAULT_VAT[category] });
                setPicked(new Set());
                e.target.value = "";
              }}
            >
              <option value="">Mettre toutes en…</option>
              {PURCHASE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                updateMany(picked, { ignored: true });
                setPicked(new Set());
              }}
            >
              <EyeOffIcon className="size-4" aria-hidden />
              Ignorer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
              Tout décocher
            </Button>
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune ligne ne correspond. Changez de filtre ou effacez la recherche.
        </p>
      ) : (
        [...groups].map(([family, rows]) => (
          <section key={family} className="flex flex-col gap-1.5">
            <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
              <span>{family}</span>
              <span className="tabular-nums">
                {rows.length} ligne{rows.length > 1 ? "s" : ""}
              </span>
            </h3>

            <ul className="flex flex-col gap-1.5">
              {rows.map((line) => (
                <li
                  key={line.key}
                  className={cn(
                    "grid gap-2 rounded-lg border p-2 sm:grid-cols-[1.5rem_minmax(0,2fr)_5rem_6rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem] sm:items-center",
                    line.ignored && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Cocher ${line.label}`}
                    checked={picked.has(line.key)}
                    onChange={() => toggle(line.key)}
                    className="size-4"
                  />

                  <div className="min-w-0">
                    <Input
                      aria-label="Libellé"
                      value={line.label}
                      onChange={(e) => update(line.key, { label: e.target.value })}
                      className="h-9"
                    />
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {line.code ? <span>réf. {line.code}</span> : null}
                      {line.learned ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium"
                          title="Catégorie retenue d'un achat précédent. Corrigez-la si besoin."
                        >
                          <SparklesIcon className="size-3" aria-hidden />
                          appris
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <Input
                    aria-label="Quantité"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                    placeholder="qté"
                    className="h-9 text-right"
                  />

                  <Input
                    aria-label={`Montant ${amountsAre}`}
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(e) => update(line.key, { amount: e.target.value })}
                    placeholder={`€ ${amountsAre}`}
                    className="h-9 text-right"
                  />

                  <select
                    aria-label="Catégorie"
                    value={line.category}
                    onChange={(e) => {
                      const category = e.target.value as PurchaseCategory;
                      update(line.key, { category, vatRate: CATEGORY_DEFAULT_VAT[category] });
                    }}
                    className={select}
                  >
                    {PURCHASE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABEL[category]}
                      </option>
                    ))}
                  </select>

                  <ItemCombobox
                    label="Ingrédient à mettre en stock"
                    placeholder="entre en stock ? tapez l'ingrédient"
                    options={options}
                    value={line.stockItemId ?? ""}
                    onChange={(id, fresh) => {
                      if (fresh) setCreated((list) => [...list, fresh]);
                      update(line.key, { stockItemId: id || null });
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => update(line.key, { ignored: !line.ignored })}
                    aria-label={line.ignored ? "Reprendre la ligne" : "Ignorer la ligne"}
                    title={line.ignored ? "Reprendre la ligne" : "Ignorer la ligne"}
                    className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    {line.ignored ? <Undo2Icon className="size-4" /> : <EyeOffIcon className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <span className="font-semibold tabular-nums">{summary.kept}</span>{" "}
            <span className="text-muted-foreground">ligne{summary.kept > 1 ? "s" : ""} gardée{summary.kept > 1 ? "s" : ""}</span>
          </span>
          <span>
            <span className="font-semibold tabular-nums">{formatCurrency(summary.total)}</span>{" "}
            <span className="text-muted-foreground">{amountsAre}</span>
          </span>
          {summary.linked > 0 ? (
            <span>
              <span className="font-semibold tabular-nums">{summary.linked}</span>{" "}
              <span className="text-muted-foreground">en stock</span>
            </span>
          ) : null}
          {summary.ignored > 0 ? (
            <span className="text-muted-foreground">{summary.ignored} ignorée{summary.ignored > 1 ? "s" : ""}</span>
          ) : null}
        </span>

        {ticketTotal ? (
          <span
            className={cn(
              "rounded-full px-3 py-1 font-medium",
              Math.abs(gap) <= 0.05
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
            )}
          >
            {Math.abs(gap) <= 0.05
              ? "Les lignes correspondent au ticket"
              : gap > 0
                ? `Il manque ${formatCurrency(gap)}`
                : `Dépassement de ${formatCurrency(-gap)}`}
          </span>
        ) : null}
      </div>

      <FieldHint>
        Reliez une ligne à un ingrédient pour qu&apos;elle entre en stock et mette à jour son prix d&apos;achat. Les lignes
        ignorées ne comptent ni dans les dépenses ni dans le stock. À l&apos;enregistrement, l&apos;application retient vos
        choix : le prochain ticket du même magasin arrivera déjà classé.
      </FieldHint>
      {learnedCount > 0 ? (
        <FieldHint>
          {learnedCount} ligne{learnedCount > 1 ? "s" : ""} classée{learnedCount > 1 ? "s" : ""} automatiquement d&apos;après
          vos achats précédents (marquées « appris »). Vérifiez-les : une correction remplace ce qui avait été retenu.
        </FieldHint>
      ) : null}
      {created.length > 0 ? (
        <FieldHint>
          {created.length} article{created.length > 1 ? "s" : ""} créé{created.length > 1 ? "s" : ""} pendant la saisie.
        </FieldHint>
      ) : null}
    </div>
  );
}
