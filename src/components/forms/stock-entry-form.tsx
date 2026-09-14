"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format";
import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

import type { CatalogueItem } from "./document-form";
import type { FieldOption } from "./entity-form";

/**
 * Receipt, issue or transfer. The purpose decides which warehouse columns are
 * even shown, so the form can never ask for a source on a receipt or a
 * destination on an issue.
 */

type Purpose = "MATERIAL_RECEIPT" | "MATERIAL_ISSUE" | "MATERIAL_TRANSFER";

const PURPOSES: readonly { value: Purpose; label: string; explain: string }[] =
  [
    {
      value: "MATERIAL_RECEIPT",
      label: "Entrée en stock",
      explain:
        "Du stock arrive dans un entrepôt (hors achat fournisseur : don, stock d'ouverture…).",
    },
    {
      value: "MATERIAL_ISSUE",
      label: "Sortie de stock",
      explain:
        "Du stock quitte un entrepôt (consommation interne, casse, perte).",
    },
    {
      value: "MATERIAL_TRANSFER",
      label: "Transfert entre entrepôts",
      explain:
        "Déplacer du stock d'un entrepôt à un autre. Le stock total ne change pas.",
    },
  ];

interface Line {
  key: string;
  stockItemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  valuationRate: string;
}

const blank = (): Line => ({
  key: crypto.randomUUID(),
  stockItemId: "",
  fromWarehouseId: "",
  toWarehouseId: "",
  quantity: "",
  valuationRate: "",
});

const n = (v: string): number => {
  const parsed = Number(v.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export const StockEntryForm = ({
  items,
  warehouses,
  action,
  redirectTo,
}: {
  items: readonly CatalogueItem[];
  warehouses: readonly FieldOption[];
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  redirectTo: string;
}) => {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose>("MATERIAL_TRANSFER");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const needsSource = purpose !== "MATERIAL_RECEIPT";
  const needsTarget = purpose !== "MATERIAL_ISSUE";
  const byId = new Map(items.map((i) => [i.id, i]));

  const update = (key: string, patch: Partial<Line>) =>
    setLines((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action({
        purpose,
        ...(reason && { reason }),
        items: lines
          .filter((l) => l.stockItemId)
          .map((l) => ({
            stockItemId: l.stockItemId,
            ...(needsSource &&
              l.fromWarehouseId && { fromWarehouseId: l.fromWarehouseId }),
            ...(needsTarget &&
              l.toWarehouseId && { toWarehouseId: l.toWarehouseId }),
            quantity: n(l.quantity),
            valuationRate: n(l.valuationRate),
          })),
      });
      if (!result.success) {
        setError(humanError(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  };

  const errorAt = (i: number, f: string) =>
    fieldErrors[`items.${i}.${f}`]?.join(" · ");
  const selected = PURPOSES.find((p) => p.value === purpose);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          1. Type de mouvement
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PURPOSES.map((p) => (
            <label
              key={p.value}
              className={`cursor-pointer rounded-md border p-3 text-sm transition ${
                purpose === p.value
                  ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="purpose"
                value={p.value}
                checked={purpose === p.value}
                onChange={() => setPurpose(p.value)}
                className="sr-only"
              />
              <span className="block font-medium text-zinc-900">{p.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {p.explain}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 max-w-md">
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Motif
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex. Réapprovisionner le bar"
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          2. Articles
        </legend>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">{selected?.explain}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-2 font-medium">Article</th>
                {needsSource && (
                  <th className="py-2 pr-2 font-medium">
                    Depuis l&apos;entrepôt
                  </th>
                )}
                {needsTarget && (
                  <th className="py-2 pr-2 font-medium">
                    Vers l&apos;entrepôt
                  </th>
                )}
                <th className="w-24 py-2 pr-2 font-medium">Quantité</th>
                <th className="w-32 py-2 pr-2 font-medium">Coût unitaire</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={line.key} className="border-b align-top">
                  <td className="py-2 pr-2">
                    <select
                      value={line.stockItemId}
                      onChange={(e) => {
                        const item = byId.get(e.target.value);
                        update(line.key, {
                          stockItemId: e.target.value,
                          ...(item && { valuationRate: String(item.rate) }),
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">— Choisir —</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.label}
                          {it.unit ? ` (${it.unit})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  {needsSource && (
                    <td className="py-2 pr-2">
                      <select
                        value={line.fromWarehouseId}
                        onChange={(e) =>
                          update(line.key, { fromWarehouseId: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="">— Source —</option>
                        {warehouses.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                      {errorAt(i, "fromWarehouseId") && (
                        <p className="mt-1 text-xs text-red-600">
                          {errorAt(i, "fromWarehouseId")}
                        </p>
                      )}
                    </td>
                  )}
                  {needsTarget && (
                    <td className="py-2 pr-2">
                      <select
                        value={line.toWarehouseId}
                        onChange={(e) =>
                          update(line.key, { toWarehouseId: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="">— Destination —</option>
                        {warehouses.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                      {errorAt(i, "toWarehouseId") && (
                        <p className="mt-1 text-xs text-red-600">
                          {errorAt(i, "toWarehouseId")}
                        </p>
                      )}
                    </td>
                  )}
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={(e) =>
                        update(line.key, { quantity: e.target.value })
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.valuationRate}
                      onChange={(e) =>
                        update(line.key, { valuationRate: e.target.value })
                      }
                      className={inputClass}
                    />
                    <p className="mt-0.5 text-right text-[11px] text-zinc-400">
                      {formatCurrency(n(line.quantity) * n(line.valuationRate))}
                    </p>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((c) =>
                          c.length === 1
                            ? c
                            : c.filter((l) => l.key !== line.key),
                        )
                      }
                      disabled={lines.length === 1}
                      aria-label="Retirer"
                      className="rounded px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setLines((c) => [...c, blank()])}
          className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50"
        >
          + Ajouter une ligne
        </button>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-md border px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </button>
        <span className="text-xs text-zinc-500">
          Le stock ne bouge qu&apos;au moment où vous <strong>validez</strong>{" "}
          l&apos;écriture depuis la liste.
        </span>
      </div>
    </form>
  );
};
