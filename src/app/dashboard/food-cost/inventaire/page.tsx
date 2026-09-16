import Link from "next/link";

import { DeleteDraftInventoryButton, StartInventoryButton } from "@/components/food-cost/inventory-actions";
import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { HelpBox } from "@/components/forms/help-box";
import { StatusBadge } from "@/components/purchasing/purchasing-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { listInventories } from "@/services/food-cost.service";

export const metadata = { title: "Inventaire — Food cost" };

const STATUS = { DRAFT: "DRAFT", VALIDATED: "COMPLETED" } as const;

export default async function FoodInventoriesPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const inventories = await listInventories(page.ctx);
  const draft = inventories.find((i) => i.status === "DRAFT");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Inventaire" description="Le comptage physique, ingrédient par ingrédient, dans l'ordre de vos rangements." />
        {page.canEdit ? (
          draft ? (
            <Link href={`/dashboard/food-cost/inventaire/${draft.id}`} className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background">
              Reprendre le comptage en cours
            </Link>
          ) : (
            <StartInventoryButton />
          )
        ) : null}
      </div>
      <HelpBox
        defaultOpen={inventories.length < 2}
        title="Faire un inventaire"
        steps={[
          "C'est le comptage de référence : c'est lui qui calcule votre écart en euros. Comptez ici plutôt que dans Inventaire ou Stock.",
          "Lancez l'inventaire avant de descendre en réserve, réseau disponible : la liste se charge sur votre téléphone.",
          "Comptez lieu par lieu, dans l'ordre affiché. Chaque chiffre est gardé sur l'appareil, même sans réseau.",
          "L'écart s'affiche ligne par ligne pendant la saisie.",
          "Validez : si le réseau manque, la validation partira toute seule dès qu'il revient.",
        ]}
        tips={[
          "Comptez hors service : les ventes pendant le comptage fausseraient l'écart.",
          "Il faut un inventaire de début et un de fin pour que l'écran Food cost calcule l'écart réel.",
        ]}
      />
      {inventories.length === 0 ? (
        <EmptyState title="Aucun inventaire" description="Lancez votre premier inventaire : il servira de stock de départ." />
      ) : (
        <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date du comptage</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Lignes comptées</th>
                  <th className="px-3 py-2 text-right font-medium">Stock valorisé</th>
                  <th className="px-3 py-2 text-right font-medium">Écart</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {inventories.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/food-cost/inventaire/${inv.id}`} className="font-medium hover:underline">
                        {formatDateTime(inv.countedAt)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={STATUS[inv.status]} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inv.countedLines} / {inv.lineCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(inv.stockValue)}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${inv.varianceValue < 0 ? "text-red-700 dark:text-red-400" : ""}`}>
                      {inv.status === "VALIDATED" ? formatCurrency(inv.varianceValue) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {inv.status === "DRAFT" && page.canEdit ? <DeleteDraftInventoryButton id={inv.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
