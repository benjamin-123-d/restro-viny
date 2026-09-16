"use client";

import { useState } from "react";
import { toast } from "sonner";

import { setInvoiceBreakdownAction } from "@/actions/direct-purchase.actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import {
  emptyBreakdown,
  toExpenseLines,
  type BreakdownState,
} from "@/lib/expense-breakdown-state";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_LABEL, breakdownMatches } from "@/lib/purchase-categories";
import type { ExpenseLineDTO } from "@/types/direct-purchase";

import { ExpenseBreakdownEditor, newBreakdownRow } from "./expense-breakdown-editor";

const amountText = (n: number): string => String(n).replace(".", ",");

const stateFromLines = (lines: readonly ExpenseLineDTO[]): BreakdownState => {
  const base = emptyBreakdown();
  if (lines.length === 0) return base;
  if (lines.length === 1) {
    return { ...base, mixed: false, singleCategory: lines[0].category, singleRate: lines[0].vatRate };
  }
  return {
    ...base,
    mixed: true,
    amountsAre: "HT",
    rows: lines.map((line) => ({
      ...newBreakdownRow(line.category, amountText(line.amountHT), line.label ?? ""),
      vatRate: line.vatRate,
    })),
  };
};

/**
 * After a document is imported, the one question its total cannot answer:
 * what was actually bought. Food and drinks feed the food cost; cleaning
 * products, equipment and packaging are what the restaurant costs to run.
 */
export function InvoiceBreakdownPanel({
  purchaseInvoiceId,
  totalTTC,
  lines,
  ingredientLines,
  canEdit,
}: {
  readonly purchaseInvoiceId: string;
  readonly totalTTC: number;
  readonly lines: readonly ExpenseLineDTO[];
  readonly ingredientLines: readonly { readonly id: string; readonly name: string; readonly quantity: number; readonly purchaseUnit: string | null; readonly amount: number }[];
  readonly canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<BreakdownState>(() => stateFromLines(lines));
  const [error, setError] = useState<string | undefined>(undefined);

  const expenseLines = toExpenseLines(state, totalTTC);
  const balanced = breakdownMatches(expenseLines, totalTTC);

  const save = useServerAction(setInvoiceBreakdownAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Répartition enregistrée");
      setEditing(false);
    },
    onError: (message) => {
      setError(humanError(message));
      toast.error(humanError(message));
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Ce que contient ce document</h2>
          <p className="text-sm text-muted-foreground">
            {lines.length === 0
              ? "Pas encore réparti : dites ce qui est de la nourriture et ce qui ne l'est pas, pour savoir où part l'argent."
              : "La part de chaque type de dépense dans ce document."}
          </p>
        </div>
        {canEdit && !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {lines.length === 0 ? "Répartir" : "Modifier la répartition"}
          </Button>
        ) : null}
      </div>

      {!editing && lines.length > 0 ? (
        <ul className="divide-y text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                {CATEGORY_LABEL[line.category]}
                {line.label ? <span className="text-muted-foreground"> · {line.label}</span> : null}
              </span>
              <span className="tabular-nums">
                {formatCurrency(line.amountHT)} HT
                <span className="text-muted-foreground"> + {formatCurrency(line.vatAmount)} TVA {line.vatRate.toLocaleString("fr-FR")} %</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <>
          <ExpenseBreakdownEditor value={state} onChange={setState} totalTTC={totalTTC} documentWord="document" error={error} />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setState(stateFromLines(lines));
                setError(undefined);
                setEditing(false);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={save.isPending || !balanced}
              onClick={() => {
                setError(undefined);
                save.execute({ purchaseInvoiceId, expenseLines });
              }}
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer la répartition"}
            </Button>
          </div>
        </>
      ) : null}

      {ingredientLines.length > 0 ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">Entré en stock depuis ce document</p>
          <ul className="mt-1 divide-y">
            {ingredientLines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span>
                  {line.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {line.quantity.toLocaleString("fr-FR")} {line.purchaseUnit ?? ""}
                  </span>
                </span>
                <span className="tabular-nums">{formatCurrency(line.amount)} HT</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Toaster />
    </section>
  );
}
