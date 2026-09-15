import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  Progress,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listDeliveryNotes } from "@/services/sales.document.service";

export default async function DeliveryNotesPage() {
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

  const rows = await listDeliveryNotes(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Bons de livraison"
        description="Les marchandises remises aux clients. Valider un bon fait sortir le stock de son entrepôt."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Rien de livré pour l'instant"
          description="Livrez une commande client pour l'enregistrer ici."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Client" },
            { label: "Date" },
            { label: "Statut" },
            { label: "Facturé" },
            { label: "Total", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
                {row.isReturn && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    return
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.customerName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.postingDate} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={row.billedPercent} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.grandTotal} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
