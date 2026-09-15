import Link from "next/link";
import { notFound } from "next/navigation";

import {
  cancelPurchaseInvoiceAction,
  deletePurchaseInvoiceAction,
  submitPurchaseInvoiceAction,
} from "@/actions/purchasing.actions";
import { DocActions, type DocAction } from "@/components/forms/doc-actions";
import { DocumentGallery } from "@/components/purchasing/document-gallery";
import { DocDate, DocNumber, Money, StatusBadge } from "@/components/purchasing/purchasing-ui";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { paymentModeLabel } from "@/lib/payment-labels";
import { resolveAccess } from "@/services/access.service";
import { getPurchaseInvoice } from "@/services/purchase-invoice.service";

export const metadata = { title: "Facture fournisseur" };

const Figure = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
  </div>
);

export default async function PurchaseInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) notFound();
  const { id } = await params;
  const [invoice, access] = await Promise.all([
    getPurchaseInvoice(ctx, id).catch(() => null),
    resolveAccess(ctx.userId, ctx.restaurantId),
  ]);
  if (!invoice) notFound();
  const canEdit = Boolean(access && can(access, "PURCHASING", "EDIT"));

  const actions: DocAction[] = !canEdit
    ? []
    : invoice.status === "DRAFT"
      ? [
          { label: "Valider", action: submitPurchaseInvoiceAction, tone: "primary" },
          { label: "Supprimer", action: deletePurchaseInvoiceAction, tone: "danger", confirm: "Supprimer ce brouillon ?" },
        ]
      : ["UNPAID", "OVERDUE"].includes(invoice.status)
        ? [{ label: "Annuler", action: cancelPurchaseInvoiceAction, tone: "danger", confirm: "Annuler cette facture ? Ses effets seront inversés." }]
        : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/invoices" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux factures
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{invoice.supplierName}</h1>
            <StatusBadge status={invoice.status} />
            {invoice.summaryOnly ? (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Total seulement</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            <DocNumber number={invoice.number} />
            {invoice.supplierInvoiceNo ? ` · facture n° ${invoice.supplierInvoiceNo}` : ""}
          </p>
        </div>
        <DocActions id={invoice.id} actions={actions} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
            <h2 className="mb-2 text-base font-semibold">Montants</h2>
            <dl className="divide-y">
              <Figure label="Date de facture" value={new Date(invoice.postingDate).toLocaleDateString("fr-FR")} />
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Échéance</dt>
                <dd>
                  <DocDate iso={invoice.dueDate} />
                  {invoice.daysOverdue > 0 ? (
                    <span className="ml-1 text-xs font-medium text-red-600">en retard de {invoice.daysOverdue} j</span>
                  ) : null}
                </dd>
              </div>
              <Figure label="Total HT" value={formatCurrency(invoice.subtotal - invoice.discountAmount)} />
              <Figure label="TVA" value={formatCurrency(invoice.taxTotal)} />
              <Figure label="Total TTC" value={formatCurrency(invoice.grandTotal)} strong />
              <Figure label="Déjà payé" value={formatCurrency(invoice.paidAmount)} />
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="font-medium">Reste à payer</dt>
                <dd>
                  <Money value={invoice.outstandingAmount} tone={invoice.daysOverdue > 0 ? "danger" : undefined} />
                </dd>
              </div>
            </dl>
            {invoice.notes ? <p className="mt-3 rounded bg-muted/60 p-2 text-sm">{invoice.notes}</p> : null}
            {invoice.outstandingAmount > 0 && invoice.status !== "DRAFT" && canEdit ? (
              <Link
                href="/dashboard/purchasing/payments/new"
                className="mt-3 inline-flex rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Enregistrer un paiement
              </Link>
            ) : null}
          </section>

          {invoice.items.length > 0 ? (
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
                    {invoice.items.map((line) => (
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

          {invoice.payments.length > 0 ? (
            <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
              <h2 className="mb-2 text-base font-semibold">Paiements</h2>
              <ul className="divide-y text-sm">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-1.5">
                    <span>
                      <DocDate iso={p.paymentDate} /> · {paymentModeLabel(p.mode)}
                    </span>
                    <Money value={p.amount} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <DocumentGallery kind="INVOICE" parentId={invoice.id} documents={invoice.documents} canEdit={canEdit} />
      </div>
    </div>
  );
}
