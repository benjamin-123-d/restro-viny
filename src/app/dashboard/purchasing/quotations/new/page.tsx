import Link from "next/link";

import { createSupplierQuotationAction } from "@/actions/purchasing-sourcing.actions";
import { recordQuotationFromDocumentAction } from "@/actions/supplier-documents.actions";
import { DocumentForm } from "@/components/forms/document-form";
import { HelpBox } from "@/components/forms/help-box";
import { EntryModeSwitch } from "@/components/purchasing/entry-mode-switch";
import { QuickDocumentForm } from "@/components/purchasing/quick-document-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Importer un devis fournisseur" };

export default async function NewSupplierQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }

  const { mode: rawMode } = await searchParams;
  const mode = rawMode === "detail" ? "detail" : "quick";
  const supplierRows = (await listSuppliers(ctx, {})).filter((s) => !s.preventRfq);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/quotations" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux devis
      </Link>
      <PageHeader
        title="Importer un devis fournisseur"
        description="Le devis reçu par e-mail ou sur papier, gardé avec ses montants pour comparer et commander."
      />
      <EntryModeSwitch basePath="/dashboard/purchasing/quotations/new" mode={mode} />

      {mode === "quick" ? (
        <>
          <HelpBox
            title="Importer un devis reçu"
            steps={[
              "Importez le PDF reçu par e-mail, ou prenez le devis papier en photo.",
              "Choisissez le fournisseur, recopiez la référence et la date de validité.",
              "Tapez le total TTC et la TVA : le HT se calcule tout seul.",
              "Enregistrez : le devis et son document sont consultables dans « Devis reçus ».",
            ]}
            tips={[
              "Pour transformer le devis en commande au bon prix, utilisez la saisie détaillée.",
              "Pas encore de devis ? « Demander un devis » l'envoie par e-mail à vos fournisseurs.",
            ]}
          />
          <QuickDocumentForm
            kind="QUOTATION"
            suppliers={supplierRows.map((s) => ({ value: s.id, label: s.name, paymentTermsDays: s.paymentTermsDays }))}
            action={recordQuotationFromDocumentAction}
            detailHref="/dashboard/purchasing/quotations/{id}"
          />
        </>
      ) : (
        <>
          <HelpBox
            title="Saisir un devis ligne par ligne"
            steps={[
              "Choisissez le fournisseur et la date de fin de validité.",
              "Recopiez chaque produit avec sa quantité, son prix HT et sa TVA.",
              "Enregistrez, validez le devis, puis « Passer commande » depuis sa fiche.",
            ]}
            tips={["Vous pourrez attacher le PDF ou la photo depuis la fiche du devis."]}
          />
          <DocumentForm
            config={{
              partyField: "supplierId",
              partyLabel: "Fournisseur",
              partyHint: "Celui qui a établi le devis.",
              parties: supplierRows.map((s) => ({ value: s.id, label: s.name })),
              dateField: "validUntil",
              dateLabel: "Valable jusqu'au",
              dateHint: "La date limite de l'offre, si elle est indiquée.",
              lineMode: "stock",
              catalogue: (await listStock(ctx.restaurantId))
                .filter((i) => i.isActive)
                .map((i) => ({ id: i.id, label: i.name, rate: i.costPerUnit ?? 0, unit: i.unit })),
              defaultTaxRate: 5.5,
              withDiscount: true,
            }}
            action={createSupplierQuotationAction}
            submitLabel="Enregistrer le devis"
            redirectTo="/dashboard/purchasing/quotations"
          />
        </>
      )}
    </div>
  );
}
