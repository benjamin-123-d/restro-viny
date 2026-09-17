"use client";

import { FileTextIcon, PaperclipIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { syncInboxAction } from "@/actions/accounting-encoding.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { humanError } from "@/lib/error-messages";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/services/accounting-encoding.service";

const STATUS_LABEL: Record<string, string> = {
  A_TRAITER: "À traiter",
  ENREGISTREE: "Enregistrée",
  COMPTABILISEE: "Comptabilisée",
};

const STATUS_STYLE: Record<string, string> = {
  A_TRAITER: "bg-muted text-muted-foreground",
  ENREGISTREE: "bg-accent text-accent-foreground",
  COMPTABILISEE: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
};

/**
 * La bannette. Deliberately thin — it exists to get to the encoding screen and
 * nothing else. The oldest invoice sits at the top, because a late invoice is
 * what gets a supplier on the phone.
 */
export function InboxList({ rows }: { readonly rows: readonly InboxRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("TOUT");
  const [syncing, startSyncing] = useTransition();

  const needle = search.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (status !== "TOUT" && row.status !== status) return false;
    if (!needle) return true;
    return `${row.thirdPartyName} ${row.invoiceNumber ?? ""}`.toLowerCase().includes(needle);
  });

  const sync = () =>
    startSyncing(async () => {
      const result = await syncInboxAction({});
      if (!result.success) {
        toast.error(humanError(result.error));
        return;
      }
      const added = result.data?.added ?? 0;
      toast.success(added === 0 ? "Rien de nouveau à encoder." : `${added} pièce(s) ajoutée(s) à la bannette.`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Chercher un tiers ou un n° de facture…"
          className="h-10 max-w-sm"
        />
        <nav aria-label="Filtrer par état" className="flex flex-wrap gap-1.5">
          {["TOUT", "A_TRAITER", "ENREGISTREE", "COMPTABILISEE"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                status === value ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground",
              )}
            >
              {value === "TOUT" ? "Tout" : STATUS_LABEL[value]}
            </button>
          ))}
        </nav>
        <Button variant="outline" size="sm" onClick={sync} disabled={syncing} className="ml-auto">
          <RefreshCwIcon className={cn("size-4", syncing && "animate-spin")} aria-hidden />
          Chercher les nouvelles factures
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Rien à encoder. Cliquez sur « Chercher les nouvelles factures » : tout ce que le restaurant a saisi et que
          personne n&apos;a encodé remonte ici.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {shown.map((row) => (
            <li key={row.id}>
              <Link href={`/comptable/piece/${row.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                <FileTextIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.thirdPartyName}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[row.status])}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.pieceNumber ? (
                      <span className="text-muted-foreground text-xs tabular-nums">n° {row.pieceNumber}</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {row.kind === "ACHAT" ? "Achat" : "Vente"}
                    {row.invoiceNumber ? ` · ${row.invoiceNumber}` : ""}
                    {row.invoiceDate ? ` · ${row.invoiceDate.split("-").reverse().join("/")}` : ""}
                  </span>
                </span>
                {row.hasDocument ? (
                  <PaperclipIcon className="text-muted-foreground size-3.5 shrink-0" aria-label="Justificatif joint" />
                ) : null}
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.amountTTC)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
