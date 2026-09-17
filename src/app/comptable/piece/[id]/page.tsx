import { notFound } from "next/navigation";

import { PieceScreen } from "@/components/accounting/piece-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";
import { listAccounts, openPiece, type OpenedPiece } from "@/services/accounting-encoding.service";
import type { AccountOption } from "@/components/accounting/account-combobox";

export const metadata = { title: "Encodage — Espace comptable" };

export default async function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getManagerContextOrNull();
  const access = ctx ? await resolveAccess(ctx.userId, ctx.restaurantId) : null;
  if (!ctx || !access || !can(access, "ACCOUNTING", "READ")) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Accès refusé" description="Demandez au gérant un rôle qui ouvre la comptabilité." />
      </div>
    );
  }

  const { id } = await params;
  // The fetch is what may fail, not the rendering: keeping JSX out of the try
  // block is what lets an error inside the screen reach its error boundary.
  let loaded: { piece: OpenedPiece; accounts: AccountOption[] } | null = null;
  try {
    const [piece, accounts] = await Promise.all([openPiece(ctx, id), listAccounts(ctx)]);
    loaded = { piece, accounts };
  } catch {
    loaded = null;
  }
  if (!loaded) notFound();

  return <PieceScreen piece={loaded.piece} accounts={loaded.accounts} />;
}
