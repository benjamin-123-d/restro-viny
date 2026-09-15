import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { EntityForm } from "@/components/forms/entity-form";
import { createCustomerAction } from "@/actions/selling.actions";
import {
  listCustomerGroups,
  listTerritories,
} from "@/services/customer.service";

export default async function NewCustomerPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur d'associer votre restaurant."
        />
      </div>
    );
  }

  const [groupRows, territoryRows] = await Promise.all([
    listCustomerGroups(ctx),
    listTerritories(ctx),
  ]);
  const groups = groupRows.map((g) => ({ value: g.id, label: g.name }));
  const territories = territoryRows.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/selling/customers"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux clients
      </Link>
      <PageHeader
        title={"Nouveau client"}
        description={
          "Un client en compte : hôtel, entreprise, traiteur — quelqu'un que vous facturez et qui paie plus tard."
        }
      />
      <HelpBox
        title={"Comment créer un client"}
        intro={
          "Créez un client pour les ventes « en compte » — celles que vous facturez aujourd'hui et encaissez plus tard. Pour la vente au comptoir, utilisez le POS : pas besoin de fiche client."
        }
        steps={[
          "Tapez le nom du client (obligatoire).",
          "Renseignez l'adresse et l'IFU : ils s'impriment automatiquement sur ses factures.",
          "Fixez un délai de paiement (30 jours par défaut).",
          "Si vous voulez limiter le risque, fixez une limite de crédit.",
        ]}
        tips={[
          "Exemple : limite de 2 000 000 et le client doit déjà 1 800 000 → une commande de 300 000 sera refusée.",
          "Le tableau des clients montre en rouge ceux qui ont dépassé leur limite.",
        ]}
      />
      <EntityForm
        sections={[
          {
            title: "Identité",
            description:
              "Seul le nom est obligatoire. Le code (CUST-00001…) est attribué automatiquement.",
            fields: [
              {
                name: "name",
                label: "Nom du client",
                type: "text",
                required: true,
                placeholder: "ex. Hôtel du Lac",
                hint: "Le nom qui apparaîtra sur les factures.",
              },
              {
                name: "customerGroupId",
                label: "Groupe de clients",
                type: "select",
                options: groups,
                hint: "Hôtels, Entreprises, Événements…",
              },
              {
                name: "territoryId",
                label: "Zone",
                type: "select",
                options: territories,
                hint: "Pour vos statistiques par ville.",
              },
              {
                name: "taxId",
                label: "N° IFU",
                type: "text",
                hint: "Imprimé sur la facture si renseigné.",
              },
            ],
          },
          {
            title: "Coordonnées",
            fields: [
              {
                name: "contactPerson",
                label: "Personne à contacter",
                type: "text",
              },
              {
                name: "phone",
                label: "Téléphone",
                type: "tel",
                placeholder: "+229 96 00 00 00",
              },
              { name: "email", label: "E-mail", type: "email" },
              {
                name: "addressLine1",
                label: "Adresse",
                type: "text",
                hint: "Imprimée sur la facture.",
              },
              { name: "city", label: "Ville", type: "text" },
            ],
          },
          {
            title: "Crédit",
            description:
              "Protège votre trésorerie : empêche de vendre au-delà de ce qu'un client vous doit déjà.",
            fields: [
              {
                name: "paymentTermsDays",
                label: "Délai de paiement (jours)",
                type: "number",
                min: 0,
                defaultValue: 30,
                hint: "L'échéance des factures sera calculée à partir de ce délai.",
              },
              {
                name: "creditLimit",
                label: "Limite de crédit",
                type: "number",
                min: 0,
                hint: "Montant maximum que le client peut vous devoir. Laissez vide ou 0 = pas de limite.",
              },
              {
                name: "blockOnCreditLimit",
                label: "Bloquer les commandes au-delà de la limite",
                type: "checkbox",
                defaultValue: true,
                hint: "Si décoché, la limite sert seulement d'alerte.",
              },
              { name: "notes", label: "Notes internes", type: "textarea" },
            ],
          },
        ]}
        action={createCustomerAction}
        submitLabel={"Créer le client"}
        successMessage={"Client créé."}
        redirectTo="/dashboard/selling/customers"
      />
    </div>
  );
}
