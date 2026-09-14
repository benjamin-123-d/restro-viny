import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { JournalForm } from "@/components/forms/journal-form";
import { createJournalAction } from "@/actions/accounting.actions";
import { listAccounts } from "@/services/accounting.service";

export default async function NewJournalPage() {
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

  const accounts = (await listAccounts(ctx))
    .filter((a) => !a.isGroup && !a.isFrozen)
    .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/accounting/journals"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux écritures
      </Link>
      <PageHeader
        title={"Nouvelle écriture comptable"}
        description={
          "Enregistrez une opération que les autres modules ne génèrent pas : loyer, salaires, apport du propriétaire, emprunt…"
        }
      />
      <HelpBox
        title={"Comprendre le débit et le crédit"}
        intro={
          "Toute opération touche au moins deux comptes, et le total au débit égale toujours le total au crédit."
        }
        steps={[
          "Payer le loyer 150 000 en espèces : débit « Rent » 150 000 · crédit « Cash » 150 000.",
          "Verser les salaires par banque 400 000 : débit « Wages » 400 000 · crédit « Bank » 400 000.",
          "Le propriétaire apporte 1 000 000 en banque : débit « Bank » 1 000 000 · crédit « Owner's capital » 1 000 000.",
          "Enregistrez en brouillon, puis « Comptabiliser » depuis la liste pour l'inscrire au grand livre.",
        ]}
        tips={[
          "Règle simple : ce qui augmente un actif ou une charge va au débit ; ce qui augmente une dette, un capital ou un produit va au crédit.",
          "Le bouton d'enregistrement reste grisé tant que l'écriture n'est pas équilibrée.",
        ]}
      />
      <JournalForm
        accounts={accounts}
        action={createJournalAction}
        redirectTo="/dashboard/accounting/journals"
      />
    </div>
  );
}
