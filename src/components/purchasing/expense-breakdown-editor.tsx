"use client";

import { CheckCircle2Icon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";

import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VAT_RATES,
  remainderToType,
  toExpenseLines,
  type BreakdownRow,
  type BreakdownState,
} from "@/lib/expense-breakdown-state";
import { formatCurrency } from "@/lib/format";
import {
  BREAKDOWN_TOLERANCE,
  CATEGORY_DEFAULT_VAT,
  CATEGORY_HINT,
  CATEGORY_LABEL,
  PURCHASE_CATEGORIES,
  breakdownGap,
  breakdownTotals,
  type PurchaseCategory,
} from "@/lib/purchase-categories";
import { cn } from "@/lib/utils";

const rateLabel = (rate: number): string => `${rate.toLocaleString("fr-FR")} %`;

let rowSeq = 0;
export const newBreakdownRow = (category: PurchaseCategory = "DENREES", amount = "", label = ""): BreakdownRow => ({
  key: `row-${Date.now()}-${rowSeq++}`,
  category,
  label,
  amount,
  vatRate: CATEGORY_DEFAULT_VAT[category],
});

/**
 * « Ce document contient-il autre chose que de la nourriture ? » — then, if
 * so, one row per kind of spending until the total of the document is reached.
 */
export function ExpenseBreakdownEditor({
  value,
  onChange,
  totalTTC,
  documentWord = "ticket",
  error,
}: {
  readonly value: BreakdownState;
  readonly onChange: (next: BreakdownState) => void;
  readonly totalTTC: number | undefined;
  /** « ticket » or « facture », for the wording. */
  readonly documentWord?: string;
  readonly error?: string;
}) {
  const lines = toExpenseLines(value, totalTTC);
  const totals = breakdownTotals(lines);
  const gap = totalTTC ? breakdownGap(lines, totalTTC) : 0;
  const balanced = Boolean(totalTTC) && Math.abs(gap) <= BREAKDOWN_TOLERANCE;

  const setRow = (key: string, patch: Partial<BreakdownRow>) =>
    onChange({ ...value, rows: value.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)) });

  const answer = (mixed: boolean) =>
    onChange({
      ...value,
      mixed,
      rows:
        mixed && value.rows.length === 0
          ? [newBreakdownRow("DENREES", totalTTC ? String(totalTTC).replace(".", ",") : ""), newBreakdownRow("ENTRETIEN")]
          : value.rows,
    });

  const select = "h-10 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-sm font-medium">
          Ce {documentWord} contient-il autre chose que de la nourriture et des boissons ?
        </legend>
        <FieldHint>
          Produits d&apos;entretien, matériel, emballages… Les séparer montre ce que coûte vraiment la cuisine : seules les
          denrées et les boissons comptent dans le food cost.
        </FieldHint>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            { mixed: false, title: "Non, que de l'alimentaire", text: "Tout le montant est rangé dans une seule catégorie." },
            { mixed: true, title: "Oui, il y a autre chose", text: "Je répartis le montant entre plusieurs catégories." },
          ].map((option) => (
            <label
              key={String(option.mixed)}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="breakdown-mixed"
                checked={value.mixed === option.mixed}
                onChange={() => answer(option.mixed)}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">{option.title}</span>
                <span className="text-muted-foreground">{option.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {value.mixed === false ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Catégorie</span>
            <select
              value={value.singleCategory}
              onChange={(e) => {
                const category = e.target.value as PurchaseCategory;
                onChange({ ...value, singleCategory: category, singleRate: CATEGORY_DEFAULT_VAT[category] });
              }}
              className={cn(select, "mt-1")}
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <FieldHint>{CATEGORY_HINT[value.singleCategory]}</FieldHint>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Taux de TVA</span>
            <select
              value={value.singleRate}
              onChange={(e) => onChange({ ...value, singleRate: Number(e.target.value) })}
              className={cn(select, "mt-1")}
            >
              {VAT_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rateLabel(rate)}
                </option>
              ))}
            </select>
            <FieldHint>5,5 % pour l&apos;alimentaire, 20 % pour l&apos;alcool et le non-alimentaire.</FieldHint>
          </label>
        </div>
      ) : null}

      {value.mixed ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Les montants que je recopie sont</span>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["TTC", "HT"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...value, amountsAre: mode })}
                  aria-pressed={value.amountsAre === mode}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium text-muted-foreground",
                    value.amountsAre === mode && "bg-background text-foreground shadow-sm",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Ticket de magasin : TTC. Facture de grossiste : souvent HT.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {value.rows.map((row) => (
              <div key={row.key} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_7rem_6rem_2.25rem] sm:items-start sm:border-0 sm:p-0">
                <div>
                  <select
                    aria-label="Catégorie"
                    value={row.category}
                    onChange={(e) => {
                      const category = e.target.value as PurchaseCategory;
                      setRow(row.key, { category, vatRate: CATEGORY_DEFAULT_VAT[category] });
                    }}
                    className={select}
                    title={CATEGORY_HINT[row.category]}
                  >
                    {PURCHASE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  aria-label="Détail (facultatif)"
                  value={row.label}
                  onChange={(e) => setRow(row.key, { label: e.target.value })}
                  placeholder="Détail : javel, poêle… (facultatif)"
                  className="h-10"
                />
                <Input
                  aria-label={`Montant ${value.amountsAre}`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => setRow(row.key, { amount: e.target.value })}
                  placeholder={`€ ${value.amountsAre}`}
                  className="h-10 text-right"
                />
                <select
                  aria-label="Taux de TVA"
                  value={row.vatRate}
                  onChange={(e) => setRow(row.key, { vatRate: Number(e.target.value) })}
                  className={select}
                >
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      TVA {rateLabel(rate)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, rows: value.rows.filter((r) => r.key !== row.key) })}
                  className="flex h-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Retirer la ligne"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, rows: [...value.rows, newBreakdownRow("ENTRETIEN")] })}>
              <PlusIcon className="size-4" aria-hidden />
              Ajouter une catégorie
            </Button>
            {totalTTC && gap > BREAKDOWN_TOLERANCE ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    rows: [
                      ...value.rows,
                      newBreakdownRow("DENREES", String(remainderToType(gap, value.amountsAre, CATEGORY_DEFAULT_VAT.DENREES)).replace(".", ",")),
                    ],
                  })
                }
              >
                Mettre le reste ({formatCurrency(gap)} TTC) en denrées
              </Button>
            ) : null}
          </div>
          <FieldHint>
            Matériel : au-delà de 500 € HT pour un seul objet (four, trancheuse…), c&apos;est un investissement — signalez-le à
            votre comptable.
          </FieldHint>
        </div>
      ) : null}

      {value.mixed !== null && totalTTC ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm",
            balanced ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
          )}
          role="status"
        >
          <span className="flex items-center gap-2 font-medium">
            {balanced ? <CheckCircle2Icon className="size-4" aria-hidden /> : <TriangleAlertIcon className="size-4" aria-hidden />}
            {balanced
              ? "La répartition correspond au total."
              : gap > 0
                ? `Reste à répartir : ${formatCurrency(gap)} TTC`
                : `Dépassement : ${formatCurrency(-gap)} TTC de trop`}
          </span>
          <span className="tabular-nums">
            {formatCurrency(totals.totalHT)} HT + {formatCurrency(totals.totalVAT)} TVA = {formatCurrency(totals.totalTTC)} TTC
            {totals.foodHT > 0 ? ` · dont food cost ${formatCurrency(totals.foodHT)} HT` : ""}
          </span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
