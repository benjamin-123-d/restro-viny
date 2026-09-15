"use client";

import { DownloadIcon, ExternalLinkIcon, FileTextIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  attachPurchaseDocumentAction,
  removePurchaseDocumentAction,
} from "@/actions/supplier-documents.actions";
import { Button } from "@/components/ui/button";
import { humanError } from "@/lib/error-messages";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PurchaseDocumentDTO, PurchaseDocumentKind } from "@/types/purchasing";

import { DocumentPicker, type PickedDocument } from "./document-picker";

const SOURCE_LABEL: Readonly<Record<PurchaseDocumentDTO["source"], string>> = {
  FILE: "Fichier importé",
  PHOTO: "Photo",
  EMAIL: "Reçu par e-mail",
};

/**
 * The supplier's own document next to what was typed from it, so any figure
 * can be checked against the paper. Photos show inline; PDFs open in the
 * browser's viewer.
 */
export function DocumentGallery({
  kind,
  parentId,
  documents,
  canEdit,
}: {
  readonly kind: PurchaseDocumentKind;
  readonly parentId: string;
  readonly documents: readonly PurchaseDocumentDTO[];
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<PickedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(documents[0]?.id ?? null);
  const current = documents.find((d) => d.id === selected) ?? documents[0] ?? null;

  const upload = () => {
    if (!picked) return;
    const form = new FormData();
    form.set("kind", kind);
    form.set("parentId", parentId);
    form.set("source", picked.source);
    form.set("file", picked.file);
    startTransition(async () => {
      const result = await attachPurchaseDocumentAction(form);
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      setPicked(null);
      setError(null);
      if (result.data) setSelected(result.data.id);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (!window.confirm("Retirer ce document ?")) return;
    startTransition(async () => {
      const result = await removePurchaseDocumentAction({ id });
      if (!result.success) setError(humanError(result.error));
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold">Document du fournisseur</h2>

      {current ? (
        <>
          <div className="overflow-hidden rounded-lg border bg-muted">
            {current.isImage && !current.mimeType.includes("hei") ? (
              // eslint-disable-next-line @next/next/no-img-element -- served from our own authenticated route
              <img src={current.url} alt={current.fileName} className="max-h-[560px] w-full object-contain" />
            ) : current.mimeType === "application/pdf" ? (
              <object data={current.url} type="application/pdf" className="h-[560px] w-full" aria-label={current.fileName}>
                <p className="p-6 text-center text-sm">
                  Aperçu indisponible :{" "}
                  <a href={current.url} target="_blank" rel="noreferrer" className="underline">
                    ouvrir le PDF
                  </a>
                </p>
              </object>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileTextIcon className="size-8" aria-hidden />
                <a href={current.url} target="_blank" rel="noreferrer" className="text-sm underline">
                  Ouvrir le fichier
                </a>
              </div>
            )}
          </div>

          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {documents.map((d) => (
              <li key={d.id} className={cn("flex items-center gap-2 px-3 py-2", d.id === current.id && "bg-muted/50")}>
                <button type="button" onClick={() => setSelected(d.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">{d.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[d.source]} · {formatDateTime(d.createdAt)}
                  </span>
                </button>
                <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 hover:bg-muted" title="Ouvrir dans un onglet">
                  <ExternalLinkIcon className="size-4" aria-hidden />
                  <span className="sr-only">Ouvrir</span>
                </a>
                <a href={`${d.url}?download=1`} className="rounded p-1.5 hover:bg-muted" title="Télécharger">
                  <DownloadIcon className="size-4" aria-hidden />
                  <span className="sr-only">Télécharger</span>
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={pending}
                    className="rounded p-1.5 text-red-700 hover:bg-red-50"
                    title="Retirer"
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                    <span className="sr-only">Retirer</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun document attaché pour l&apos;instant.</p>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-medium">{documents.length ? "Ajouter un autre document" : "Attacher le document"}</p>
          <DocumentPicker value={picked} onChange={setPicked} error={error ?? undefined} />
          {picked ? (
            <Button type="button" onClick={upload} disabled={pending} className="self-end">
              {pending ? "Envoi…" : "Attacher"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
