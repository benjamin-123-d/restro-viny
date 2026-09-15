import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { QuoteRequestForm } from "@/components/purchasing/quote-request-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { isEmailConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { listStock } from "@/services/stock.service";
import { listSupplierMessages } from "@/services/supplier-documents.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Demander un devis" };

const STATUS: Readonly<Record<string, string>> = {
  SENT: "Envoyé",
  FAILED: "Échec",
  MAILTO: "Via votre messagerie",
};

export default async function QuoteRequestPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }

  const [suppliers, stock, restaurant, messages] = await Promise.all([
    listSuppliers(ctx, {}),
    listStock(ctx.restaurantId),
    findRestaurantById(ctx.restaurantId),
    listSupplierMessages(ctx, { take: 10 }),
  ]);
  const mailService = isEmailConfigured();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/quotations" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux devis
      </Link>
      <PageHeader
        title="Demander un devis par e-mail"
        description="Écrivez une seule fois, envoyez à plusieurs fournisseurs, comparez leurs réponses."
      />
      <HelpBox
        defaultOpen={messages.length === 0}
        title="Comment ça marche"
        steps={[
          "Cochez les fournisseurs à consulter (leur adresse e-mail doit figurer dans leur fiche).",
          "Listez les produits et quantités, ajoutez vos précisions (livraison, conditionnement…).",
          "Vérifiez l'e-mail à droite, puis envoyez : chaque fournisseur reçoit son propre message.",
          "Quand un devis arrive, importez-le depuis « Devis reçus » avec son PDF ou une photo.",
        ]}
        tips={[
          mailService
            ? "L'envoi part du service e-mail de l'application ; les réponses arrivent sur l'adresse du restaurant."
            : "Aucun service d'envoi n'est configuré : un bouton ouvre l'e-mail tout prêt dans votre propre messagerie.",
        ]}
      />
      <QuoteRequestForm
        suppliers={suppliers
          .filter((s) => !s.disabled && !s.preventRfq)
          .map((s) => ({ id: s.id, name: s.name, email: s.email, contactPerson: s.contactPerson }))}
        catalogue={stock.filter((i) => i.isActive).map((i) => ({ name: i.name, unit: UNIT_LABELS[i.unit] ?? "" }))}
        restaurantName={restaurant?.name ?? ""}
        restaurantPhone={restaurant?.phone ?? null}
      />

      {messages.length > 0 ? (
        <section className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <h2 className="mb-2 text-base font-semibold">Dernières demandes</h2>
          <ul className="divide-y text-sm">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{m.supplierName}</span>
                  <span className="text-muted-foreground"> · {m.toEmail}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(m.createdAt)} · {STATUS[m.status] ?? m.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
