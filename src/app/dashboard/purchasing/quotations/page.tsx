import { MailIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";

import { NewButton } from "@/components/forms/doc-actions";
import { HelpBox } from "@/components/forms/help-box";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listSupplierQuotations } from "@/services/rfq.service";

export const metadata = { title: "Devis fournisseurs" };

export default async function SupplierQuotationsPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }

  const quotations = await listSupplierQuotations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Devis fournisseurs"
          description="Les prix proposés par vos fournisseurs, avec leur document d'origine."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/purchasing/quotations/request"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            <MailIcon className="size-4" aria-hidden />
            Demander un devis
          </Link>
          <NewButton href="/dashboard/purchasing/quotations/new" label="Importer un devis" />
        </div>
      </div>
      <HelpBox
        defaultOpen={quotations.length === 0}
        title="Aide — Devis fournisseurs"
        steps={[
          "« Demander un devis » écrit aux fournisseurs par e-mail, avec la liste des produits voulus.",
          "« Importer un devis » : le PDF reçu par e-mail ou une photo du papier, puis le total.",
          "Ouvrez un devis pour revoir son document, le valider et, s'il est détaillé, passer commande.",
        ]}
        tips={["Le trombone indique qu'un document est attaché."]}
      />
      {quotations.length === 0 ? (
        <EmptyState
          title="Aucun devis"
          description="Demandez un devis par e-mail ou importez celui qu'un fournisseur vous a envoyé."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Fournisseur" },
            { label: "Date" },
            { label: "Valable jusqu'au" },
            { label: "Statut" },
            { label: "Total TTC", align: "right" },
          ]}
        >
          {quotations.map((quotation) => (
            <tr key={quotation.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <DocNumber number={quotation.number} href={`/dashboard/purchasing/quotations/${quotation.id}`} />
                  {quotation.documentCount > 0 ? (
                    <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label="Document attaché" />
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 font-medium">{quotation.supplierName}</td>
              <td className="px-3 py-2">
                <DocDate iso={quotation.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={quotation.validUntil} />
                {quotation.isExpired && <span className="ml-1 text-xs font-medium text-red-600">expiré</span>}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={quotation.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={quotation.grandTotal} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
