"use client";

import { CheckCircle2Icon, CloudIcon, CloudOffIcon, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { saveInventoryAction, validateInventoryAction } from "@/actions/food-cost.actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import {
  inventoryDraftKey,
  isNetworkFailure,
  mergeCounts,
  parseInventoryDraft,
  serialiseInventoryDraft,
  type InventoryDraft,
} from "@/lib/inventory-draft-storage";
import { cn } from "@/lib/utils";
import type { FoodInventoryDTO } from "@/types/food-cost";

type SyncState = "saved" | "local" | "offline" | "pending-validation";

const readDraft = (id: string): InventoryDraft | null => {
  try {
    return parseInventoryDraft(window.localStorage.getItem(inventoryDraftKey(id)));
  } catch {
    return null;
  }
};

const writeDraft = (draft: Omit<InventoryDraft, "updatedAt">) => {
  try {
    window.localStorage.setItem(
      inventoryDraftKey(draft.inventoryId),
      serialiseInventoryDraft({ ...draft, updatedAt: Date.now() }),
    );
  } catch {
    // Private mode or full storage: the count still lives in memory.
  }
};

const clearDraft = (id: string) => {
  try {
    window.localStorage.removeItem(inventoryDraftKey(id));
  } catch {
    // Nothing to clear.
  }
};

const parse = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Count shelf by shelf, in store-room order, with big fields and the variance
 * shown as you type. Works without network: counts are kept on the device and
 * sent — validation included — as soon as the connection returns.
 */
export function InventoryCounter({
  inventory,
  canEdit,
}: {
  readonly inventory: FoodInventoryDTO;
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const editable = canEdit && inventory.status === "DRAFT";
  const [counts, setCounts] = useState<Record<string, number | null>>(() =>
    mergeCounts(inventory.lines.map((l) => ({ id: l.id, countedQty: l.countedQty })), null),
  );
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [sync, setSync] = useState<SyncState>("saved");
  const [validating, setValidating] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countsRef = useRef(counts);

  const payload = useCallback(
    (values: Record<string, number | null>) => ({
      id: inventory.id,
      counts: Object.entries(values).map(([lineId, countedQty]) => ({ lineId, countedQty })),
    }),
    [inventory.id],
  );

  const pushToServer = useCallback(async () => {
    try {
      const result = await saveInventoryAction(payload(countsRef.current));
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      setSync((s) => (s === "pending-validation" ? s : "saved"));
    } catch (error) {
      setSync(isNetworkFailure(error) ? "offline" : "local");
    }
  }, [payload]);

  const validate = useCallback(async () => {
    setValidating(true);
    writeDraft({ inventoryId: inventory.id, counts: countsRef.current, pendingValidation: true });
    try {
      const result = await validateInventoryAction(payload(countsRef.current));
      if (!result.success) {
        const draft = readDraft(inventory.id);
        if (draft) writeDraft({ ...draft, pendingValidation: false });
        toast.error(humanError(result.error));
        return;
      }
      clearDraft(inventory.id);
      toast.success("Inventaire validé : le stock est à jour");
      router.refresh();
    } catch (error) {
      if (isNetworkFailure(error)) {
        setSync("pending-validation");
        toast.info("Pas de réseau : la validation partira dès que la connexion revient.");
      } else {
        toast.error(humanError(error instanceof Error ? error.message : undefined));
      }
    } finally {
      setValidating(false);
    }
  }, [inventory.id, payload, router]);

  // Restore what was typed on this device, and resume a validation left pending.
  useEffect(() => {
    if (inventory.status !== "DRAFT") {
      clearDraft(inventory.id);
      return;
    }
    const draft = readDraft(inventory.id);
    if (!draft) return;
    const merged = mergeCounts(inventory.lines.map((l) => ({ id: l.id, countedQty: l.countedQty })), draft);
    countsRef.current = merged;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only storage after hydration
    setCounts(merged);
    setSync(draft.pendingValidation ? "pending-validation" : "local");
    if (draft.pendingValidation && navigator.onLine) void validate();
    else if (navigator.onLine) void pushToServer();
  }, [inventory.id, inventory.status, inventory.lines, pushToServer, validate]);

  useEffect(() => {
    const onOnline = () => {
      const draft = readDraft(inventory.id);
      if (draft?.pendingValidation) void validate();
      else void pushToServer();
    };
    const onOffline = () => setSync((s) => (s === "pending-validation" ? s : "offline"));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [inventory.id, pushToServer, validate]);

  const setCount = (lineId: string, text: string) => {
    setTexts((t) => ({ ...t, [lineId]: text }));
    const next = { ...countsRef.current, [lineId]: parse(text) };
    countsRef.current = next;
    setCounts(next);
    writeDraft({ inventoryId: inventory.id, counts: next, pendingValidation: false });
    setSync(navigator.onLine ? "local" : "offline");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (navigator.onLine) void pushToServer();
    }, 1200);
  };

  const groups = useMemo(() => {
    const map = new Map<string, typeof inventory.lines>();
    for (const line of inventory.lines) {
      const key = line.location ?? "Sans lieu de rangement";
      map.set(key, [...(map.get(key) ?? []), line]);
    }
    return [...map.entries()];
  }, [inventory]);

  const counted = inventory.lines.filter((l) => counts[l.id] != null).length;
  const varianceValue = inventory.lines.reduce((s, l) => {
    const c = counts[l.id];
    return c == null ? s : s + (c - l.theoreticalQty) * l.unitCost;
  }, 0);

  const SyncIcon = sync === "saved" ? CloudIcon : sync === "local" ? SmartphoneIcon : CloudOffIcon;
  const syncText =
    sync === "saved"
      ? "Enregistré"
      : sync === "local"
        ? "Gardé sur cet appareil, envoi en cours"
        : sync === "offline"
          ? "Hors ligne : les comptages restent sur cet appareil"
          : "Validation en attente du réseau";

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card/95 p-3 shadow-xs ring-1 ring-foreground/10 backdrop-blur">
        <div className="text-sm">
          <p className="font-semibold">
            {counted} / {inventory.lines.length} comptés
          </p>
          <p className="text-muted-foreground">
            Écart en cours :{" "}
            <span className={cn("font-medium tabular-nums", varianceValue < -0.005 ? "text-red-700 dark:text-red-400" : "text-foreground")}>
              {varianceValue > 0 ? "+" : ""}
              {formatCurrency(varianceValue)}
            </span>
          </p>
        </div>
        {inventory.status === "DRAFT" ? (
          <span className={cn("inline-flex items-center gap-1.5 text-xs", sync === "saved" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
            <SyncIcon className="size-4" aria-hidden />
            {syncText}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2Icon className="size-4" aria-hidden />
            Validé le {inventory.validatedAt ? formatDateTime(inventory.validatedAt) : ""}
          </span>
        )}
      </div>

      {groups.map(([location, lines]) => (
        <section key={location} className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">{location}</h2>
          <ul className="divide-y">
            {lines.map((line) => {
              const value = counts[line.id];
              const diff = value == null ? null : value - line.theoreticalQty;
              return (
                <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Théorique {formatQuantity(line.theoreticalQty, line.unit)}
                      {diff != null && Math.abs(diff) > 0.0005 ? (
                        <span className={cn("ml-2 font-medium tabular-nums", diff < 0 ? "text-red-700 dark:text-red-400" : "text-foreground")}>
                          écart {diff > 0 ? "+" : ""}
                          {formatQuantity(diff, line.unit)} ({diff > 0 ? "+" : ""}
                          {formatCurrency(diff * line.unitCost)})
                        </span>
                      ) : diff != null ? (
                        <span className="ml-2 text-green-700 dark:text-green-400">conforme</span>
                      ) : null}
                    </p>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Quantité comptée de {line.name}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={!editable}
                      value={texts[line.id] ?? (value == null ? "" : String(value).replace(".", ","))}
                      onChange={(e) => setCount(line.id, e.target.value)}
                      placeholder="—"
                      className="h-14 w-32 rounded-lg border bg-background px-3 text-right text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
                    />
                    <span className="w-14 text-sm text-muted-foreground">{UNIT_LABELS[line.unit]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {editable ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {inventory.lines.length - counted > 0
                ? `${inventory.lines.length - counted} ligne(s) non comptée(s) seront prises au stock théorique.`
                : "Tout est compté."}
            </p>
            <Button
              size="lg"
              disabled={validating || sync === "pending-validation"}
              onClick={() => {
                if (window.confirm("Valider l'inventaire ? Le stock prendra les quantités comptées.")) void validate();
              }}
            >
              {sync === "pending-validation" ? "En attente du réseau…" : validating ? "Validation…" : "Valider l'inventaire"}
            </Button>
          </div>
        </div>
      ) : null}
      <Toaster />
    </div>
  );
}
