import { ReceiptTextIcon } from "lucide-react";
import Link from "next/link";

import { QuickPurchaseForm } from "@/components/food-cost/quick-purchase-form";
import { HelpBox } from "@/components/forms/help-box";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ManagerContext } from "@/lib/manager-auth";
import { listIngredients, listPurchases } from "@/services/food-cost.service";

/**
 * The market purchase block — help, form and latest entries — shown the same
 * way in Achats, Inventaire and Food cost, so one entry is seen everywhere.
 */
export async function QuickPurchaseSection({
  ctx,
  canEdit,
  limit,
  helpOpen,
}: {
  readonly ctx: ManagerContext;
  readonly canEdit: boolean;
  /** How many recent purchases to list; all of them when omitted. */
  readonly limit?: number;
  readonly helpOpen?: boolean;
}) {
  const [ingredients, purchases] = await Promise.all([listIngredients(ctx), listPurchases(ctx)]);
  const raw = ingredients.filter((i) => i.isActive && !i.isPreparation);
  const shown = limit ? purchases.slice(0, limit) : purchases;

  return (
    <div className="flex flex-col gap-4">
      <HelpBox
        defaultOpen={helpOpen ?? purchases.length === 0}
        title="Saisir un achat marché"
        steps={[
          "Choisissez l'ingrédient.",
          "Tapez la quantité dans l'unité où vous l'avez acheté (2 paniers, 1 carton).",
          "Tapez le montant payé HT : le prix d'achat de l'ingrédient est mis à jour et le stock augmente.",
        ]}
        tips={[
          "Les réceptions et factures du module Achats alimentent aussi le stock et les prix : pas besoin de les ressaisir ici.",
          "L'article n'existe pas ? Tapez son nom puis « Créer l'article » : il est ajouté sans quitter la page.",
          "Un ticket de magasin avec plusieurs articles, du matériel ou des produits d'entretien ? Utilisez « Achat direct avec ticket ».",
        ]}
      />
      {canEdit ? <QuickPurchaseForm ingredients={raw} /> : null}
      <div className="flex justify-end">
        <Link
          href="/dashboard/purchasing/direct/new"
          className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
        >
          <ReceiptTextIcon className="size-4" aria-hidden />
          Achat direct avec ticket (photo, plusieurs articles)
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">Derniers achats marché</h2>
        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucun achat enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Ingrédient</th>
                  <th className="px-3 py-2 text-right font-medium">Quantité</th>
                  <th className="px-3 py-2 text-right font-medium">Entré en stock</th>
                  <th className="px-3 py-2 text-right font-medium">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">{formatDateTime(p.purchasedAt)}</td>
                    <td className="px-3 py-2 font-medium">
                      {p.ingredientName}
                      {p.note ? <span className="block text-xs font-normal text-muted-foreground">{p.note}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.quantity.toLocaleString("fr-FR")} {p.purchaseUnit ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(p.usageQuantity, p.unit)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {limit && purchases.length > limit ? (
          <p className="border-t px-4 py-2 text-right text-sm">
            <Link href="/dashboard/food-cost/achats" className="underline underline-offset-2">
              Voir les {purchases.length} achats
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
