import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { EntityForm } from "@/components/forms/entity-form";
import { createSupplierAction } from "@/actions/purchasing.actions";
import { listSupplierGroups } from "@/services/supplier.service";

export default async function NewSupplierPage() {
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

  const groups = (await listSupplierGroups(ctx)).map((g) => ({
    value: g.id,
    label: g.name,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/purchasing/suppliers"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux fournisseurs
      </Link>
      <PageHeader
        title={"Nouveau fournisseur"}
        description={
          "Enregistrez un fournisseur une fois ; vous le choisirez ensuite dans toutes vos commandes et factures d'achat."
        }
      />
      <HelpBox
        title={"Comment créer un fournisseur"}
        intro={
          "Un fournisseur est quelqu'un à qui vous achetez : marché, grossiste, brasserie, pêcheur."
        }
        steps={[
          "Tapez son nom — c'est le seul champ obligatoire (marqué d'une étoile rouge).",
          "Ajoutez son téléphone pour le retrouver vite.",
          "Indiquez son délai de paiement : les factures calculeront leur échéance toutes seules.",
          "Cliquez « Créer le fournisseur ». Il apparaît aussitôt dans la liste et dans les formulaires de commande.",
        ]}
        tips={[
          "Vous pourrez le mettre « en attente » plus tard pour bloquer les commandes sans le supprimer.",
          "Un fournisseur supprimé reste visible dans l'historique des achats passés.",
        ]}
      />
      <EntityForm
        sections={[
          {
            title: "Identité",
            description:
              "Seul le nom est obligatoire. Le code (SUP-00001…) est attribué automatiquement.",
            fields: [
              {
                name: "name",
                label: "Nom du fournisseur",
                type: "text",
                required: true,
                placeholder: "ex. Marché Dantokpa",
                hint: "Le nom tel qu'il apparaît sur ses factures.",
              },
              {
                name: "supplierGroupId",
                label: "Groupe",
                type: "select",
                options: groups,
                hint: "Pour ranger vos fournisseurs (Produits frais, Grossistes, Boissons…).",
              },
              {
                name: "taxId",
                label: "N° IFU / identifiant fiscal",
                type: "text",
                hint: "Facultatif — utile pour la TVA.",
              },
              {
                name: "contactPerson",
                label: "Personne à contacter",
                type: "text",
                placeholder: "ex. M. Houngbo",
              },
            ],
          },
          {
            title: "Coordonnées",
            fields: [
              {
                name: "phone",
                label: "Téléphone",
                type: "tel",
                placeholder: "+229 97 00 00 00",
              },
              {
                name: "email",
                label: "E-mail",
                type: "email",
                placeholder: "contact@fournisseur.bj",
              },
              {
                name: "addressLine1",
                label: "Adresse",
                type: "text",
                span: "full",
              },
              {
                name: "city",
                label: "Ville",
                type: "text",
                placeholder: "Cotonou",
              },
              {
                name: "country",
                label: "Pays",
                type: "text",
                defaultValue: "Bénin",
              },
            ],
          },
          {
            title: "Conditions",
            description:
              "Ces valeurs se reportent automatiquement sur les nouveaux documents.",
            fields: [
              {
                name: "paymentTermsDays",
                label: "Délai de paiement (jours)",
                type: "number",
                min: 0,
                hint: "Nombre de jours entre la facture et son échéance. 0 = paiement comptant.",
              },
              {
                name: "currency",
                label: "Devise",
                type: "text",
                placeholder: "XOF",
                hint: "Code à 3 lettres. Laissez vide pour la devise du restaurant.",
              },
              {
                name: "preventPo",
                label: "Interdire les commandes à ce fournisseur",
                type: "checkbox",
                hint: "À cocher si vous ne voulez plus lui commander (litige, qualité…).",
              },
              { name: "notes", label: "Notes internes", type: "textarea" },
            ],
          },
        ]}
        action={createSupplierAction}
        submitLabel={"Créer le fournisseur"}
        successMessage={"Fournisseur créé."}
        redirectTo="/dashboard/purchasing/suppliers"
      />
    </div>
  );
}
