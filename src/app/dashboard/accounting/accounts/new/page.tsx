import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { EntityForm } from "@/components/forms/entity-form";
import { createAccountAction } from "@/actions/accounting.actions";
import { listAccounts } from "@/services/accounting.service";

export default async function NewAccountPage() {
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

  const parents = (await listAccounts(ctx))
    .filter((a) => a.isGroup)
    .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/accounting/accounts"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour au plan comptable
      </Link>
      <PageHeader
        title={"Nouveau compte"}
        description={
          "Ajoutez un compte au plan comptable, par exemple une deuxième banque ou une charge particulière."
        }
      />
      <HelpBox
        title={"Comment choisir la nature d'un compte"}
        intro={
          "La nature décide où le compte apparaît : actif, passif et capitaux vont au bilan ; produits et charges vont au compte de résultat."
        }
        steps={[
          "Choisissez un code libre dans la bonne tranche (ex. 1120 pour une seconde banque).",
          "Choisissez la nature — le texte de chaque option vous rappelle ce qu'elle signifie.",
          "Rattachez-le à son parent : « Assets » pour une banque, « Expenses » pour une charge.",
        ]}
        tips={[
          "Un plan de 24 comptes est déjà créé : ajoutez seulement ce qui vous manque.",
          "Un compte qui a déjà reçu des écritures ne peut plus être supprimé.",
        ]}
      />
      <EntityForm
        sections={[
          {
            title: "Compte",
            fields: [
              {
                name: "code",
                label: "Code",
                type: "text",
                required: true,
                placeholder: "ex. 1120",
                hint: "Suivez la numérotation : 1xxx actif, 2xxx dettes, 3xxx capitaux, 4xxx produits, 5xxx charges.",
              },
              {
                name: "name",
                label: "Intitulé",
                type: "text",
                required: true,
                placeholder: "ex. Banque Ecobank",
              },
              {
                name: "rootType",
                label: "Nature",
                type: "select",
                required: true,
                options: [
                  {
                    value: "ASSET",
                    label:
                      "Actif — ce que vous possédez (caisse, banque, stock)",
                  },
                  {
                    value: "LIABILITY",
                    label: "Passif — ce que vous devez (fournisseurs, impôts)",
                  },
                  {
                    value: "EQUITY",
                    label: "Capitaux propres — l'apport du propriétaire",
                  },
                  {
                    value: "INCOME",
                    label: "Produit — ce qui rapporte (ventes)",
                  },
                  {
                    value: "EXPENSE",
                    label: "Charge — ce qui coûte (loyer, salaires)",
                  },
                ],
                hint: "Détermine dans quel état financier le compte apparaît.",
              },
              {
                name: "parentId",
                label: "Compte parent",
                type: "select",
                options: parents,
                hint: "Le regroupement sous lequel il s'affiche.",
              },
              {
                name: "accountType",
                label: "Rôle particulier",
                type: "select",
                options: [
                  { value: "CASH", label: "Caisse" },
                  { value: "BANK", label: "Banque" },
                  { value: "RECEIVABLE", label: "Clients" },
                  { value: "PAYABLE", label: "Fournisseurs" },
                  { value: "STOCK", label: "Stock" },
                  { value: "TAX", label: "Taxes" },
                  { value: "INCOME_ACCOUNT", label: "Compte de produit" },
                  { value: "EXPENSE_ACCOUNT", label: "Compte de charge" },
                  { value: "OTHER", label: "Autre" },
                ],
                hint: "Facultatif.",
              },
              {
                name: "isGroup",
                label: "Compte de regroupement",
                type: "checkbox",
                hint: "Un regroupement totalise ses sous-comptes et ne reçoit jamais d'écriture directe.",
              },
              { name: "description", label: "Description", type: "textarea" },
            ],
          },
        ]}
        action={createAccountAction}
        submitLabel={"Créer le compte"}
        successMessage={"Compte créé."}
        redirectTo="/dashboard/accounting/accounts"
      />
    </div>
  );
}
