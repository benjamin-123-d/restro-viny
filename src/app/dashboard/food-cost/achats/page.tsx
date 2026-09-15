import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { QuickPurchaseForm } from "@/components/food-cost/quick-purchase-form";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { listIngredients, listPurchases } from "@/services/food-cost.service";

export const metadata = { title: "Achats — Food cost" };

export default async function FoodPurchasesPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const [ingredients, purchases] = await Promise.all([listIngredients(page.ctx), listPurchases(page.ctx)]);
  const raw = ingredients.filter((i) => i.isActive && !i.isPreparation);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <PageHeader title="Achats" description="Les courses du jour, saisies en quelques secondes : le stock et le prix suivent." />
      <HelpBox
        defaultOpen={purchases.length === 0}
        title="Saisir un achat marché"
        steps={[
          "Choisissez l'ingrédient.",
          "Tapez la quantité dans l'unité où vous l'avez acheté (2 paniers, 1 carton).",
          "Tapez le montant payé HT : le prix d'achat de l'ingrédient est mis à jour et le stock augmente.",
        ]}
        tips={[
          "Les réceptions et factures du module Achats alimentent aussi le stock et les prix : pas besoin de les ressaisir ici.",
        ]}
      />
      {page.canEdit ? (
        raw.length === 0 ? (
          <EmptyState title="Aucun ingrédient" description="Créez d'abord vos ingrédients dans l'onglet Ingrédients." />
        ) : (
          <QuickPurchaseForm ingredients={raw} />
        )
      ) : null}

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">Derniers achats</h2>
        {purchases.length === 0 ? (
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
                {purchases.map((p) => (
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
      </section>
    </div>
  );
}
