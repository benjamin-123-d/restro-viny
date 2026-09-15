"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReorderOrdersAction, setItemSupplierAction } from "@/actions/reorder.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";
import { formatCurrency } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import type { ReorderSuggestion } from "@/services/reorder.service";

/**
 * Items under their threshold, ready to become purchase orders: tick, adjust
 * the quantity, check the supplier, and one draft order is raised per supplier.
 */
export function ReorderTable({
  suggestions,
  suppliers,
}: {
  readonly suggestions: readonly ReorderSuggestion[];
  readonly suppliers: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(suggestions.map((s) => [s.stockItemId, true])),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(suggestions.map((s) => [s.stockItemId, String(s.suggestedQty)])),
  );
  const [result, setResult] = useState<{ orders: { id: string; number: string; supplierName: string }[]; skipped: string[] } | null>(null);

  const chosen = suggestions.filter((s) => checked[s.stockItemId]);
  const total = chosen.reduce((sum, s) => sum + (Number(quantities[s.stockItemId]?.replace(",", ".")) || 0) * s.rate, 0);

  const changeSupplier = (stockItemId: string, supplierId: string) =>
    startTransition(async () => {
      const res = await setItemSupplierAction({ stockItemId, supplierId: supplierId || null });
      if (!res.success) toast.error(humanError(res.error));
      router.refresh();
    });

  const submit = () =>
    startTransition(async () => {
      const res = await createReorderOrdersAction({
        lines: chosen.map((s) => ({ stockItemId: s.stockItemId, quantity: Number(quantities[s.stockItemId]?.replace(",", ".")) })),
      });
      if (!res.success || !res.data) {
        toast.error(Object.values(res.fieldErrors ?? {})[0]?.[0] ?? humanError(res.error));
        return;
      }
      setResult(res.data);
      router.refresh();
    });

  if (result) {
    return (
      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
        <h2 className="text-base font-semibold">
          {result.orders.length} bon{result.orders.length > 1 ? "s" : ""} de commande en brouillon
        </h2>
        <ul className="list-disc pl-5 text-sm">
          {result.orders.map((o) => (
            <li key={o.id}>
              {o.number} — {o.supplierName}
            </li>
          ))}
        </ul>
        {result.skipped.length > 0 ? (
          <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
            Sans fournisseur habituel, non commandés : {result.skipped.join(", ")}.
          </p>
        ) : null}
        <Link href="/dashboard/purchasing/orders" className="self-start rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background">
          Vérifier et valider les commandes
        </Link>
        <Toaster />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium">Article</th>
              <th className="px-3 py-2 text-right font-medium">En stock</th>
              <th className="px-3 py-2 text-right font-medium">Seuil</th>
              <th className="px-3 py-2 text-right font-medium">À commander</th>
              <th className="px-3 py-2 text-left font-medium">Fournisseur habituel</th>
              <th className="px-3 py-2 text-right font-medium">Montant HT estimé</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => {
              const qty = Number(quantities[s.stockItemId]?.replace(",", ".")) || 0;
              return (
                <tr key={s.stockItemId} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[s.stockItemId])}
                      onChange={(e) => setChecked((c) => ({ ...c, [s.stockItemId]: e.target.checked }))}
                      aria-label={`Commander ${s.name}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.onHand <= 0 ? "text-red-600" : ""}`}>
                    {s.onHand.toLocaleString("fr-FR")} {UNIT_LABELS[s.unit]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.reorderLevel.toLocaleString("fr-FR")}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      inputMode="decimal"
                      value={quantities[s.stockItemId] ?? ""}
                      onChange={(e) => setQuantities((q) => ({ ...q, [s.stockItemId]: e.target.value }))}
                      className="ml-auto w-24 text-right"
                      aria-label={`Quantité de ${s.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={s.supplierId ?? ""}
                      onChange={(e) => changeSupplier(s.stockItemId, e.target.value)}
                      disabled={pending}
                      className={`h-9 w-full rounded-md border bg-background px-2 text-sm ${s.supplierId ? "" : "border-amber-400"}`}
                      aria-label={`Fournisseur de ${s.name}`}
                    >
                      <option value="">— à choisir —</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(qty * s.rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {chosen.length} article{chosen.length > 1 ? "s" : ""} · environ <strong className="text-foreground">{formatCurrency(total)}</strong> HT
        </p>
        <Button size="lg" disabled={pending || chosen.length === 0} onClick={submit}>
          {pending ? "Création…" : "Créer les bons de commande"}
        </Button>
      </div>
      <Toaster />
    </section>
  );
}
