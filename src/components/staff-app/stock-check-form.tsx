"use client";

import { CheckCircle2Icon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { submitStockCheckAction } from "@/actions/staff-declarations.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { UNIT_LABELS } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { StaffStockRow } from "@/services/staff-declarations.service";

const toNumber = (value: string): number | null => {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() === "" || Number.isNaN(n) ? null : n;
};

/**
 * The cook's morning round: what the app expects, shelf by shelf. Typing a
 * different number does not change the stock — it raises a flag the manager
 * sees and applies. That is the whole point: a shortage cannot be erased by
 * retyping it.
 */
export function StockCheckForm({ rows }: { readonly rows: readonly StaffStockRow[] }) {
  const router = useRouter();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const send = useServerAction(submitStockCheckAction, {
    onSuccess: () => {
      toast.success("Envoyé au responsable. Merci !");
      setCounted({});
      setNote("");
      router.refresh();
    },
    onError: (message) => toast.error(humanError(message)),
  });

  const gaps = Object.entries(counted)
    .map(([stockItemId, value]) => ({ stockItemId, countedQty: toNumber(value) }))
    .filter((line): line is { stockItemId: string; countedQty: number } => line.countedQty != null);

  const byPlace = new Map<string, StaffStockRow[]>();
  for (const row of rows) {
    const place = row.storageLocation ?? "Sans emplacement";
    byPlace.set(place, [...(byPlace.get(place) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-muted/60 p-4 text-base">
        Regardez vos étagères. Si le chiffre affiché est bon, ne touchez à rien. S&apos;il ne l&apos;est pas, tapez ce que
        vous voyez : <span className="font-medium">le responsable est prévenu</span>, et c&apos;est lui qui corrige.
      </p>

      {[...byPlace].map(([place, items]) => (
        <section key={place} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{place}</h2>
          <ul className="flex flex-col gap-2">
            {items.map((row) => {
              const typed = counted[row.stockItemId] ?? "";
              const value = toNumber(typed);
              const gap = value == null ? null : Math.round((value - row.onHand) * 1000) / 1000;
              return (
                <li
                  key={row.stockItemId}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                    gap != null && gap !== 0 && "border-amber-400 bg-amber-50 dark:bg-amber-950/40",
                    row.isLow && gap == null && "border-red-300",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-medium">{row.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Attendu : {row.onHand.toLocaleString("fr-FR")} {UNIT_LABELS[row.unit]}
                      {row.isLow ? <span className="ml-2 font-medium text-red-600">stock bas</span> : null}
                    </p>
                  </div>
                  <Input
                    inputMode="decimal"
                    aria-label={`Quantité vue pour ${row.name}`}
                    value={typed}
                    onChange={(e) => setCounted((c) => ({ ...c, [row.stockItemId]: e.target.value }))}
                    placeholder="je vois…"
                    className="h-14 w-32 text-right text-lg"
                  />
                  {gap != null && gap !== 0 ? (
                    <span className="w-full text-sm font-medium text-amber-800 dark:text-amber-200">
                      {gap > 0 ? "+" : ""}
                      {gap.toLocaleString("fr-FR")} {UNIT_LABELS[row.unit]} par rapport à ce qui est attendu
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <label className="block">
        <span className="text-base font-medium">Un mot pour le responsable</span>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Facultatif : livraison en retard, congélateur…"
          className="mt-1 h-14 text-base"
        />
      </label>

      <div className="sticky bottom-24 flex flex-col gap-2">
        <Button
          size="lg"
          className="h-16 w-full text-base"
          disabled={send.isPending || gaps.length === 0}
          onClick={() => send.execute({ note, lines: gaps })}
        >
          <SendIcon className="size-5" aria-hidden />
          {send.isPending
            ? "Envoi…"
            : gaps.length === 0
              ? "Rien à signaler"
              : `Signaler ${gaps.length} écart${gaps.length > 1 ? "s" : ""}`}
        </Button>
        {gaps.length === 0 ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4" aria-hidden />
            Tout est conforme : vous n&apos;avez rien à envoyer.
          </p>
        ) : null}
      </div>
      <Toaster />
    </div>
  );
}
