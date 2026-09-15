import { MailIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";

import { NewButton } from "@/components/forms/doc-actions";
import { HelpBox } from "@/components/forms/help-box";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { cn } from "@/lib/utils";
import { listRfqs, listSupplierQuotations } from "@/services/rfq.service";
import type { SupplierQuotationListItemDTO } from "@/types/purchasing";

export const metadata = { title: "Devis fournisseurs" };

type View = "tous" | "demandes" | "recus";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "tous", label: "Tout" },
  { value: "demandes", label: "Demandés" },
  { value: "recus", label: "Reçus" },
];

const QuotationRow = ({ quotation, best }: { quotation: SupplierQuotationListItemDTO; best?: boolean }) => (
  <tr className="border-b last:border-0">
    <td className="px-3 py-2">
      <span className="inline-flex items-center gap-1.5">
        <DocNumber number={quotation.number} href={`/dashboard/purchasing/quotations/${quotation.id}`} />
        {quotation.documentCount > 0 ? (
          <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label="Document attaché" />
        ) : null}
      </span>
    </td>
    <td className="px-3 py-2 font-medium">{quotation.supplierName}</td>
    <td className="px-3 py-2">
      <DocDate iso={quotation.transactionDate} />
    </td>
    <td className="px-3 py-2">
      <DocDate iso={quotation.validUntil} />
      {quotation.isExpired && <span className="ml-1 text-xs font-medium text-red-600">expiré</span>}
    </td>
    <td className="px-3 py-2">
      <StatusBadge status={quotation.status} />
    </td>
    <td className="px-3 py-2 text-right">
      <Money value={quotation.grandTotal} />
      {best ? (
        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          moins cher
        </span>
      ) : null}
    </td>
  </tr>
);

const QUOTE_HEADERS = [
  { label: "Numéro" },
  { label: "Fournisseur" },
  { label: "Date" },
  { label: "Valable jusqu'au" },
  { label: "Statut" },
  { label: "Total TTC", align: "right" as const },
];

/**
 * Asking for prices and receiving them are one job, so they share one tab:
 * each request carries the answers it got, the cheapest one flagged, and the
 * quotes that arrived without a request are listed on their own.
 */
export default async function SupplierQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }

  const { vue } = await searchParams;
  const view: View = vue === "demandes" || vue === "recus" ? vue : "tous";
  const [rfqs, quotations] = await Promise.all([listRfqs(ctx), listSupplierQuotations(ctx)]);

  const byRfq = new Map<string, SupplierQuotationListItemDTO[]>();
  for (const quotation of quotations) {
    if (!quotation.rfqId) continue;
    byRfq.set(quotation.rfqId, [...(byRfq.get(quotation.rfqId) ?? []), quotation]);
  }
  const standalone = quotations.filter((q) => !q.rfqId || !rfqs.some((r) => r.id === q.rfqId));
  const showRequests = view !== "recus";
  const showReceived = view !== "demandes";

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Devis"
          description="Vos demandes de prix et les devis reçus des fournisseurs, au même endroit."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/purchasing/quotations/request"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            <MailIcon className="size-4" aria-hidden />
            Demander un devis par e-mail
          </Link>
          <Link
            href="/dashboard/purchasing/rfq/new"
            className="inline-flex items-center rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            Comparer plusieurs fournisseurs
          </Link>
          <NewButton href="/dashboard/purchasing/quotations/new" label="Saisir un devis reçu" />
        </div>
      </div>
      <HelpBox
        defaultOpen={quotations.length === 0 && rfqs.length === 0}
        title="Aide — Devis"
        steps={[
          "« Demander un devis par e-mail » écrit à un ou plusieurs fournisseurs avec la liste des produits voulus.",
          "« Comparer plusieurs fournisseurs » prépare la même liste pour tous : leurs réponses s'affichent sous la demande, la moins chère signalée.",
          "« Saisir un devis reçu » : le PDF reçu par e-mail ou une photo du papier, puis le total ou le détail.",
          "Ouvrez un devis pour revoir son document, le valider et, s'il est détaillé, passer commande.",
        ]}
        tips={["Le trombone indique qu'un document est attaché."]}
      />

      <nav aria-label="Filtrer les devis" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {VIEWS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "tous" ? "/dashboard/purchasing/quotations" : `/dashboard/purchasing/quotations?vue=${option.value}`}
            aria-current={view === option.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground",
              view === option.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {showRequests ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Devis demandés</h2>
          {rfqs.length === 0 ? (
            <EmptyState
              title="Aucune demande"
              description="Envoyez la même liste à deux ou trois fournisseurs pour trouver le moins cher."
            />
          ) : (
            rfqs.map((rfq) => {
              const answers = byRfq.get(rfq.id) ?? [];
              const cheapest = answers.length > 1 ? Math.min(...answers.map((a) => a.grandTotal)) : null;
              return (
                <article key={rfq.id} className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-sm">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <DocNumber number={rfq.number} href={`/dashboard/purchasing/rfq/${rfq.id}`} />
                      <StatusBadge status={rfq.status} />
                      <span className="text-muted-foreground">
                        créée le <DocDate iso={rfq.transactionDate} />
                        {rfq.requiredBy ? (
                          <>
                            {" "}· pour le <DocDate iso={rfq.requiredBy} />
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {rfq.itemCount} article{rfq.itemCount > 1 ? "s" : ""} · {answers.length} / {rfq.supplierCount} réponse
                      {rfq.supplierCount > 1 ? "s" : ""}
                      {answers.length > 1 ? (
                        <>
                          {" · "}
                          <Link href={`/dashboard/purchasing/rfq/${rfq.id}`} className="font-medium text-foreground underline underline-offset-2">
                            Comparer ligne à ligne
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </header>
                  {answers.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      Pas encore de réponse. Quand un fournisseur répond, saisissez son devis depuis la demande.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <tbody>
                          {answers.map((quotation) => (
                            <QuotationRow key={quotation.id} quotation={quotation} best={cheapest != null && quotation.grandTotal === cheapest} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {showReceived ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">
            {view === "recus" ? "Devis reçus" : "Devis reçus sans demande"}
          </h2>
          {(view === "recus" ? quotations : standalone).length === 0 ? (
            <EmptyState
              title="Aucun devis"
              description="Importez le devis qu'un fournisseur vous a envoyé : PDF, photo ou simple total."
            />
          ) : (
            <DocTable headers={QUOTE_HEADERS}>
              {(view === "recus" ? quotations : standalone).map((quotation) => (
                <QuotationRow key={quotation.id} quotation={quotation} />
              ))}
            </DocTable>
          )}
        </section>
      ) : null}
    </div>
  );
}
