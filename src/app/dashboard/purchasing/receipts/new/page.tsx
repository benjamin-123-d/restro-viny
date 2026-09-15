import Link from "next/link";

import { createPurchaseReceiptAction } from "@/actions/purchasing.actions";
import { DocumentForm } from "@/components/forms/document-form";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Nouvelle réception" };

export default async function NewPurchaseReceiptPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [suppliers, stock] = await Promise.all([listSuppliers(ctx, {}), listStock(ctx.restaurantId)]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/receipts" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux réceptions
      </Link>
      <PageHeader title="Nouvelle réception" description="Ce qui vient d'être livré : la validation fera entrer la marchandise en stock." />
      <HelpBox
        title="Enregistrer une livraison"
        steps={[
          "Choisissez le fournisseur et recopiez le numéro de son bon de livraison.",
          "Saisissez chaque article reçu avec la quantité réellement livrée et le prix HT.",
          "Enregistrez, puis « Valider » dans la liste : le stock augmente et le prix d'achat est mis à jour.",
        ]}
        tips={["Un produit refusé à la livraison ne doit pas être compté dans la quantité reçue."]}
      />
      <DocumentForm
        config={{
          partyField: "supplierId",
          partyLabel: "Fournisseur",
          partyHint: "Celui qui a livré.",
          parties: suppliers.filter((s) => !s.disabled).map((s) => ({ value: s.id, label: s.name })),
          dateField: "postingDate",
          dateLabel: "Date de livraison",
          dateHint: "Vide : aujourd'hui.",
          lineMode: "stock",
          catalogue: stock.filter((i) => i.isActive).map((i) => ({ id: i.id, label: i.name, rate: i.costPerUnit ?? 0, unit: i.unit })),
          defaultTaxRate: 5.5,
          extraText: {
            name: "supplierDeliveryNote",
            label: "N° du bon de livraison",
            hint: "Le numéro imprimé sur le bon du fournisseur.",
          },
        }}
        action={createPurchaseReceiptAction}
        submitLabel="Enregistrer la réception"
        redirectTo="/dashboard/purchasing/receipts"
      />
    </div>
  );
}
