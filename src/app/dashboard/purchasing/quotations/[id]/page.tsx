import Link from "next/link";
import { notFound } from "next/navigation";

import {
  cancelSupplierQuotationAction,
  deleteSupplierQuotationAction,
  submitSupplierQuotationAction,
} from "@/actions/purchasing-sourcing.actions";
import { DocActions, type DocAction } from "@/components/forms/doc-actions";
import { DocumentGallery } from "@/components/purchasing/document-gallery";
import { DocDate, DocNumber, StatusBadge } from "@/components/purchasing/purchasing-ui";
import { QuotationOrderButton } from "@/components/purchasing/quotation-order-button";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";
import { getSupplierQuotation } from "@/services/rfq.service";

export const metadata = { title: "Devis fournisseur" };

export default async function SupplierQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) notFound();
  const { id } = await params;
  const [quotation, access] = await Promise.all([
    getSupplierQuotation(ctx, id).catch(() => null),
    resolveAccess(ctx.userId, ctx.restaurantId),
  ]);
  if (!quotation) notFound();
  const canEdit = Boolean(access && can(access, "PURCHASING", "EDIT"));

  const actions: DocAction[] = !canEdit
    ? []
    : quotation.status === "DRAFT"
      ? [
          { label: "Valider", action: submitSupplierQuotationAction, tone: "primary" },
          { label: "Supprimer", action: deleteSupplierQuotationAction, tone: "danger", confirm: "Supprimer ce brouillon ?" },
        ]
      : quotation.status === "SUBMITTED"
        ? [{ label: "Annuler", action: cancelSupplierQuotationAction, tone: "danger", confirm: "Annuler ce devis ?" }]
        : [];
  const orderable =
    canEdit && quotation.items.length > 0 && ["SUBMITTED", "PARTIALLY_ORDERED"].includes(quotation.status);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/quotations" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux devis
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{quotation.supplierName}</h1>
            <StatusBadge status={quotation.status} />
            {quotation.isExpired ? (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Expiré</span>
            ) : null}
            {quotation.summaryOnly ? (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Total seulement</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            <DocNumber number={quotation.number} />
            {quotation.supplierReference ? ` · réf. ${quotation.supplierReference}` : ""}
            {quotation.rfqNumber ? ` · demande ${quotation.rfqNumber}` : ""}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <DocActions id={quotation.id} actions={actions} />
          {orderable ? <QuotationOrderButton quotationId={quotation.id} /> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
            <h2 className="mb-2 text-base font-semibold">Offre</h2>
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Date du devis</dt>
                <dd><DocDate iso={quotation.transactionDate} /></dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Valable jusqu&apos;au</dt>
                <dd><DocDate iso={quotation.validUntil} /></dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Total HT</dt>
                <dd className="tabular-nums">{formatCurrency(quotation.subtotal - quotation.discountAmount)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">TVA</dt>
                <dd className="tabular-nums">{formatCurrency(quotation.taxTotal)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="font-medium">Total TTC</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(quotation.grandTotal)}</dd>
              </div>
            </dl>
            {quotation.notes ? <p className="mt-3 rounded bg-muted/60 p-2 text-sm">{quotation.notes}</p> : null}
            {quotation.summaryOnly && canEdit ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Pour commander à ces prix, ressaisissez le devis en{" "}
                <Link href="/dashboard/purchasing/quotations/new?mode=detail" className="underline">
                  saisie détaillée
                </Link>
                .
              </p>
            ) : null}
          </section>

          {quotation.items.length > 0 ? (
            <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
              <h2 className="mb-2 text-base font-semibold">Lignes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Article</th>
                      <th className="py-1 text-right font-medium">Qté</th>
                      <th className="py-1 text-right font-medium">P.U. HT</th>
                      <th className="py-1 text-right font-medium">TVA</th>
                      <th className="py-1 text-right font-medium">Montant HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="py-1.5">{line.stockItemName}</td>
                        <td className="py-1.5 text-right tabular-nums">{line.quantity.toLocaleString("fr-FR")}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatCurrency(line.rate)}</td>
                        <td className="py-1.5 text-right tabular-nums">{line.taxRate.toLocaleString("fr-FR")} %</td>
                        <td className="py-1.5 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <DocumentGallery kind="QUOTATION" parentId={quotation.id} documents={quotation.documents} canEdit={canEdit} />
      </div>
    </div>
  );
}
