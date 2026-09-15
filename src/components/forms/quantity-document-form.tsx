"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

import { FieldHint } from "./help-box";

/**
 * Documents made of items and quantities only, without prices: a request for
 * quotation, a material request, a physical count. The header adapts to the
 * kind; the body is always "which item, how much".
 */

export type QuantityDocumentKind = "RFQ" | "MATERIAL_REQUEST" | "COUNT";

interface Option {
  readonly value: string;
  readonly label: string;
}

interface Line {
  key: number;
  stockItemId: string;
  quantity: string;
}

let nextKey = 1;
const toNumber = (v: string): number => Number(v.replace(/\s/g, "").replace(",", "."));
const inputClass = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm";

const COPY: Readonly<Record<QuantityDocumentKind, { quantity: string; submit: string; empty: string }>> = {
  RFQ: { quantity: "Quantité voulue", submit: "Enregistrer la demande", empty: "Ajoutez au moins un article." },
  MATERIAL_REQUEST: { quantity: "Quantité demandée", submit: "Enregistrer la demande", empty: "Ajoutez au moins un article." },
  COUNT: { quantity: "Quantité comptée", submit: "Enregistrer le comptage", empty: "Comptez au moins un article." },
};

export function QuantityDocumentForm({
  kind,
  items,
  suppliers = [],
  warehouses = [],
  action,
  redirectTo,
}: {
  readonly kind: QuantityDocumentKind;
  readonly items: readonly { id: string; label: string; unit: string }[];
  readonly suppliers?: readonly Option[];
  readonly warehouses?: readonly Option[];
  readonly action: (input: unknown) => Promise<ActionResult<unknown>>;
  readonly redirectTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>([{ key: nextKey++, stockItemId: "", quantity: "" }]);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.value ?? "");
  const [requestType, setRequestType] = useState("PURCHASE");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[kind];
  const unitOf = new Map(items.map((i) => [i.id, i.unit]));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const filled = lines.filter((l) => l.stockItemId && l.quantity.trim() !== "");
    if (filled.length === 0) {
      setError(copy.empty);
      return;
    }
    const payload =
      kind === "RFQ"
        ? {
            supplierIds,
            ...(date && { requiredBy: date }),
            ...(text && { message: text }),
            items: filled.map((l) => ({ stockItemId: l.stockItemId, quantity: toNumber(l.quantity) })),
          }
        : kind === "MATERIAL_REQUEST"
          ? {
              type: requestType,
              ...(date && { requiredBy: date }),
              ...(text && { notes: text }),
              items: filled.map((l) => ({
                stockItemId: l.stockItemId,
                quantity: toNumber(l.quantity),
                ...(warehouseId && { warehouseId }),
              })),
            }
          : {
              ...(date && { postingDate: date }),
              ...(text && { reason: text }),
              items: filled.map((l) => ({
                stockItemId: l.stockItemId,
                countedQty: toNumber(l.quantity),
                ...(warehouseId && { warehouseId }),
              })),
            };

    startTransition(async () => {
      const result = await action(payload);
      if (!result.success) {
        const firstField = Object.values(result.fieldErrors ?? {})[0]?.[0];
        setError(firstField ?? humanError(result.error));
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:grid-cols-2">
        {kind === "RFQ" ? (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Fournisseurs consultés</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {suppliers.map((s) => (
                <label key={s.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={supplierIds.includes(s.value)}
                    onChange={(e) =>
                      setSupplierIds((current) =>
                        e.target.checked ? [...current, s.value] : current.filter((id) => id !== s.value),
                      )
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <FieldHint>Ceux à qui vous demandez un prix pour la même liste.</FieldHint>
          </fieldset>
        ) : null}

        {kind === "MATERIAL_REQUEST" ? (
          <div>
            <label className="text-sm font-medium" htmlFor="qd-type">
              Type de demande
            </label>
            <select id="qd-type" value={requestType} onChange={(e) => setRequestType(e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="PURCHASE">À acheter</option>
              <option value="MATERIAL_TRANSFER">À transférer entre entrepôts</option>
              <option value="MATERIAL_ISSUE">À sortir de la réserve</option>
            </select>
            <FieldHint>« À acheter » pourra devenir un bon de commande.</FieldHint>
          </div>
        ) : null}

        {kind !== "RFQ" && warehouses.length > 0 ? (
          <div>
            <label className="text-sm font-medium" htmlFor="qd-warehouse">
              Entrepôt
            </label>
            <select id="qd-warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`mt-1 ${inputClass}`}>
              {warehouses.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            <FieldHint>{kind === "COUNT" ? "L'entrepôt compté : son stock prendra les quantités saisies." : "L'entrepôt concerné par la demande."}</FieldHint>
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium" htmlFor="qd-date">
            {kind === "COUNT" ? "Date du comptage" : "Pour le"}
          </label>
          <input id="qd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputClass}`} />
          <FieldHint>{kind === "COUNT" ? "Vide : aujourd'hui." : "Facultatif : la date à laquelle vous en avez besoin."}</FieldHint>
        </div>

        <div className={kind === "RFQ" ? "" : "sm:col-span-2"}>
          <label className="text-sm font-medium" htmlFor="qd-text">
            {kind === "RFQ" ? "Message aux fournisseurs" : kind === "COUNT" ? "Motif" : "Remarques"}
          </label>
          <input
            id="qd-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`mt-1 ${inputClass}`}
            placeholder={kind === "COUNT" ? "Inventaire mensuel" : kind === "RFQ" ? "Livraison le mardi matin" : "Pour le service de samedi"}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="grid grid-cols-[minmax(0,1fr)_9rem_4rem_2rem] gap-2 text-xs font-medium text-muted-foreground">
          <span>Article</span>
          <span className="text-right">{copy.quantity}</span>
          <span />
          <span />
        </div>
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_9rem_4rem_2rem] items-center gap-2">
            <select
              value={line.stockItemId}
              onChange={(e) => setLines((c) => c.map((l) => (l.key === line.key ? { ...l, stockItemId: e.target.value } : l)))}
              className={inputClass}
              aria-label="Article"
            >
              <option value="">Choisir…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              value={line.quantity}
              onChange={(e) => setLines((c) => c.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))}
              className={`${inputClass} text-right`}
              aria-label={copy.quantity}
            />
            <span className="text-xs text-muted-foreground">{unitOf.get(line.stockItemId) ?? ""}</span>
            <button
              type="button"
              onClick={() => setLines((c) => (c.length > 1 ? c.filter((l) => l.key !== line.key) : c))}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Retirer la ligne"
            >
              <Trash2Icon className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((c) => [...c, { key: nextKey++, stockItemId: "", quantity: "" }])}
          className="inline-flex items-center gap-1.5 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <PlusIcon className="size-4" aria-hidden />
          Ajouter une ligne
        </button>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">
          {pending ? "Enregistrement…" : copy.submit}
        </button>
      </div>
    </form>
  );
}
