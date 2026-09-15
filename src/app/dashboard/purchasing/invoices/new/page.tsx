import Link from "next/link";

import { createPurchaseInvoiceAction } from "@/actions/purchasing.actions";
import { recordInvoiceFromDocumentAction } from "@/actions/supplier-documents.actions";
import { DocumentForm } from "@/components/forms/document-form";
import { HelpBox } from "@/components/forms/help-box";
import { EntryModeSwitch } from "@/components/purchasing/entry-mode-switch";
import { QuickDocumentForm } from "@/components/purchasing/quick-document-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Nouvelle facture fournisseur" };

export default async function NewPurchaseInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
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

  const { mode: rawMode } = await searchParams;
  const mode = rawMode === "detail" ? "detail" : "quick";
  const supplierRows = await listSuppliers(ctx, {});

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/purchasing/invoices"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour aux factures
      </Link>
      <PageHeader
        title="Nouvelle facture fournisseur"
        description="Enregistrez une facture reçue : elle devient une dette jusqu'à ce que vous la payiez."
      />
      <EntryModeSwitch basePath="/dashboard/purchasing/invoices/new" mode={mode} />

      {mode === "quick" ? (
        <>
          <HelpBox
            title="Importer une facture en 1 minute"
            steps={[
              "Importez le PDF reçu par e-mail, ou prenez la facture papier en photo avec votre téléphone.",
              "Choisissez le fournisseur et recopiez le numéro de la facture.",
              "Tapez le total TTC et la TVA (par taux ou en montant) : le HT se calcule tout seul.",
              "Enregistrez, puis « Valider » : la facture passe « À payer » jusqu'à son règlement.",
            ]}
            tips={[
              "Le stock n'est pas modifié : utilisez la saisie détaillée ou une réception pour faire entrer la marchandise.",
              "Plusieurs taux de TVA sur la facture : choisissez « Montant » et tapez le total de TVA.",
            ]}
          />
          <QuickDocumentForm
            kind="INVOICE"
            suppliers={supplierRows.map((s) => ({
              value: s.id,
              label: s.name,
              paymentTermsDays: s.paymentTermsDays,
            }))}
            action={recordInvoiceFromDocumentAction}
            detailHref="/dashboard/purchasing/invoices/{id}"
          />
        </>
      ) : (
        <>
          <HelpBox
            title="Saisir une facture ligne par ligne"
            steps={[
              "Choisissez le fournisseur et recopiez le numéro de sa facture.",
              "Recopiez les lignes et vérifiez que le total correspond au papier.",
              "Enregistrez, puis « Valider » dans la liste : la facture devient une dette à payer.",
              "Payez-la depuis « Paiements » : son statut passera à « Payé ».",
            ]}
            tips={[
              "Si le total ne correspond pas au papier, vérifiez la TVA et les remises ligne par ligne.",
              "Vous pourrez attacher le PDF ou la photo depuis la fiche de la facture.",
            ]}
          />
          <DocumentForm
            config={{
              partyField: "supplierId",
              partyLabel: "Fournisseur",
              partyHint: "Celui qui vous a envoyé la facture.",
              parties: supplierRows.map((s) => ({ value: s.id, label: s.name })),
              dateField: "dueDate",
              dateLabel: "Date d'échéance",
              dateHint: "Laissez vide : calculée avec le délai de paiement du fournisseur.",
              lineMode: "stock",
              catalogue: (await listStock(ctx.restaurantId))
                .filter((i) => i.isActive)
                .map((i) => ({ id: i.id, label: i.name, rate: i.costPerUnit ?? 0, unit: i.unit })),
              defaultTaxRate: 5.5,
              withDiscount: true,
              extraText: {
                name: "supplierInvoiceNo",
                label: "N° de la facture fournisseur",
                hint: "Le numéro imprimé sur son papier, pour la retrouver.",
              },
            }}
            action={createPurchaseInvoiceAction}
            submitLabel="Enregistrer la facture"
            redirectTo="/dashboard/purchasing/invoices"
          />
        </>
      )}
    </div>
  );
}
