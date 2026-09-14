import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { DocumentForm } from "@/components/forms/document-form";
import { createPurchaseInvoiceAction } from "@/actions/purchasing.actions";
import { listSuppliers } from "@/services/supplier.service";
import { listStock } from "@/services/stock.service";

export default async function NewPurchaseInvoicePage() {
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
        href="/dashboard/purchasing/invoices"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux factures
      </Link>
      <PageHeader
        title={"Nouvelle facture fournisseur"}
        description={
          "Saisissez la facture reçue d'un fournisseur. Elle devient une dette jusqu'à ce que vous la payiez."
        }
      />
      <HelpBox
        title={"Saisir une facture fournisseur"}
        intro={""}
        steps={[
          "Choisissez le fournisseur et recopiez le numéro de sa facture.",
          "Recopiez les lignes et vérifiez que le total correspond au papier.",
          "Enregistrez, puis « Valider » dans la liste : la facture devient une dette à payer.",
          "Payez-la depuis « Payments » : son statut passera à « Payée ».",
        ]}
        tips={[
          "Si le total ne correspond pas au papier, vérifiez la TVA et les remises ligne par ligne.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "supplierId",
          partyLabel: "Fournisseur",
          partyHint: "Celui qui vous a envoyé la facture.",
          parties: suppliers,
          dateField: "dueDate",
          dateLabel: "Date d'échéance",
          dateHint:
            "Laissez vide : calculée avec le délai de paiement du fournisseur.",
          lineMode: "stock",
          catalogue,
          defaultTaxRate: 18,
          withDiscount: true,
          extraText: {
            name: "supplierInvoiceNo",
            label: "N° de la facture fournisseur",
            hint: "Le numéro imprimé sur son papier, pour la retrouver.",
          },
        }}
        action={createPurchaseInvoiceAction}
        submitLabel={"Enregistrer la facture"}
        redirectTo="/dashboard/purchasing/invoices"
      />
    </div>
  );
}
