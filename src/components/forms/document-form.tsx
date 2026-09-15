"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format";
import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

import type { FieldOption } from "./entity-form";

/**
 * One form for every priced document with lines — purchase orders, sales
 * orders, invoices, quotations. The header is a party and a couple of dates;
 * the body is a table of lines with live totals, so the owner sees the figure
 * they are about to commit before they commit it.
 */

export interface CatalogueItem {
  readonly id: string;
  readonly label: string;
  /** Suggested price, pre-filled when the item is picked. */
  readonly rate: number;
  readonly unit?: string;
}

interface Line {
  key: string;
  itemId: string;
  itemName: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxRate: string;
}

const newLine = (taxRate: number): Line => ({
  key: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  quantity: "1",
  rate: "",
  discountPercent: "",
  taxRate: String(taxRate),
});

const toNumber = (v: string): number => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export interface DocumentFormConfig {
  /** Name of the party field sent to the action: "supplierId" / "customerId". */
  readonly partyField: string;
  readonly partyLabel: string;
  readonly partyHint: string;
  readonly parties: readonly FieldOption[];
  /** Name of the optional second date: "scheduleDate", "deliveryDate", "dueDate", "validUntil". */
  readonly dateField?: string;
  readonly dateLabel?: string;
  readonly dateHint?: string;
  /**
   * How a line refers to its item. "stockItemId" lines must pick from the
   * catalogue; "sales" lines may also be free text with a menu or stock link.
   */
  readonly lineMode: "stock" | "sales";
  readonly catalogue: readonly CatalogueItem[];
  readonly defaultTaxRate: number;
  /** Show the per-line discount column. */
  readonly withDiscount?: boolean;
  readonly extraText?: {
    readonly name: string;
    readonly label: string;
    readonly hint: string;
  };
}

export const DocumentForm = ({
  config,
  action,
  submitLabel,
  redirectTo,
}: {
  config: DocumentFormConfig;
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  redirectTo: string;
}) => {
  const router = useRouter();
  const [party, setParty] = useState("");
  const [date, setDate] = useState("");
  const [extra, setExtra] = useState("");
  const [notes, setNotes] = useState("");
  const [documentDiscount, setDocumentDiscount] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine(config.defaultTaxRate)]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const catalogueById = useMemo(
    () => new Map(config.catalogue.map((item) => [item.id, item])),
    [config.catalogue],
  );

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const pickItem = (key: string, itemId: string) => {
    const item = catalogueById.get(itemId);
    update(key, {
      itemId,
      itemName: item?.label ?? "",
      // Only pre-fill the price if the line has none yet — never overwrite a
      // price the owner already negotiated and typed in.
      ...(item && { rate: String(item.rate) }),
    });
  };

  // Same arithmetic the server uses: discount on gross, tax on the net.
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const gross = toNumber(line.quantity) * toNumber(line.rate);
      const net = gross - (gross * toNumber(line.discountPercent)) / 100;
      subtotal += net;
      tax += (net * toNumber(line.taxRate)) / 100;
    }
    const discount = Math.min(toNumber(documentDiscount), subtotal);
    const ratio = subtotal > 0 ? discount / subtotal : 0;
    const taxAfterDiscount = tax * (1 - ratio);
    return {
      subtotal,
      discount,
      tax: taxAfterDiscount,
      total: subtotal - discount + taxAfterDiscount,
    };
  }, [lines, documentDiscount]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const usable = lines.filter((l) => l.itemId || l.itemName.trim());
    const items = usable.map((line) => {
      const base = {
        quantity: toNumber(line.quantity),
        rate: toNumber(line.rate),
        taxRate: toNumber(line.taxRate),
        ...(line.discountPercent && {
          discountPercent: toNumber(line.discountPercent),
        }),
      };
      return config.lineMode === "stock"
        ? { ...base, stockItemId: line.itemId }
        : {
            ...base,
            stockItemId: line.itemId || undefined,
            itemName:
              line.itemName.trim() || catalogueById.get(line.itemId)?.label,
          };
    });

    startTransition(async () => {
      const result = await action({
        [config.partyField]: party || undefined,
        ...(config.dateField && date && { [config.dateField]: date }),
        ...(config.extraText && extra && { [config.extraText.name]: extra }),
        ...(notes && { notes }),
        discountAmount: toNumber(documentDiscount),
        roundTotal: false,
        items,
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

  const lineError = (index: number, field: string) =>
    fieldErrors[`items.${index}.${field}`]?.join(" · ");

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
          {fieldErrors.items && (
            <span className="block text-xs">
              {fieldErrors.items.join(" · ")}
            </span>
          )}
        </div>
      )}

      {/* Header -------------------------------------------------------------- */}
      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          1. En-tête
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">
              {config.partyLabel}
              <span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              value={party}
              onChange={(e) => setParty(e.target.value)}
              aria-invalid={Boolean(fieldErrors[config.partyField])}
              className={inputClass}
            >
              <option value="">— Choisir —</option>
              {config.parties.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {fieldErrors[config.partyField]?.join(" · ") ?? config.partyHint}
            </p>
          </div>

          {config.dateField && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-800">
                {config.dateLabel}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-zinc-500">{config.dateHint}</p>
            </div>
          )}

          {config.extraText && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-800">
                {config.extraText.label}
              </label>
              <input
                type="text"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {config.extraText.hint}
              </p>
            </div>
          )}
        </div>
      </fieldset>

      {/* Lines --------------------------------------------------------------- */}
      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          2. Articles
        </legend>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">
          Choisissez un article : son prix habituel se remplit tout seul, vous
          pouvez le modifier. Le total se calcule en direct en bas.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-2 font-medium">Article</th>
                <th className="w-24 py-2 pr-2 font-medium">Quantité</th>
                <th className="w-32 py-2 pr-2 font-medium">Prix unitaire</th>
                {config.withDiscount && (
                  <th className="w-24 py-2 pr-2 font-medium">Remise %</th>
                )}
                <th className="w-20 py-2 pr-2 font-medium">TVA %</th>
                <th className="w-32 py-2 text-right font-medium">Montant</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const gross = toNumber(line.quantity) * toNumber(line.rate);
                const net =
                  gross - (gross * toNumber(line.discountPercent)) / 100;
                const itemError =
                  lineError(index, "stockItemId") ??
                  lineError(index, "itemName");
                return (
                  <tr key={line.key} className="border-b align-top">
                    <td className="py-2 pr-2">
                      <select
                        value={line.itemId}
                        onChange={(e) => pickItem(line.key, e.target.value)}
                        className={inputClass}
                      >
                        <option value="">
                          {config.lineMode === "sales"
                            ? "— Article du stock (optionnel) —"
                            : "— Choisir un article —"}
                        </option>
                        {config.catalogue.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {item.unit ? ` (${item.unit})` : ""}
                          </option>
                        ))}
                      </select>
                      {config.lineMode === "sales" && (
                        <input
                          type="text"
                          value={line.itemName}
                          onChange={(e) =>
                            update(line.key, { itemName: e.target.value })
                          }
                          placeholder="…ou décrivez la prestation (ex. Buffet 60 couverts)"
                          className={`${inputClass} mt-1.5`}
                        />
                      )}
                      {itemError && (
                        <p className="mt-1 text-xs text-red-600">{itemError}</p>
                      )}
                    </td>
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
                        value={line.rate}
                        onChange={(e) =>
                          update(line.key, { rate: e.target.value })
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </td>
                    {config.withDiscount && (
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={line.discountPercent}
                          onChange={(e) =>
                            update(line.key, {
                              discountPercent: e.target.value,
                            })
                          }
                          placeholder="0"
                          className={inputClass}
                        />
                      </td>
                    )}
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.taxRate}
                        onChange={(e) =>
                          update(line.key, { taxRate: e.target.value })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(net)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.length === 1
                              ? current
                              : current.filter((l) => l.key !== line.key),
                          )
                        }
                        disabled={lines.length === 1}
                        aria-label="Retirer la ligne"
                        className="rounded px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() =>
            setLines((current) => [...current, newLine(config.defaultTaxRate)])
          }
          className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50"
        >
          + Ajouter une ligne
        </button>
      </fieldset>

      {/* Totals + notes ------------------------------------------------------ */}
      <fieldset
        className="grid gap-5 rounded-lg border bg-white p-5 lg:grid-cols-2"
        disabled={pending}
      >
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          3. Notes et total
        </legend>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Remarques
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instructions de livraison, conditions particulières…"
            className={inputClass}
          />
        </div>

        <div className="space-y-2 rounded-md bg-zinc-50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Sous-total</span>
            <span className="tabular-nums">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="text-zinc-600">Remise globale (montant)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={documentDiscount}
              onChange={(e) => setDocumentDiscount(e.target.value)}
              placeholder="0"
              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm"
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">TVA</span>
            <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-md border px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </button>
        <span className="text-xs text-zinc-500">
          Enregistré comme <strong>brouillon</strong> — vous le validerez
          ensuite depuis la liste.
        </span>
      </div>
    </form>
  );
};
