import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { ReliabilityBadge } from "@/components/food-cost/reliability-badge";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatRatio } from "@/lib/food-cost-format";
import { formatCurrency } from "@/lib/format";
import { listRecipeCards } from "@/services/food-cost.service";

export const metadata = { title: "Fiches techniques — Food cost" };

export default async function RecipeCardsPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const cards = await listRecipeCards(page.ctx);
  const byCategory = new Map<string, typeof cards>();
  for (const card of cards) byCategory.set(card.categoryName, [...(byCategory.get(card.categoryName) ?? []), card]);
  const withCard = cards.filter((c) => c.hasCard);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Fiches techniques"
        description={`${withCard.length} plat${withCard.length > 1 ? "s" : ""} sur ${cards.length} ont une fiche. Le coût de chaque portion, face à son prix de vente HT.`}
      />
      <HelpBox
        defaultOpen={withCard.length === 0}
        title="Fiches techniques : comment ça marche"
        steps={[
          "Ouvrez un plat et composez sa fiche : les ingrédients et leur quantité brute, pour le nombre de portions produites.",
          "Pas le temps ? « Proposer une fiche » part d'une fiche type du catalogue : elle naît « Estimée » (pastille orange).",
          "Corrigez les quantités : la fiche devient « Ajustée » (bleue). Pesez une vraie portion : elle devient « Vérifiée » (verte).",
        ]}
        tips={[
          "Coût de la fiche = Σ (quantité brute × coût net d'usage) ; coût d'une portion = coût de la fiche ÷ nombre de portions.",
          "Le coût est figé sur chaque vente : changer un prix plus tard ne réécrit pas le passé.",
          "Le système n'impose aucun prix de vente : il montre le coût et le ratio, la décision vous appartient.",
        ]}
      />

      {cards.length === 0 ? (
        <EmptyState title="Aucun plat à la carte" description="Ajoutez vos plats dans « Carte » pour leur composer une fiche." />
      ) : (
        [...byCategory.entries()].map(([category, items]) => (
          <section key={category} className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
            <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">{category}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Plat</th>
                    <th className="px-3 py-2 text-left font-medium">Fiabilité</th>
                    <th className="px-3 py-2 text-right font-medium">Coût portion</th>
                    <th className="px-3 py-2 text-right font-medium">Prix HT</th>
                    <th className="px-3 py-2 text-right font-medium">Marge brute</th>
                    <th className="px-3 py-2 text-right font-medium">Ratio matière</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((card) => (
                    <tr key={card.menuItemId} className="border-t">
                      <td className="px-4 py-2">
                        <Link href={`/dashboard/food-cost/fiches/${card.menuItemId}`} className="font-medium hover:underline">
                          {card.menuItemName}
                        </Link>
                        {card.hasCard ? (
                          <span className="block text-xs text-muted-foreground">
                            {card.lines.length} ingrédient{card.lines.length > 1 ? "s" : ""} · {card.portions} portion{card.portions > 1 ? "s" : ""}
                            {card.unpricedLines > 0 ? (
                              <span className="text-amber-700 dark:text-amber-400"> · {card.unpricedLines} sans prix</span>
                            ) : null}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {card.hasCard ? <ReliabilityBadge reliability={card.reliability} /> : <span className="text-xs text-muted-foreground">Sans fiche</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{card.hasCard ? formatCurrency(card.portionCost) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(card.priceHT)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{card.hasCard ? formatCurrency(card.economics.margin) : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{card.hasCard ? formatRatio(card.economics.ratio) : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/dashboard/food-cost/fiches/${card.menuItemId}`}
                          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                        >
                          {card.hasCard ? (
                            "Ouvrir"
                          ) : (
                            <>
                              <PlusIcon className="size-3.5" aria-hidden />
                              Composer
                            </>
                          )}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
