"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format";
import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

import type { FieldOption } from "./entity-form";

/**
 * A double-entry journal. Every line goes on exactly one side, and the save
 * button stays disabled until the two columns agree — the rule is shown, not
 * just enforced, so nobody has to guess why their entry was refused.
 */

interface Line {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

const blank = (): Line => ({
  key: crypto.randomUUID(),
  accountId: "",
  debit: "",
  credit: "",
  description: "",
});

const n = (v: string): number => {
  const parsed = Number(v.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const inputClass =
  "w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const JournalForm = ({
  accounts,
  action,
  redirectTo,
}: {
  accounts: readonly FieldOption[];
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  redirectTo: string;
}) => {
  const router = useRouter();
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + n(l.debit), 0);
    const credit = lines.reduce((s, l) => s + n(l.credit), 0);
    return { debit, credit, gap: Math.round((debit - credit) * 100) / 100 };
  }, [lines]);

  const balanced = totals.debit > 0 && Math.abs(totals.gap) < 0.005;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const payloadLines = lines
      .filter((l) => l.accountId && (n(l.debit) > 0 || n(l.credit) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: n(l.debit),
        credit: n(l.credit),
        ...(l.description && { description: l.description }),
      }));

    startTransition(async () => {
      const result = await action({
        postingDate,
        ...(reference && { reference }),
        ...(narration && { narration }),
        lines: payloadLines,
      });
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  };

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

      <fieldset
        className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-3"
        disabled={pending}
      >
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          1. En-tête
        </legend>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Date comptable
          </label>
          <input
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Le jour où l&apos;opération a eu lieu.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Référence
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ex. Reçu n° 1024"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Numéro de pièce justificative, facultatif.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-800">
            Libellé
          </label>
          <input
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="ex. Loyer du mois de septembre"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Ce que l&apos;écriture représente.
          </p>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-5" disabled={pending}>
        <legend className="px-1 text-sm font-semibold text-zinc-900">
          2. Lignes (débit / crédit)
        </legend>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">
          Chaque ligne va <strong>soit</strong> au débit <strong>soit</strong>{" "}
          au crédit. Exemple — payer 150 000 de loyer en espèces : débit « Rent
          » 150 000, crédit « Cash » 150 000.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-2 font-medium">Compte</th>
                <th className="py-2 pr-2 font-medium">Détail</th>
                <th className="w-36 py-2 pr-2 font-medium">Débit</th>
                <th className="w-36 py-2 pr-2 font-medium">Crédit</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b">
                  <td className="py-2 pr-2">
                    <select
                      value={line.accountId}
                      onChange={(e) =>
                        update(line.key, { accountId: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">— Choisir un compte —</option>
                      {accounts.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) =>
                        update(line.key, { description: e.target.value })
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.debit}
                      placeholder="0"
                      // Typing on one side clears the other: a line has one side only.
                      onChange={(e) =>
                        update(line.key, {
                          debit: e.target.value,
                          ...(e.target.value && { credit: "" }),
                        })
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.credit}
                      placeholder="0"
                      onChange={(e) =>
                        update(line.key, {
                          credit: e.target.value,
                          ...(e.target.value && { debit: "" }),
                        })
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((c) =>
                          c.length <= 2
                            ? c
                            : c.filter((l) => l.key !== line.key),
                        )
                      }
                      disabled={lines.length <= 2}
                      aria-label="Retirer la ligne"
                      className="rounded px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold">
                <td className="py-2 pr-2" colSpan={2}>
                  Totaux
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {formatCurrency(totals.debit)}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {formatCurrency(totals.credit)}
                </td>
                <td />
              </tr>
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

        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${balanced ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}
        >
          {balanced
            ? "Équilibrée : le débit égale le crédit, l'écriture peut être enregistrée."
            : totals.debit === 0 && totals.credit === 0
              ? "Saisissez les montants au débit et au crédit."
              : `Écart de ${formatCurrency(Math.abs(totals.gap))} — le débit doit égaler le crédit.`}
        </p>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !balanced}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40"
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
          Le brouillon n&apos;entre dans le grand livre qu&apos;une fois{" "}
          <strong>comptabilisé</strong> depuis la liste.
        </span>
      </div>
    </form>
  );
};
