import { PaperclipIcon } from "lucide-react";

import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { QuickPurchaseSection } from "@/components/food-cost/quick-purchase-section";
import { NewButton } from "@/components/forms/doc-actions";
import { HelpBox } from "@/components/forms/help-box";
import { DocDate, DocNumber, DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { paymentModeLabel } from "@/lib/payment-labels";
import { CATEGORY_LABEL } from "@/lib/purchase-categories";
import { listDirectPurchases } from "@/services/direct-purchase.service";

export const metadata = { title: "Achats directs" };

export default async function DirectPurchasesPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const purchases = await listDirectPurchases(page.ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Achats directs"
          description="Ce que vous payez sur place : marché, magasin, dépannage — avec le ticket en preuve."
        />
        <NewButton href="/dashboard/purchasing/direct/new" label="Achat direct avec ticket" />
      </div>
      <HelpBox
        defaultOpen={purchases.length === 0}
        title="Deux façons de saisir un achat payé sur place"
        steps={[
          "Un seul ingrédient, sans papier : le bloc « Achat marché » plus bas, en trois champs.",
          "Un ticket avec plusieurs articles, ou du non-alimentaire : « Achat direct avec ticket ».",
        ]}
        tips={["Chaque achat direct devient une facture fournisseur déjà validée et payée."]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Derniers achats directs</h2>
        {purchases.length === 0 ? (
          <EmptyState
            title="Aucun achat direct"
            description="Photographiez votre prochain ticket de magasin : le stock, les prix et les dépenses suivront."
          />
        ) : (
          <DocTable
            headers={[
              { label: "Numéro" },
              { label: "Magasin" },
              { label: "Date" },
              { label: "Contenu" },
              { label: "Payé par" },
              { label: "Total TTC", align: "right" },
            ]}
          >
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <DocNumber number={purchase.number} href={`/dashboard/purchasing/invoices/${purchase.id}`} />
                    {purchase.documentCount > 0 ? (
                      <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label="Ticket attaché" />
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  {purchase.supplierName}
                  {purchase.ticketNumber ? (
                    <span className="block text-xs font-normal text-muted-foreground">n° {purchase.ticketNumber}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <DocDate iso={purchase.purchasedAt} />
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {purchase.categories.map((c) => (
                      <span key={c.category} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {CATEGORY_LABEL[c.category]}
                      </span>
                    ))}
                    {purchase.ingredientLineCount > 0 ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                        {purchase.ingredientLineCount} en stock
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {purchase.paymentMode ? paymentModeLabel(purchase.paymentMode) : "—"}
                  {purchase.outstandingAmount > 0 ? (
                    <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">reste à payer</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={purchase.totalTTC} />
                </td>
              </tr>
            ))}
          </DocTable>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Achat marché</h2>
        <QuickPurchaseSection ctx={page.ctx} canEdit={page.canEdit} limit={5} helpOpen={false} />
      </section>
    </div>
  );
}
