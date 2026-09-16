import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { StockCheckReview } from "@/components/inventory/stock-check-review";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStockChecks } from "@/services/staff-declarations.service";

export const metadata = { title: "Relevés du matin" };

export default async function StockChecksPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }

  const [pending, history] = await Promise.all([
    listStockChecks(ctx.restaurantId, "EN_ATTENTE"),
    listStockChecks(ctx.restaurantId),
  ]);
  const resolved = history.filter((check) => check.status !== "EN_ATTENTE").slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/inventory" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour à l&apos;inventaire
      </Link>
      <PageHeader
        title="Relevés du matin"
        description="Ce que la cuisine a signalé en regardant ses étagères, en attente de votre décision."
      />
      <HelpBox
        defaultOpen={pending.length === 0}
        title="À quoi sert cet écran"
        steps={[
          "Le matin, la cuisine ouvre « Stock du matin » sur son téléphone et compare avec ce que l'application attend.",
          "Si un chiffre ne colle pas, elle le signale : le stock ne bouge pas, l'écart arrive ici.",
          "Vous appliquez — les corrections sont écrites — ou vous refusez, et le stock reste inchangé.",
        ]}
        tips={[
          "Un écart répété sur le même produit se lit rarement comme une erreur de comptage : regardez les pertes et les portions.",
        ]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          En attente {pending.length > 0 ? <span className="text-muted-foreground">({pending.length})</span> : null}
        </h2>
        <StockCheckReview checks={pending} />
      </section>

      {resolved.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Déjà traités</h2>
          <StockCheckReview checks={resolved} />
        </section>
      ) : null}
    </div>
  );
}
