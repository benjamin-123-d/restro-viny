import Link from "next/link";

import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { HelpBox } from "@/components/forms/help-box";
import { DirectPurchaseForm } from "@/components/purchasing/direct-purchase-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listIngredients } from "@/services/food-cost.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Achat direct" };

export default async function NewDirectPurchasePage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [suppliers, ingredients] = await Promise.all([listSuppliers(page.ctx, {}), listIngredients(page.ctx)]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/direct" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux achats directs
      </Link>
      <PageHeader
        title="Achat direct"
        description="Ce que vous avez payé sur place, sans bon de commande : marché, magasin, dépannage."
      />
      <HelpBox
        title="Enregistrer un achat payé sur place"
        steps={[
          "Photographiez le ticket (ou importez-le), puis « Lire le ticket » pour remplir les champs tout seuls.",
          "Vérifiez le magasin, la date et le total payé.",
          "Dites ce que contient le ticket : nourriture seule, ou nourriture + entretien, matériel, emballages…",
          "Détaillez les denrées que vous voulez voir entrer en stock, puis enregistrez.",
        ]}
        tips={[
          "L'achat devient une facture fournisseur déjà validée et payée : elle apparaît dans Factures et dans vos dépenses.",
          "Un magasin inconnu est créé automatiquement dans vos fournisseurs.",
        ]}
      />
      <DirectPurchaseForm
        suppliers={suppliers.filter((s) => !s.disabled).map((s) => ({ id: s.id, name: s.name }))}
        ingredients={ingredients.filter((i) => i.isActive && !i.isPreparation)}
        today={today}
      />
    </div>
  );
}
