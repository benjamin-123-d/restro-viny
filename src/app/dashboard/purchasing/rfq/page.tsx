import { NewButton } from "@/components/forms/doc-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listRfqs } from "@/services/rfq.service";

export default async function RfqPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const rfqs = await listRfqs(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Demandes de devis"
        description="Demandez à plusieurs fournisseurs de chiffrer le même panier, puis comparez leurs réponses ligne à ligne."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton href="/dashboard/purchasing/rfq/new" label="Nouvelle demande de devis" />
      </div>
      {rfqs.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          description="Envoyez la même liste à deux ou trois fournisseurs pour trouver le moins cher."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Créée le" },
            { label: "Pour le" },
            { label: "Statut" },
            { label: "Articles", align: "right" },
            { label: "Fournisseurs", align: "right" },
            { label: "Devis reçus", align: "right" },
          ]}
        >
          {rfqs.map((rfq) => (
            <tr key={rfq.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber
                  number={rfq.number}
                  href={`/dashboard/purchasing/rfq/${rfq.id}`}
                />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={rfq.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={rfq.requiredBy} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={rfq.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {rfq.itemCount}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {rfq.supplierCount}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span
                  className={
                    rfq.quotationCount === 0 ? "text-zinc-400" : "font-medium"
                  }
                >
                  {rfq.quotationCount} / {rfq.supplierCount}
                </span>
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
