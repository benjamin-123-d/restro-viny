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
import { listMaterialRequests } from "@/services/stock-advanced.service";

export default async function MaterialRequestsPage() {
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

  const rows = await listMaterialRequests(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Demandes d'articles"
        description="Les demandes internes : à acheter, à transférer ou à sortir de la réserve."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton href="/dashboard/stock/requests/new" label="Nouvelle demande" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Aucune demande d'articles"
          description="Faites une demande quand la cuisine ou le bar a besoin de stock."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Type" },
            { label: "Créée le" },
            { label: "Pour le" },
            { label: "Statut" },
            { label: "Articles", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.type} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <span className={row.isLate ? "text-red-600" : ""}>
                  <DocDate iso={row.requiredBy} />
                </span>
                {row.isLate && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    late
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.itemCount}
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
