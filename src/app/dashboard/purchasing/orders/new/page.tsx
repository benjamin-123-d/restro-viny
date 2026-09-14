import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { DocumentForm } from "@/components/forms/document-form";
import { createPurchaseOrderAction } from "@/actions/purchasing.actions";
import { listSuppliers } from "@/services/supplier.service";
import { listStock } from "@/services/stock.service";

export default async function NewPurchaseOrderPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur d'associer votre restaurant."
        />
      </div>
    );
  }

  const suppliers = (await listSuppliers(ctx, {})).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const catalogue = (await listStock(ctx.restaurantId))
    .filter((i) => i.isActive)
    .map((i) => ({
      id: i.id,
      label: i.name,
      rate: i.costPerUnit ?? 0,
      unit: i.unit,
    }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/purchasing/orders"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux commandes
      </Link>
      <PageHeader
        title={"Nouvelle commande d'achat"}
        description={
          "Ce que vous commandez à un fournisseur. Rien ne bouge dans le stock tant que la marchandise n'est pas réceptionnée."
        }
      />
      <HelpBox
        title={"Le circuit d'une commande d'achat"}
        intro={
          "Commande → Réception → Facture → Paiement. Chaque étape reprend la précédente, vous ne ressaisissez rien."
        }
        steps={[
          "Choisissez le fournisseur.",
          "Ajoutez les articles : le dernier prix d'achat se remplit tout seul, corrigez-le si le fournisseur a changé son tarif.",
          "Vérifiez le total en bas, puis enregistrez : la commande est créée en brouillon.",
          "Dans la liste, cliquez « Valider » pour l'envoyer. Elle passe en « à recevoir ».",
        ]}
        tips={[
          "La TVA est à 18 % par défaut (Bénin) : mettez 0 sur les produits exonérés.",
          "Un article manque dans la liste ? Créez-le d'abord dans Inventaire.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "supplierId",
          partyLabel: "Fournisseur",
          partyHint: "À qui vous passez la commande.",
          parties: suppliers,
          dateField: "scheduleDate",
          dateLabel: "Livraison attendue le",
          dateHint: "Sert à repérer les commandes en retard.",
          lineMode: "stock",
          catalogue,
          defaultTaxRate: 18,
          withDiscount: true,
        }}
        action={createPurchaseOrderAction}
        submitLabel={"Enregistrer la commande"}
        redirectTo="/dashboard/purchasing/orders"
      />
    </div>
  );
}
