import { InboxList } from "@/components/accounting/inbox-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HelpBox } from "@/components/forms/help-box";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";
import { listInbox } from "@/services/accounting-encoding.service";

export const metadata = { title: "Bannette — Espace comptable" };

export default async function ComptablePage() {
  const ctx = await getManagerContextOrNull();
  const access = ctx ? await resolveAccess(ctx.userId, ctx.restaurantId) : null;
  if (!ctx || !access || !can(access, "ACCOUNTING", "READ")) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Espace comptable" description="L'encodage des factures fournisseur et client." />
        <EmptyState
          title="Accès refusé"
          description="Demandez au gérant un rôle qui ouvre la comptabilité."
        />
      </div>
    );
  }

  const rows = await listInbox(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Bannette"
        description="Les factures à encoder, la plus ancienne d'abord."
      />
      <HelpBox
        defaultOpen={rows.length === 0}
        title="Encoder une facture"
        steps={[
          "Ouvrez une pièce : le document est à gauche, la saisie à droite.",
          "Vérifiez le tiers, les dates et les montants — les ✓ verts marquent ce qui a été rempli tout seul.",
          "Corrigez la ventilation si besoin : tapez un numéro de compte, créez-le s'il n'existe pas.",
          "Comptabilisez : le numéro de pièce est attribué à cet instant, et la pièce se verrouille.",
        ]}
        tips={[
          "Une pièce comptabilisée ne se modifie plus : on la contre-passe, et l'original reste lisible.",
          "Le compte choisi pour un fournisseur est retenu : sa prochaine facture arrive déjà ventilée.",
        ]}
      />
      <InboxList rows={rows} />
    </div>
  );
}
