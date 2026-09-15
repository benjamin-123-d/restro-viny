import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { ReorderTable } from "@/components/inventory/reorder-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listReorderSuggestions } from "@/services/reorder.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Réapprovisionnement" };

export default async function ReorderPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const [suggestions, suppliers] = await Promise.all([listReorderSuggestions(ctx), listSuppliers(ctx, {})]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/inventory" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour à l&apos;inventaire
      </Link>
      <PageHeader
        title="Réapprovisionnement"
        description="Les articles sous leur seuil, transformés en bons de commande en un clic."
      />
      <HelpBox
        defaultOpen={suggestions.length > 0}
        title="Commander le réassort"
        steps={[
          "Chaque article sous son seuil est proposé, avec une quantité qui le ramène à son niveau idéal.",
          "Ajustez les quantités et choisissez le fournisseur habituel s'il manque : il est retenu pour la prochaine fois.",
          "« Créer les bons de commande » prépare un brouillon par fournisseur, à vérifier puis valider dans Achats → Commandes.",
        ]}
        tips={["Le seuil et le niveau idéal se règlent sur chaque article de l'inventaire."]}
      />
      {suggestions.length === 0 ? (
        <EmptyState title="Rien à commander" description="Aucun article n'est sous son seuil de réapprovisionnement." />
      ) : (
        <ReorderTable
          suggestions={suggestions}
          suppliers={suppliers.filter((s) => !s.disabled && !s.preventPo).map((s) => ({ id: s.id, name: s.name }))}
        />
      )}
    </div>
  );
}
