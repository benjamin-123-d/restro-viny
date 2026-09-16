"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { applyStockCheckAction, dismissStockCheckAction } from "@/actions/staff-declarations.actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { StockCheckDTO } from "@/services/staff-declarations.service";

/**
 * What the kitchen signalled, and the two answers the manager owes it: apply
 * the figures — which writes the corrections — or refuse them, which leaves
 * the stock exactly as it was. Either way the cook gets an answer.
 */
export function StockCheckReview({ checks }: { readonly checks: readonly StockCheckDTO[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const apply = useServerAction(applyStockCheckAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Écarts appliqués : le stock est à jour.");
      setBusy(null);
    },
    onError: (message) => {
      toast.error(humanError(message));
      setBusy(null);
    },
  });

  const dismiss = useServerAction(dismissStockCheckAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Relevé refusé : le stock n'a pas bougé.");
      setBusy(null);
    },
    onError: (message) => {
      toast.error(humanError(message));
      setBusy(null);
    },
  });

  if (checks.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/10">
        Aucun relevé en attente. Quand la cuisine signale un écart le matin, il apparaît ici.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {checks.map((check) => {
        const gaps = check.lines.filter((line) => line.countedQty != null);
        const pending = check.status === "EN_ATTENTE";
        return (
          <section key={check.id} className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
              <div>
                <p className="font-semibold">
                  {check.staffName}
                  <span className="ml-2 font-normal text-muted-foreground">{formatDateTime(check.checkedAt)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {gaps.length} écart{gaps.length > 1 ? "s" : ""} signalé{gaps.length > 1 ? "s" : ""}
                  {check.gapValue !== 0 ? ` · ${formatCurrency(check.gapValue)} de valeur` : ""}
                  {check.note ? ` · « ${check.note} »` : ""}
                </p>
              </div>
              {pending ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy === check.id}
                    onClick={() => {
                      setBusy(check.id);
                      dismiss.execute({ id: check.id });
                    }}
                  >
                    <XIcon className="size-4" aria-hidden />
                    Refuser
                  </Button>
                  <Button
                    disabled={busy === check.id}
                    onClick={() => {
                      setBusy(check.id);
                      apply.execute({ id: check.id });
                    }}
                  >
                    <CheckIcon className="size-4" aria-hidden />
                    Appliquer au stock
                  </Button>
                </div>
              ) : (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {check.status === "APPLIQUE" ? "Appliqué" : "Refusé"}
                  {check.resolvedAt ? ` le ${formatDateTime(check.resolvedAt)}` : ""}
                </span>
              )}
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Article</th>
                    <th className="px-3 py-2 text-left font-medium">Rangement</th>
                    <th className="px-3 py-2 text-right font-medium">Attendu</th>
                    <th className="px-3 py-2 text-right font-medium">Vu</th>
                    <th className="px-3 py-2 text-right font-medium">Écart</th>
                    <th className="px-3 py-2 text-right font-medium">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{line.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{line.storageLocation ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {line.theoreticalQty.toLocaleString("fr-FR")} {UNIT_LABELS[line.unit]}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {line.countedQty?.toLocaleString("fr-FR")} {UNIT_LABELS[line.unit]}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          line.gap < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {line.gap > 0 ? "+" : ""}
                        {line.gap.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(line.gapValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <Toaster />
    </div>
  );
}
