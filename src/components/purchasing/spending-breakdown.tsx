import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { CATEGORY_LABEL, type PurchaseCategory } from "@/lib/purchase-categories";
import type { SpendingBreakdownDTO, SpendingBucket } from "@/types/direct-purchase";

const BUCKET_LABEL = (bucket: SpendingBucket): string =>
  bucket === "NON_VENTILE" ? "Non réparti" : CATEGORY_LABEL[bucket as PurchaseCategory];

// One hue per kind of spending, food first; « non réparti » stays grey.
const BAR_CLASS: Readonly<Record<string, string>> = {
  DENREES: "bg-[var(--sales-1,theme(colors.emerald.600))]",
  BOISSONS: "bg-emerald-400",
  ENTRETIEN: "bg-sky-500",
  MATERIEL: "bg-violet-500",
  EMBALLAGES: "bg-amber-500",
  AUTRE: "bg-zinc-500",
  NON_VENTILE: "bg-zinc-300 dark:bg-zinc-700",
};

/**
 * Where the purchasing money went over the last month — the figure that tells
 * the kitchen's cost from what it costs to keep the place running.
 */
export function SpendingBreakdown({ spending }: { readonly spending: SpendingBreakdownDTO }) {
  if (spending.totalHT <= 0) {
    return (
      <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <h2 className="text-base font-semibold">Où part l&apos;argent des achats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aucun achat enregistré sur les 30 derniers jours. Saisissez un ticket dans « Achats directs » ou une facture
          fournisseur : la répartition s&apos;affichera ici.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Où part l&apos;argent des achats</h2>
        <p className="text-sm text-muted-foreground">
          30 derniers jours · {formatCurrency(spending.totalHT)} HT · nourriture et boissons{" "}
          <span className="font-medium text-foreground">{Math.round(spending.foodShare * 100)} %</span>
        </p>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {spending.rows.map((row) => (
          <span
            key={row.bucket}
            className={BAR_CLASS[row.bucket] ?? "bg-zinc-400"}
            style={{ width: `${Math.max(row.share * 100, 1)}%` }}
          />
        ))}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Dépenses d&apos;achat par catégorie sur 30 jours</caption>
        <tbody>
          {spending.rows.map((row) => (
            <tr key={row.bucket} className="border-b last:border-0">
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${BAR_CLASS[row.bucket] ?? "bg-zinc-400"}`} aria-hidden />
                  {BUCKET_LABEL(row.bucket)}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{Math.round(row.share * 100)} %</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{formatCurrency(row.amountHT)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {spending.unsplitInvoiceCount > 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {spending.unsplitInvoiceCount} document{spending.unsplitInvoiceCount > 1 ? "s" : ""} enregistré
          {spending.unsplitInvoiceCount > 1 ? "s" : ""} au total seul, sans dire ce qu&apos;il contenait. Ouvrez-le depuis{" "}
          <Link href="/dashboard/purchasing/invoices" className="font-medium underline underline-offset-2">
            Factures
          </Link>{" "}
          et répondez à « Ce document contient-il autre chose que de la nourriture ? ».
        </p>
      ) : null}
    </section>
  );
}
