"use client";

import { SparklesIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { forgetPurchaseLineAction } from "@/actions/direct-purchase.actions";
import { FieldHint } from "@/components/forms/help-box";
import { Input } from "@/components/ui/input";
import { humanError } from "@/lib/error-messages";
import { CATEGORY_LABEL, type PurchaseCategory } from "@/lib/purchase-categories";

export interface LearnedLine {
  readonly id: string;
  readonly label: string;
  readonly code: string | null;
  readonly category: PurchaseCategory;
  readonly ingredient: string | null;
  readonly uses: number;
}

/**
 * What the restaurant has taught the application, ticket after ticket.
 *
 * It is shown for two reasons: so the owner can see that correcting a line
 * once was enough, and so a wrong answer can be forgotten outright instead of
 * waiting for the next ticket to overwrite it.
 */
export function PurchaseMemoryList({ lines, canEdit }: { readonly lines: readonly LearnedLine[]; readonly canEdit: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, startForgetting] = useTransition();

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? lines.filter((line) => `${line.label} ${line.code ?? ""} ${line.ingredient ?? ""}`.toLowerCase().includes(needle))
    : lines;

  const forget = (line: LearnedLine) =>
    startForgetting(async () => {
      const result = await forgetPurchaseLineAction({ id: line.id });
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      toast.success(`« ${line.label} » est oublié.`);
      router.refresh();
    });

  if (lines.length === 0) {
    return (
      <FieldHint>
        Rien d&apos;appris pour l&apos;instant. Dès votre premier ticket enregistré, les libellés et leurs catégories
        seront retenus, et le ticket suivant du même magasin arrivera déjà classé.
      </FieldHint>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Chercher un libellé appris…"
        className="h-10 max-w-sm"
        aria-label="Chercher dans ce qui a été appris"
      />

      <ul className="flex flex-wrap gap-2">
        {shown.map((line) => (
          <li key={line.id} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm">
            <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex flex-col">
              <span className="font-medium">{line.label}</span>
              <span className="text-xs text-muted-foreground">
                {CATEGORY_LABEL[line.category]}
                {line.ingredient ? ` · ${line.ingredient}` : ""}
                {line.uses > 1 ? ` · ${line.uses} fois` : ""}
              </span>
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => forget(line)}
                disabled={pending}
                aria-label={`Oublier ${line.label}`}
                title="Oublier cette correspondance"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun libellé appris ne correspond à cette recherche.</p>
      ) : null}

      <FieldHint>
        Ces correspondances sont appliquées à la lecture d&apos;un ticket, jamais à votre place : chaque ligne reste
        modifiable, et la corriger remplace ce qui avait été retenu.
      </FieldHint>
    </div>
  );
}
