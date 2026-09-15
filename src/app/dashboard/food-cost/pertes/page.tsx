import { LossForm } from "@/components/food-cost/loss-form";
import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { listIngredients, listLosses, listRecipeCards } from "@/services/food-cost.service";

export const metadata = { title: "Pertes — Food cost" };

export default async function FoodLossesPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const [ingredients, cards, losses] = await Promise.all([
    listIngredients(page.ctx),
    listRecipeCards(page.ctx),
    listLosses(page.ctx),
  ]);
  const total = losses.reduce((s, l) => s + l.value, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <PageHeader title="Pertes" description="Ce qui part à la poubelle, noté au moment où ça arrive : l'écart commence à s'expliquer." />
      <HelpBox
        defaultOpen={losses.length === 0}
        title="Pourquoi noter les pertes"
        steps={[
          "Un produit abîmé, une casse, une erreur de cuisson : notez l'ingrédient et la quantité.",
          "Une assiette renvoyée ou jetée : choisissez le plat, ses ingrédients sortent du stock selon sa fiche.",
          "La valeur est figée au coût du jour et sort de l'écart inexpliqué sur l'écran Food cost.",
        ]}
      />
      {page.canEdit ? (
        <LossForm ingredients={ingredients.filter((i) => i.isActive)} dishes={cards.filter((c) => c.hasCard)} />
      ) : null}
      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm">
          <h2 className="font-semibold">Pertes déclarées</h2>
          <span className="text-muted-foreground">
            Total récent : <strong className="text-foreground">{formatCurrency(total)}</strong>
          </span>
        </div>
        {losses.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucune perte déclarée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Perte</th>
                  <th className="px-3 py-2 text-left font-medium">Motif</th>
                  <th className="px-3 py-2 text-right font-medium">Quantité</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {losses.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">{formatDateTime(l.lossAt)}</td>
                    <td className="px-3 py-2 font-medium">
                      {l.name}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{l.kind === "DISH" ? "· plat" : "· ingrédient"}</span>
                    </td>
                    <td className="px-3 py-2">{l.reason}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.unit ? formatQuantity(l.quantity, l.unit) : `${l.quantity.toLocaleString("fr-FR")} portion(s)`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
